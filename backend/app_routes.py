from flask import Blueprint, jsonify, request, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask_jwt_extended import create_access_token, jwt_required
from models import db, Usuario, TipoUsuario, KML, KMLTaipas, Archivo, TipoArchivo
from s3_service import subir_archivo_a_s3, eliminar_archivo_de_s3, generar_url_firmada
from app_config import Config
import xml.etree.ElementTree as ET
from sqlalchemy.orm import joinedload
import io
from dropbox_service import (
    listar_archivos as dbx_listar_archivos,
    subir_archivo as dbx_subir_archivo,
    descargar_archivo as dbx_descargar_archivo,
    mover_archivo as dbx_mover_archivo,
)



def kml_to_geojson(kml_data):
    """Convert KML data to GeoJSON format."""
    kml_tree = ET.ElementTree(ET.fromstring(kml_data))
    root = kml_tree.getroot()

    ns = {'kml': 'http://www.opengis.net/kml/2.2'}

    geojson_features = []
    for placemark in root.findall('.//kml:Placemark', ns):
        geometry = placemark.find('.//kml:Polygon//kml:coordinates', ns)
        if geometry is not None:
            coordinates = geometry.text.strip().split(' ')
            coords = [[float(coord.split(',')[0]), float(coord.split(',')[1])] for coord in coordinates]
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coords]
                },
                'properties': {
                    'name': placemark.find('.//kml:name', ns).text if placemark.find('.//kml:name', ns) is not None else 'Unnamed'
                }
            }
            geojson_features.append(feature)

    return {
        'type': 'FeatureCollection',
        'features': geojson_features
    }


# Crear un Blueprint para las rutas
routes = Blueprint('routes', __name__)

# Ruta para la página principal
@routes.route('/')
def home():
    return "¡Servidor Flask funcionando!"

