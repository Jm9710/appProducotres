# app_routes.py
from flask import Blueprint, jsonify, request, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask_jwt_extended import create_access_token, jwt_required
from sqlalchemy.orm import subqueryload

from models import db, Usuario, TipoUsuario, KML, KMLTaipas, Archivo, TipoArchivo
from s3_service import subir_archivo_a_s3, eliminar_archivo_de_s3, generar_url_firmada
from app_config import Config

import io
import xml.etree.ElementTree as ET

# 🔧 Import de Dropbox con alias (para no chocar con listar_archivos de S3)
from dropbox_service import (
    listar_archivos as dbx_listar_archivos,
    subir_archivo as dbx_subir_archivo,
    descargar_archivo as dbx_descargar_archivo,
    mover_archivo as dbx_mover_archivo,
)

# --------------------------------------------------------------------
# Blueprint ÚNICO
# --------------------------------------------------------------------
routes = Blueprint('routes', __name__)

# --------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------
def kml_to_geojson(kml_data: bytes):
    """Convierte datos KML (bytes) en un FeatureCollection GeoJSON."""
    kml_tree = ET.ElementTree(ET.fromstring(kml_data))
    root = kml_tree.getroot()
    ns = {'kml': 'http://www.opengis.net/kml/2.2'}

    features = []
    for placemark in root.findall('.//kml:Placemark', ns):
        geometry = placemark.find('.//kml:Polygon//kml:coordinates', ns)
        if geometry is None:
            continue
        coords_raw = [c for c in geometry.text.strip().split(' ') if c]
        coords = []
        for c in coords_raw:
            parts = c.split(',')
            if len(parts) >= 2:
                lng, lat = float(parts[0]), float(parts[1])
                coords.append([lng, lat])
        if not coords:
            continue

        name_el = placemark.find('.//kml:name', ns)
        name = name_el.text if name_el is not None else 'Unnamed'

        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Polygon', 'coordinates': [coords]},
            'properties': {'name': name}
        })

    return {'type': 'FeatureCollection', 'features': features}

# --------------------------------------------------------------------
# Ping
# --------------------------------------------------------------------
@routes.route('/', methods=['GET'])
def home():
    return "¡Servidor Flask funcionando!"

# --------------------------------------------------------------------
# Usuarios
# --------------------------------------------------------------------
@routes.route('/api/usuario', methods=['POST'])
def crear_usuario():
    data = request.get_json() or {}
    if not data.get('nom_us') or not data.get('pass_us') or not data.get('nombre'):
        return jsonify({"msg": "Faltan datos"}), 400

    tipo_usuario = TipoUsuario.query.get(data.get('tipo_us'))
    if not tipo_usuario:
        return jsonify({"msg": "Tipo de usuario no válido"}), 400

    hashed = generate_password_hash(data['pass_us'], method='pbkdf2:sha256')
    nuevo = Usuario(
        nom_us=data['nom_us'],
        pass_us=hashed,
        nombre=data['nombre'],
        cod_productor=data.get('cod_productor'),
        tipo_us=tipo_usuario.id_tipo,
        premium=data.get('premium', False)
    )
    try:
        db.session.add(nuevo)
        db.session.commit()
        return jsonify(nuevo.serialize()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al crear el usuario"}), 500

@routes.route('/api/usuarios', methods=['GET'])
def obtener_usuarios():
    usuarios = Usuario.query.all()
    return jsonify([u.serialize() for u in usuarios]), 200

@routes.route('/api/usuario/<int:id_usuario>', methods=['PUT'])
def actualizar_usuario(id_usuario):
    data = request.get_json() or {}
    usuario = Usuario.query.get(id_usuario)
    if not usuario:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    if 'pass_us' in data and data['pass_us']:
        data['pass_us'] = generate_password_hash(data['pass_us'], method='pbkdf2:sha256')

    for k, v in data.items():
        if hasattr(usuario, k) and k != 'id_usuario':
            setattr(usuario, k, v)

    try:
        db.session.commit()
        return jsonify(usuario.serialize()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar el usuario", "error": str(e)}), 500

@routes.route('/api/usuario/<int:id_usuario>', methods=['DELETE'])
def eliminar_usuario(id_usuario):
    usuario = Usuario.query.get(id_usuario)
    if not usuario:
        return jsonify({"msg": "Usuario no encontrado"}), 404
    try:
        db.session.delete(usuario)
        db.session.commit()
        return jsonify({"msg": "Usuario eliminado exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al eliminar el usuario", "error": str(e)}), 500

# --------------------------------------------------------------------
# Tipos de Usuario
# --------------------------------------------------------------------
@routes.route('/api/tipo_usuario', methods=['POST'])
def crear_tipo_usuario():
    data = request.get_json() or {}
    if not data.get('tipo'):
        return jsonify({"msg": "Faltan datos"}), 400
    nuevo = TipoUsuario(tipo=data['tipo'])
    try:
        db.session.add(nuevo)
        db.session.commit()
        return jsonify(nuevo.serialize()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al crear el tipo de usuario"}), 500

@routes.route('/api/tipo_usuario', methods=['GET'])
def obtener_tipos_usuario():
    tipos = TipoUsuario.query.all()
    return jsonify([t.serialize() for t in tipos]), 200

@routes.route('/api/tipo_usuario/<int:id_tipo>', methods=['PUT'])
def actualizar_tipo_usuario(id_tipo):
    data = request.get_json() or {}
    if not data.get('tipo'):
        return jsonify({"msg": "Faltan datos"}), 400
    tipo = TipoUsuario.query.get(id_tipo)
    if not tipo:
        return jsonify({"msg": "Tipo de usuario no encontrado"}), 404
    try:
        tipo.tipo = data['tipo']
        db.session.commit()
        return jsonify(tipo.serialize()), 200
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar el tipo de usuario"}), 500

# --------------------------------------------------------------------
# Login
# --------------------------------------------------------------------
@routes.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    if not data.get("user") or not data.get("password"):
        return jsonify({"error": "Faltan datos"}), 400

    usuario = Usuario.query.filter_by(nom_us=data["user"]).first()
    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404
    if not check_password_hash(usuario.pass_us, data["password"]):
        return jsonify({"error": "Contraseña incorrecta"}), 401

    token = create_access_token(identity=usuario.id_usuario)
    tipo_usuario = usuario.tipo_usuario.tipo
    return jsonify({
        "token": token,
        "tipo_usuario": tipo_usuario,
        "nom_us": usuario.nom_us,
        "nombre": usuario.nombre,
        "cod_productor": usuario.cod_productor,
    }), 200

# --------------------------------------------------------------------
# Listado de Productores (para el combo del front)
# --------------------------------------------------------------------
@routes.route('/api/usuarios/productores', methods=['GET'])
def obtener_productores():
    productores = Usuario.query.join(TipoUsuario).filter(TipoUsuario.tipo == 'Productor').all()
    return jsonify([p.serialize() for p in productores]), 200

# --------------------------------------------------------------------
# Tipos de Archivo
# --------------------------------------------------------------------
@routes.route('/api/tipo_archivo', methods=['POST'])
def crear_tipo_archivo():
    data = request.get_json() or {}
    if not data.get('tipo'):
        return jsonify({"msg": "Faltan datos"}), 400
    nuevo = TipoArchivo(tipo=data['tipo'])
    try:
        db.session.add(nuevo)
        db.session.commit()
        return jsonify(nuevo.serialize()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al crear el tipo de archivo"}), 500

@routes.route('/api/tipo_archivo', methods=['GET'])
def obtener_tipos_archivo():
    tipos = TipoArchivo.query.all()
    return jsonify([t.serialize() for t in tipos]), 200

# --------------------------------------------------------------------
# Archivos (S3)
# --------------------------------------------------------------------
@routes.route('/api/archivos', methods=['GET'])
def listar_archivos_s3():
    """Lista archivos del productor (clasificación simple)."""
    productor_id = request.args.get('productorId')
    if not productor_id:
        return jsonify({'error': 'Productor ID no proporcionado'}), 400

    productor = Usuario.query.filter_by(cod_productor=productor_id).first()
    if not productor:
        return jsonify({'error': 'Productor no encontrado'}), 404

    archivos = Archivo.query.filter_by(us_asociado=productor.id_usuario).all()
    out = []
    for a in archivos:
        tipo_archivo = TipoArchivo.query.get(a.TipoArchivo)
        item = a.serialize()
        item['tipo_archivo'] = tipo_archivo.tipo if tipo_archivo else None
        out.append(item)
    return jsonify(out), 200

@routes.route('/api/productor/archivos', methods=['GET'])
def obtener_archivos_por_productor():
    """Lista archivos por productor y categoría, devolviendo URLs firmadas temporales."""
    cod_productor = request.args.get('cod_productor')
    categoria = request.args.get('categoria')

    if not cod_productor:
        return jsonify({'error': 'Productor ID no proporcionado'}), 400

    productor = Usuario.query.filter_by(cod_productor=cod_productor).first()
    if not productor:
        return jsonify({'error': 'Productor no encontrado'}), 404

    query = Archivo.query.filter_by(us_asociado=productor.id_usuario)
    if categoria:
        ta = TipoArchivo.query.filter_by(tipo=categoria).first()
        if ta:
            query = query.filter_by(TipoArchivo=ta.id_tipo_archivo)

    archivos = query.all()
    clasificados = {}
    for a in archivos:
        ta = TipoArchivo.query.get(a.TipoArchivo)
        tipo_nombre = ta.tipo if ta else 'Desconocido'
        key_s3 = a.ruta_descarga.split(
            f"https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/"
        )[-1]
        url_firmada = generar_url_firmada(key_s3, expiracion=600)  # 10 min
        data = a.serialize()
        data['ruta_descarga'] = url_firmada or a.ruta_descarga
        clasificados.setdefault(tipo_nombre, []).append(data)

    return jsonify({
        'productor': productor.nombre,
        'cod_productor': productor.cod_productor,
        'archivos': clasificados
    }), 200

@routes.route('/api/subir_archivo', methods=['POST'])
def subir_archivo():
    if 'archivo' not in request.files:
        return jsonify({"msg": "No se ha subido ningún archivo"}), 400
    if not request.form.get('tipoArchivo'):
        return jsonify({"msg": "No se ha especificado el tipo de archivo"}), 400
    if not request.form.get('productorId'):
        return jsonify({"msg": "No se ha especificado el productor ID"}), 400

    archivo = request.files['archivo']
    tipo_archivo_id = request.form['tipoArchivo']
    cod_productor = request.form['productorId']

    if archivo.filename == '':
        return jsonify({"msg": "No se ha seleccionado ningún archivo"}), 400

    filename = secure_filename(archivo.filename)
    productor = Usuario.query.filter_by(cod_productor=cod_productor).first()
    if not productor:
        return jsonify({"msg": "Productor no encontrado"}), 404

    tipo_archivo = TipoArchivo.query.filter_by(id_tipo_archivo=tipo_archivo_id).first()
    if not tipo_archivo:
        return jsonify({"msg": "Tipo de archivo no encontrado"}), 404

    ruta_s3 = f"{cod_productor}/{tipo_archivo.tipo}/{filename}"
    mensaje = subir_archivo_a_s3(archivo, ruta_s3)

    if "exitosamente" not in mensaje:
        return jsonify({"msg": mensaje}), 400

    kml_asociado = KML.query.filter_by(us_asociado=productor.id_usuario).first()
    if not kml_asociado:
        return jsonify({"msg": "No se ha encontrado un KML asociado al productor."}), 400

    nuevo_archivo = Archivo(
        nombre=filename,
        ruta_descarga=f'https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/{ruta_s3}',
        us_asociado=productor.id_usuario,
        TipoArchivo=tipo_archivo_id,
        kml_asociado=kml_asociado.id_kml
    )
    db.session.add(nuevo_archivo)
    db.session.commit()
    return jsonify({"msg": "Archivo cargado y asociado al KML exitosamente"}), 200

@routes.route('/api/eliminar_archivo', methods=['DELETE'])
def eliminar_archivo():
    data = request.get_json() or {}
    nombre = data.get('archivo_nombre')
    if not nombre:
        return jsonify({"msg": "Nombre de archivo no proporcionado"}), 400

    archivo = Archivo.query.filter_by(nombre=nombre).first()
    if not archivo:
        return jsonify({"msg": "Archivo no encontrado"}), 404

    # Eliminar de S3 (la función acepta URL completa en tu implementación)
    if not eliminar_archivo_de_s3(archivo.ruta_descarga):
        return jsonify({"msg": "Error al eliminar archivo de S3"}), 500

    db.session.delete(archivo)
    db.session.commit()
    return jsonify({"msg": "Archivo y registro eliminados exitosamente"}), 200

# --------------------------------------------------------------------
# KML
# --------------------------------------------------------------------
@routes.route('/api/subir_kml', methods=['POST'])
def subir_kml():
    if 'archivo' not in request.files:
        return jsonify({"msg": "No se ha subido ningún archivo KML"}), 400
    if not request.form.get('productorId'):
        return jsonify({"msg": "No se ha especificado el productor ID"}), 400

    archivo_kml = request.files['archivo']
    cod_productor = request.form['productorId']

    if archivo_kml.filename == '':
        return jsonify({"msg": "No se ha seleccionado ningún archivo KML"}), 400
    filename = secure_filename(archivo_kml.filename)
    if not filename.lower().endswith('.kml'):
        return jsonify({"msg": "El archivo subido no es un archivo KML"}), 400

    productor = Usuario.query.filter_by(cod_productor=cod_productor).first()
    if not productor:
        return jsonify({"msg": "Productor no encontrado"}), 404

    ruta_s3 = f"{cod_productor}/kml/{filename}"

    # Convertir a GeoJSON (leer y resetear puntero)
    kml_bytes = archivo_kml.read()
    archivo_kml.seek(0)
    geojson = kml_to_geojson(kml_bytes)

    # Subir a S3
    mensaje = subir_archivo_a_s3(archivo_kml, ruta_s3)
    if "exitosamente" not in mensaje:
        return jsonify({"msg": mensaje}), 400

    # Upsert del registro KML
    kml_existente = KML.query.filter_by(us_asociado=productor.id_usuario).first()
    ruta_full = f'https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/{ruta_s3}'
    if kml_existente:
        kml_existente.ruta_archivo = ruta_full
    else:
        db.session.add(KML(ruta_archivo=ruta_full, us_asociado=productor.id_usuario))
    db.session.commit()

    return jsonify({"msg": "Archivo KML cargado/actualizado exitosamente", "geojson": geojson}), 200

@routes.route('/api/productor/kml', methods=['GET'])
def obtener_kml_por_productor():
    cod_productor = request.args.get('cod_productor')
    if not cod_productor:
        return jsonify({'error': 'Código del productor no proporcionado'}), 400

    productor = Usuario.query.filter_by(cod_productor=cod_productor.strip()).first()
    if not productor:
        return jsonify({'error': 'Productor no encontrado'}), 404

    kmls = KML.query.filter_by(us_asociado=productor.id_usuario).options(subqueryload(KML.archivos)).all()
    if not kmls:
        return jsonify({'productor': productor.nombre, 'cod_productor': productor.cod_productor, 'kmls': []}), 200

    # (Diagnóstico) imprimir relación
    for k in kmls:
        for a in k.archivos:
            print(f"KML {k.id_kml} -> archivo {a.nombre} ({a.ruta_descarga})")

    return jsonify({
        'productor': productor.nombre,
        'cod_productor': productor.cod_productor,
        'kmls': [k.serialize() for k in kmls]
    }), 200

# --------------------------------------------------------------------
# Dropbox (APIs internas para polling/descarga/mover)
# --------------------------------------------------------------------
@routes.route("/list", methods=["GET"])
def list_files():
    folder = request.args.get("folder", "")
    data = dbx_listar_archivos(folder)
    return jsonify(data), (200 if isinstance(data, list) else 400)

@routes.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files or "path" not in request.form:
        return jsonify({"error": "Falta file o path"}), 400
    f = request.files["file"]
    path = request.form["path"]
    res = dbx_subir_archivo(f, path)
    return jsonify(res), (200 if "msg" in res else 400)

@routes.route("/download", methods=["GET"])
def download_file():
    path = request.args.get("path")
    if not path:
        return jsonify({"error": "Falta path"}), 400
    blob, filename = dbx_descargar_archivo(path)
    if blob is None:
        return jsonify({"error": filename}), 400
    return send_file(io.BytesIO(blob), as_attachment=True, download_name=filename)

@routes.route("/move", methods=["POST"])
def move_file():
    data = request.get_json() or {}
    if "from" not in data or "to" not in data:
        return jsonify({"error": "Faltan from/to"}), 400
    res = dbx_mover_archivo(data["from"], data["to"])
    return jsonify(res), (200 if "msg" in res else 400)

@routes.route("/consume", methods=["GET"])
def consume_file():
    path = request.args.get("path")
    dest = request.args.get("dest")
    if not path or not dest:
        return jsonify({"error": "Faltan path/dest"}), 400

    blob, filename = dbx_descargar_archivo(path)
    if blob is None:
        return jsonify({"error": filename}), 400

    res = dbx_mover_archivo(path, dest)
    if "error" in res:
        return jsonify(res), 400
    return send_file(io.BytesIO(blob), as_attachment=True, download_name=filename)