# Endpoint para crear usuario
@routes.route('/api/usuario', methods=['POST'])
def crear_usuario():
    data = request.get_json()
    
    if not data or not data.get('nom_us') or not data.get('pass_us') or not data.get('nombre'):
        return jsonify({"msg": "Faltan datos"}), 400
    
    tipo_usuario = TipoUsuario.query.get(data['tipo_us'])
    if not tipo_usuario:
        return jsonify({"msg": "Tipo de usuario no válido"}), 400
    
    hashed_password = generate_password_hash(data['pass_us'], method='pbkdf2:sha256')
    
    nuevo_usuario = Usuario(
        nom_us = data['nom_us'],
        pass_us = hashed_password,
        nombre = data['nombre'],
        cod_productor = data.get('cod_productor'),
        tipo_us = tipo_usuario.id_tipo,
        premium = data.get('premium', False)
    )

    try:
        db.session.add(nuevo_usuario)
        db.session.commit()
        return jsonify(nuevo_usuario.serialize()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al crear el usuario"}), 500

# Endpoint para obtener usuarios
@routes.route('/api/usuarios', methods=['GET'])
def obtener_usuarios():
    usuarios = Usuario.query.all()
    usuarios_serializados = [usuario.serialize() for usuario in usuarios]
    return jsonify(usuarios_serializados), 200

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

# Endpoint para editar usuarios
@routes.route('/api/usuario/<int:id_usuario>', methods=['PUT'])
def actualizar_usuario(id_usuario):
    data = request.get_json()

    if not data:
        return jsonify({"msg": "Faltan datos"}), 400
    
    usuario = Usuario.query.get(id_usuario)
    if not usuario:
        return jsonify({"msg": "Usuario no encontrado"}), 404
    
    # Aplicar hash a la contraseña si está presente en los datos
    if 'pass_us' in data and data['pass_us']:
        data['pass_us'] = generate_password_hash(data['pass_us'], method='pbkdf2:sha256')
    
    # Actualizar solo los campos que vienen en la solicitud
    for key in data:
        if hasattr(usuario, key) and key != 'id_usuario':  # Excluir el ID del usuario
            setattr(usuario, key, data[key])
        
    try:
        db.session.commit()
        return jsonify(usuario.serialize()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar el usuario", "error": str(e)}), 500

#Endpoint para crear el tipo de usuario
@routes.route('/api/tipo_usuario', methods=['POST'])
def crear_tipo_usuario():
    data = request.get_json()
    
    if not data or not data.get('tipo'):
        return jsonify({"msg": "Faltan datos"}), 400
    
    nuevo_tipo_usuario = TipoUsuario(tipo=data['tipo'])
    
    try:
        db.session.add(nuevo_tipo_usuario)
        db.session.commit()
        return jsonify(nuevo_tipo_usuario.serialize()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al crear el tipo de usuario"}), 500

# Endpoint para obtener tipos de usuario
@routes.route('/api/tipo_usuario', methods=['GET'])
def obtener_tipos_usuario():
    tipos_usuario = TipoUsuario.query.all()
    tipos_serializados = [tipo.serialize() for tipo in tipos_usuario]
    return jsonify(tipos_serializados), 200

# Endpoint para editar tipo de usuario
@routes.route('/api/tipo_usuario/<int:id_tipo>', methods=['PUT'])
def actualizar_tipo_usuario(id_tipo):
    tipo_usuario = TipoUsuario.query.get(id_tipo)
    if not tipo_usuario:
        return jsonify({"msg": "Tipo de usuario no encontrado"}), 404
    
    data = request.get_json()

    if not data or not data.get('tipo'):
        return jsonify({"msg": "Faltan datos"}), 400
    
    try:
        tipo_usuario.tipo = data['tipo']
        db.session.commit()
        return jsonify(tipo_usuario.serialize()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar el tipo de usuario"}), 500
    


@routes.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data or not data.get("user") or not data.get("password"):
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

@routes.route('/api/usuarios/productores', methods=['GET'])
def obtener_productores():
    productores = Usuario.query.join(TipoUsuario).filter(TipoUsuario.tipo == 'Productor').all()
    return jsonify(
        [p.serialize() for p in productores]
    ), 200

@routes.route('/api/tipo_archivo', methods=['POST'])
def crear_tipo_archivo():
    data = request.get_json()
    
    if not data or not data.get('tipo'):
        return jsonify({"msg": "Faltan datos"}), 400
    
    nuevo_tipo_archivo = TipoArchivo(tipo=data['tipo'])
    
    try:
        db.session.add(nuevo_tipo_archivo)
        db.session.commit()
        return jsonify(nuevo_tipo_archivo.serialize()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al crear el tipo de archivo"}), 500

@routes.route('/api/tipo_archivo', methods=['GET'])
def obtener_tipos_archivo():
    tipos_archivo = TipoArchivo.query.all()
    tipos_serializados = [tipo.serialize() for tipo in tipos_archivo]
    return jsonify(tipos_serializados), 200

@routes.route('/api/subir_archivo', methods=['POST'])
def subir_archivo():
    print("Llegó una solicitud de subida de archivo.")  # Verifica que la solicitud llegó

    # Verificar si los campos necesarios están presentes en la solicitud
    if 'archivo' not in request.files:
        print("No se ha subido ningún archivo")
        return jsonify({"msg": "No se ha subido ningún archivo"}), 400
    
    archivo = request.files['archivo']
    if 'tipoArchivo' not in request.form or not request.form['tipoArchivo']:
        print("No se ha especificado el tipo de archivo")
        return jsonify({"msg": "No se ha especificado el tipo de archivo"}), 400

    tipo_archivo_id = request.form['tipoArchivo']
    if 'productorId' not in request.form or not request.form['productorId']:
        print("No se ha especificado el productor ID")
        return jsonify({"msg": "No se ha especificado el productor ID"}), 400

    # Usar el productor ID como el cod_productor
    cod_productor = request.form['productorId']
    print(f"Productor código recibido: {cod_productor}")  # Verifica que el productor_id esté siendo recibido correctamente

    # Verificar si el archivo tiene un nombre
    if archivo.filename == '':
        print("No se ha seleccionado ningún archivo")
        return jsonify({"msg": "No se ha seleccionado ningún archivo"}), 400

    # Generar un nombre seguro para el archivo
    filename = secure_filename(archivo.filename)

    # Obtener el productor usando el cod_productor
    productor = Usuario.query.filter_by(cod_productor=cod_productor).first()
    if not productor:
        print("Productor no encontrado")
        return jsonify({"msg": "Productor no encontrado"}), 404

    # Obtener el tipo de archivo desde la base de datos
    tipo_archivo = TipoArchivo.query.filter_by(id_tipo_archivo=tipo_archivo_id).first()
    if not tipo_archivo:
        print("Tipo de archivo no encontrado")
        return jsonify({"msg": "Tipo de archivo no encontrado"}), 404

    tipo_archivo_nombre = tipo_archivo.tipo  # Nombre del tipo de archivo

    # Crear el prefijo para la "carpeta" en S3 usando el cod_productor y tipo de archivo
    ruta_s3 = f"{cod_productor}/{tipo_archivo_nombre}/{filename}"
    print(f"Ruta de S3 generada: {ruta_s3}")  # Verifica la ruta generada

    # Subir el archivo a S3
    mensaje = subir_archivo_a_s3(archivo, ruta_s3)

    # Si la subida a S3 fue exitosa, guardamos la información en la base de datos
    if "exitosamente" in mensaje:
        # Obtener el KML asociado al productor
        kml_asociado = KML.query.filter_by(us_asociado=productor.id_usuario).first()
        if not kml_asociado:
            print("No se ha encontrado un KML asociado al productor.")
            return jsonify({"msg": "No se ha encontrado un KML asociado al productor."}), 400

        # Guardar el archivo y asociarlo al KML
        nuevo_archivo = Archivo(
            nombre=filename,
            ruta_descarga=f'https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/{ruta_s3}',
            us_asociado=productor.id_usuario,  # Usar id_usuario en lugar de productor_id
            TipoArchivo=tipo_archivo_id,
            kml_asociado=kml_asociado.id_kml  # Asocia el archivo al KML
        )
        db.session.add(nuevo_archivo)
        db.session.commit()

        return jsonify({"msg": "Archivo cargado y asociado al KML exitosamente"}), 200
    else:
        return jsonify({"msg": mensaje}), 400




@routes.route('/api/archivos', methods=['GET'])
def listar_archivos():
    # Obtener el productorId de la consulta (en lugar de usar JWT)
    productor_id = request.args.get('productorId')

    if not productor_id:
        return jsonify({'error': 'Productor ID no proporcionado'}), 400

    # Buscar al usuario con el `cod_productor`
    productor = Usuario.query.filter_by(cod_productor=productor_id).first()

    if not productor:
        return jsonify({'error': 'Productor no encontrado'}), 404

    # Obtener los archivos asociados al id_usuario del productor
    archivos = Archivo.query.filter_by(us_asociado=productor.id_usuario).all()
    
    resultado = []
    
    # Serializar los archivos y agregar detalles del tipo de archivo
    for archivo in archivos:
        tipo_archivo = TipoArchivo.query.get(archivo.TipoArchivo)
        archivo_data = archivo.serialize()
        archivo_data['tipo_archivo'] = tipo_archivo.tipo if tipo_archivo else None
        resultado.append(archivo_data)
    
    return jsonify(resultado), 200

@routes.route('/api/productor/archivos', methods=['GET'])
def obtener_archivos_por_productor():
    cod_productor = request.args.get('cod_productor')
    categoria = request.args.get('categoria')

    if not cod_productor:
        return jsonify({'error': 'Productor ID no proporcionado'}), 400
    
    productor = Usuario.query.filter_by(cod_productor=cod_productor).first()
    if not productor:
        return jsonify({'error': 'Productor no encontrado'}), 404
    
    query = Archivo.query.filter_by(us_asociado=productor.id_usuario)
    
    if categoria:
        tipo_archivo = TipoArchivo.query.filter_by(tipo=categoria).first()
        if tipo_archivo:
            query = query.filter_by(TipoArchivo=tipo_archivo.id_tipo_archivo)
    
    archivos = query.all()

    archivos_clasificados = {}

    for archivo in archivos:
        tipo_archivo = TipoArchivo.query.get(archivo.TipoArchivo)
        tipo_nombre = tipo_archivo.tipo if tipo_archivo else 'Desconocido'

        # Extraer la key S3 de la ruta original almacenada
        key_s3 = archivo.ruta_descarga.split(f"https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/")[-1]

        # Generar URL firmada justo ahora (expiración 10 minutos por ejemplo)
        url_firmada = generar_url_firmada(key_s3, expiracion=600)  # 600 segundos = 10 minutos

        archivo_data = archivo.serialize()
        archivo_data['ruta_descarga'] = url_firmada if url_firmada else archivo.ruta_descarga

        archivos_clasificados.setdefault(tipo_nombre, []).append(archivo_data)

    return jsonify({
        'productor': productor.nombre,
        'cod_productor': productor.cod_productor,
        'archivos': archivos_clasificados
    }), 200


@routes.route('/api/eliminar_archivo', methods=['DELETE'])
def eliminar_archivo():
    try:
        # Obtener datos de la solicitud
        data = request.json
        if not data or 'archivo_nombre' not in data:
            return jsonify({"msg": "Nombre de archivo no proporcionado"}), 400

        archivo_nombre = data['archivo_nombre']
        
        # Buscar el archivo en la base de datos por nombre
        archivo = Archivo.query.filter_by(nombre=archivo_nombre).first()
        if not archivo:
            return jsonify({"msg": "Archivo no encontrado"}), 404

        # Ahora puedes acceder a archivo.ruta_descarga
        print("Ruta S3 del archivo:", archivo.ruta_descarga)

        # Obtener el cod_productor de la relación con el usuario
        cod_productor = archivo.usuario.cod_productor

        # Obtener el nombre del tipo de archivo desde la relación con TipoArchivo
        tipo_archivo_nombre = archivo.tipo_archivo.tipo if archivo.tipo_archivo else None

        # Eliminar el archivo de AWS S3
        if not eliminar_archivo_de_s3(archivo.ruta_descarga):  # Ahora pasamos la ruta completa
            return jsonify({"msg": "Error al eliminar archivo de S3"}), 500

        # Eliminar el registro de la base de datos
        db.session.delete(archivo)
        db.session.commit()

        return jsonify({
            "msg": "Archivo y registro eliminados exitosamente",
            "cod_productor": cod_productor,
            "tipo_archivo_nombre": tipo_archivo_nombre
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error interno del servidor: {str(e)}"}), 500
        


@routes.route('/api/subir_kml', methods=['POST'])
def subir_kml():
    print("Llegó una solicitud de subida de archivo KML.")

    # Verificar si los campos necesarios están presentes en la solicitud
    if 'archivo' not in request.files:
        print("No se ha subido ningún archivo KML.")
        return jsonify({"msg": "No se ha subido ningún archivo KML"}), 400
    
    archivo_kml = request.files['archivo'] # Renombrado para mayor claridad
    
    if 'productorId' not in request.form or not request.form['productorId']:
        print("No se ha especificado el productor ID.")
        return jsonify({"msg": "No se ha especificado el productor ID"}), 400

    # Usar el productor ID como el cod_productor
    cod_productor = request.form['productorId']
    print(f"Productor código recibido: {cod_productor}")

    # Verificar si el archivo tiene un nombre
    if archivo_kml.filename == '':
        print("No se ha seleccionado ningún archivo KML.")
        return jsonify({"msg": "No se ha seleccionado ningún archivo KML"}), 400

    # Generar un nombre seguro para el archivo
    filename = secure_filename(archivo_kml.filename)

    # Validar que el archivo sea un KML
    if not filename.lower().endswith('.kml'):
        print("El archivo subido no es un archivo KML.")
        return jsonify({"msg": "El archivo subido no es un archivo KML"}), 400

    # Obtener el productor usando el cod_productor
    productor = Usuario.query.filter_by(cod_productor=cod_productor).first()
    if not productor:
        print("Productor no encontrado.")
        return jsonify({"msg": "Productor no encontrado"}), 404

    # Crear el prefijo para la "carpeta" en S3 usando el cod_productor
    ruta_s3 = f"{cod_productor}/kml/{filename}"
    print(f"Ruta de S3 generada: {ruta_s3}")

    # Leer el contenido del archivo para convertirlo a GeoJSON
    # Es importante que `archivo_kml` esté en la posición inicial para `kml_to_geojson` y `subir_archivo_a_s3`
    kml_data = archivo_kml.read()
    # Una vez leído, el puntero del archivo está al final. Restablecerlo.
    archivo_kml.seek(0) 
    
    geojson_data = kml_to_geojson(kml_data) # Asegúrate de que kml_to_geojson pueda tomar bytes
    print("Conversión de KML a GeoJSON completada.")

    # Subir el archivo KML a S3 (el puntero ya está restablecido)
    mensaje = subir_archivo_a_s3(archivo_kml, ruta_s3)

    # Si la subida a S3 fue exitosa, guardamos/actualizamos la información en la base de datos
    if "exitosamente" in mensaje:
        # **CAMBIO CLAVE AQUÍ:**
        kml_existente = KML.query.filter_by(us_asociado=productor.id_usuario).first()
        
        if kml_existente:
            # Si ya existe un KML, ACTUALIZAMOS su ruta y otros campos si es necesario.
            # NO LO ELIMINAMOS. Esto preserva las relaciones con Archivos.
            print("Ya existe un KML asociado a este productor, lo actualizamos.")
            kml_existente.ruta_archivo = f'https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/{ruta_s3}'
            # Puedes actualizar otros campos del KML si los tienes, por ejemplo:
            # kml_existente.nombre = filename 
        else:
            # Si no existe, creamos un nuevo registro KML.
            print("No existe un KML asociado, creando uno nuevo.")
            nuevo_kml = KML(
                ruta_archivo=f'https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/{ruta_s3}',
                us_asociado=productor.id_usuario
            )
            db.session.add(nuevo_kml)
            
        db.session.commit() # Confirma los cambios (actualización o nueva creación)
        
        return jsonify({
            "msg": "Archivo KML cargado/actualizado exitosamente",
            "geojson": geojson_data
        }), 200
    else:
        return jsonify({"msg": mensaje}), 400

    

from sqlalchemy.orm import subqueryload

@routes.route('/api/productor/kml', methods=['GET'])
def obtener_kml_por_productor():
    # Obtener el código del productor desde los parámetros
    cod_productor = request.args.get('cod_productor')
    
    if not cod_productor:
        return jsonify({'error': 'Código del productor no proporcionado'}), 400

    # Eliminar espacios y caracteres extraños del código
    cod_productor = cod_productor.strip()
    print(f"Valor de cod_productor recibido: {cod_productor}")

    # Buscar el productor en la base de datos
    productor = Usuario.query.filter_by(cod_productor=cod_productor).first()

    if not productor:
        return jsonify({'error': 'Productor no encontrado'}), 404

    # Obtener los KML asociados al productor con los archivos relacionados
    kmls = KML.query.filter_by(us_asociado=productor.id_usuario).options(subqueryload(KML.archivos)).all()

    if not kmls:
        return jsonify({
            'productor': productor.nombre,
            'cod_productor': productor.cod_productor,
            'kmls': []
        }), 200

    # Diagnóstico: Verificar los archivos cargados
    for kml in kmls:
        print(f"KML ID {kml.id_kml} tiene los siguientes archivos asociados:")
        for archivo in kml.archivos:  # Usar los archivos ya cargados por subqueryload
            print(f"- {archivo.nombre}, Ruta de descarga: {archivo.ruta_descarga}")

    # Serializar los datos y enviarlos
    return jsonify({
        'productor': productor.nombre,
        'cod_productor': productor.cod_productor,
        'kmls': [kml.serialize() for kml in kmls]
    }), 200

from flask import Blueprint, jsonify, request, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask_jwt_extended import create_access_token, jwt_required
from models import db, Usuario, TipoUsuario, KML, KMLTaipas, Archivo, TipoArchivo
from s3_service import subir_archivo_a_s3, eliminar_archivo_de_s3, generar_url_firmada
from app_config import Config
import xml.etree.ElementTree as ET
from sqlalchemy.orm import joinedload
import io

# 🔧 Import de Dropbox con alias (para no chocar con listar_archivos de S3)
from dropbox_service import (
    listar_archivos as dbx_listar_archivos,
    subir_archivo as dbx_subir_archivo,
    descargar_archivo as dbx_descargar_archivo,
    mover_archivo as dbx_mover_archivo,
)


def kml_to_geojson(kml_data):
    """Convert KML data to GeoJSON format."""
    kml_tree = ET.ElementTree(ET.fromstring(kml_data))
    root = kml_tree.getroot()

    ns = {'kml': 'http://www.opengis.net/kml/2.2'}

    geojson_features = []
    for placemark in root.findall('.//kml:Placemark', ns):
        geometry = placemark.find('.//kml:Polygon//kml:coordinates', ns)
        if geometry is not None:
            coordinates = geometry.text.strip().split(' ')
            coords = [[float(coord.split(',')[0]), float(coord.split(',')[1])] for coord in coordinates]
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coords]
                },
                'properties': {
                    'name': placemark.find('.//kml:name', ns).text if placemark.find('.//kml:name', ns) is not None else 'Unnamed'
                }
            }
            geojson_features.append(feature)

    return {
        'type': 'FeatureCollection',
        'features': geojson_features
    }


# Crear un Blueprint para las rutas
routes = Blueprint('routes', __name__)

# ------------------ PING ------------------
@routes.route('/')
def home():
    return "¡Servidor Flask funcionando!"

# ------------------ USUARIOS ------------------
@routes.route('/api/usuario', methods=['POST'])
def crear_usuario():
    data = request.get_json()
    if not data or not data.get('nom_us') or not data.get('pass_us') or not data.get('nombre'):
        return jsonify({"msg": "Faltan datos"}), 400

    tipo_usuario = TipoUsuario.query.get(data['tipo_us'])
    if not tipo_usuario:
        return jsonify({"msg": "Tipo de usuario no válido"}), 400

    hashed_password = generate_password_hash(data['pass_us'], method='pbkdf2:sha256')

    nuevo_usuario = Usuario(
        nom_us=data['nom_us'],
        pass_us=hashed_password,
        nombre=data['nombre'],
        cod_productor=data.get('cod_productor'),
        tipo_us=tipo_usuario.id_tipo,
        premium=data.get('premium', False)
    )

    try:
        db.session.add(nuevo_usuario)
        db.session.commit()
        return jsonify(nuevo_usuario.serialize()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al crear el usuario"}), 500

@routes.route('/api/usuarios', methods=['GET'])
def obtener_usuarios():
    usuarios = Usuario.query.all()
    usuarios_serializados = [usuario.serialize() for usuario in usuarios]
    return jsonify(usuarios_serializados), 200

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

@routes.route('/api/usuario/<int:id_usuario>', methods=['PUT'])
def actualizar_usuario(id_usuario):
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Faltan datos"}), 400

    usuario = Usuario.query.get(id_usuario)
    if not usuario:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    if 'pass_us' in data and data['pass_us']:
        data['pass_us'] = generate_password_hash(data['pass_us'], method='pbkdf2:sha256')

    for key in data:
        if hasattr(usuario, key) and key != 'id_usuario':
            setattr(usuario, key, data[key])

    try:
        db.session.commit()
        return jsonify(usuario.serialize()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar el usuario", "error": str(e)}), 500

# ------------------ TIPOS DE USUARIO ------------------
@routes.route('/api/tipo_usuario', methods=['POST'])
def crear_tipo_usuario():
    data = request.get_json()
    if not data or not data.get('tipo'):
        return jsonify({"msg": "Faltan datos"}), 400

    nuevo_tipo_usuario = TipoUsuario(tipo=data['tipo'])
    try:
        db.session.add(nuevo_tipo_usuario)
        db.session.commit()
        return jsonify(nuevo_tipo_usuario.serialize()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al crear el tipo de usuario"}), 500

@routes.route('/api/tipo_usuario', methods=['GET'])
def obtener_tipos_usuario():
    tipos_usuario = TipoUsuario.query.all()
    return jsonify([tipo.serialize() for tipo in tipos_usuario]), 200

@routes.route('/api/tipo_usuario/<int:id_tipo>', methods=['PUT'])
def actualizar_tipo_usuario(id_tipo):
    tipo_usuario = TipoUsuario.query.get(id_tipo)
    if not tipo_usuario:
        return jsonify({"msg": "Tipo de usuario no encontrado"}), 404

    data = request.get_json()
    if not data or not data.get('tipo'):
        return jsonify({"msg": "Faltan datos"}), 400

    try:
        tipo_usuario.tipo = data['tipo']
        db.session.commit()
        return jsonify(tipo_usuario.serialize()), 200
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar el tipo de usuario"}), 500

# ------------------ LOGIN ------------------
@routes.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get("user") or not data.get("password"):
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

# ------------------ TIPOS DE ARCHIVO ------------------
@routes.route('/api/tipo_archivo', methods=['POST'])
def crear_tipo_archivo():
    data = request.get_json()
    if not data or not data.get('tipo'):
        return jsonify({"msg": "Faltan datos"}), 400

    nuevo_tipo_archivo = TipoArchivo(tipo=data['tipo'])
    try:
        db.session.add(nuevo_tipo_archivo)
        db.session.commit()
        return jsonify(nuevo_tipo_archivo.serialize()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al crear el tipo de archivo"}), 500

@routes.route('/api/tipo_archivo', methods=['GET'])
def obtener_tipos_archivo():
    tipos_archivo = TipoArchivo.query.all()
    return jsonify([tipo.serialize() for tipo in tipos_archivo]), 200

# ------------------ ARCHIVOS S3 ------------------
@routes.route('/api/archivos', methods=['GET'])
def listar_archivos_s3():
    productor_id = request.args.get('productorId')
    if not productor_id:
        return jsonify({'error': 'Productor ID no proporcionado'}), 400

    productor = Usuario.query.filter_by(cod_productor=productor_id).first()
    if not productor:
        return jsonify({'error': 'Productor no encontrado'}), 404

    archivos = Archivo.query.filter_by(us_asociado=productor.id_usuario).all()
    resultado = []
    for archivo in archivos:
        tipo_archivo = TipoArchivo.query.get(archivo.TipoArchivo)
        archivo_data = archivo.serialize()
        archivo_data['tipo_archivo'] = tipo_archivo.tipo if tipo_archivo else None
        resultado.append(archivo_data)

    return jsonify(resultado), 200

# ------------------ DROPBOX ------------------
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
