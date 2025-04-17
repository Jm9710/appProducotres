from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask_jwt_extended import create_access_token, jwt_required
from models import db, Usuario, TipoUsuario, KML, KMLTaipas, Archivo, TipoArchivo
from s3_service import subir_archivo_a_s3, eliminar_archivo_de_s3
from config import Config
import xml.etree.ElementTree as ET
from sqlalchemy.orm import joinedload



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

# Endpoint para editar usuarios
@routes.route('/api/usuario/<int:id_usuario>', methods=['PUT'])
def actualizar_usuario(id_usuario):
    data = request.get_json()

    if not data or not any(
        key in data for key in ['nom_us', 'pass_us', 'nombre', 'tipo_us', 'premium']
    ):
        return jsonify({"msg": "Faltan datos"}), 400
    
    usuario = Usuario.query.get(id_usuario)
    if not usuario:
        return jsonify({"msg": "Usuario no encontrado"}), 404
    
    for key in data:
        if hasattr(usuario, key):
            setattr(usuario, key, data[key])
        
    try:
        db.session.commit()
        return jsonify(usuario.serialize()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar el usuario"}), 500

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
        nuevo_archivo = Archivo(
            nombre=filename,
            ruta_descarga=f'https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/{ruta_s3}',
            us_asociado=productor.id_usuario,  # Usar id_usuario en lugar de productor_id
            TipoArchivo=tipo_archivo_id
        )
        db.session.add(nuevo_archivo)
        db.session.commit()

        return jsonify({"msg": "Archivo cargado exitosamente"}), 200
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
    categoria = request.args.get('categoria')  # Nuevo parámetro

    if not cod_productor:
        return jsonify({'error': 'Productor ID no proporcionado'}), 400
    
    productor = Usuario.query.filter_by(cod_productor=cod_productor).first()

    if not productor:
        return jsonify({'error': 'Productor no encontrado'}), 404
    
    # Filtrar por tipo de archivo si se especifica categoría
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
        if tipo_nombre not in archivos_clasificados:
            archivos_clasificados[tipo_nombre] = []
        archivos_clasificados[tipo_nombre].append(archivo.serialize())

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
    print("Llegó una solicitud de subida de archivo KML.")  # Verifica que la solicitud llegó

    # Verificar si los campos necesarios están presentes en la solicitud
    if 'archivo' not in request.files:
        print("No se ha subido ningún archivo")
        return jsonify({"msg": "No se ha subido ningún archivo"}), 400
    
    archivo = request.files['archivo']
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

    # Validar que el archivo sea un KML
    if not filename.lower().endswith('.kml'):
        print("El archivo subido no es un archivo KML")
        return jsonify({"msg": "El archivo subido no es un archivo KML"}), 400

    # Obtener el productor usando el cod_productor
    productor = Usuario.query.filter_by(cod_productor=cod_productor).first()
    if not productor:
        print("Productor no encontrado")
        return jsonify({"msg": "Productor no encontrado"}), 404

    # Crear el prefijo para la "carpeta" en S3 usando el cod_productor
    ruta_s3 = f"{cod_productor}/kml/{filename}"
    print(f"Ruta de S3 generada: {ruta_s3}")  # Verifica la ruta generada

    # Leer el contenido del archivo para convertirlo a GeoJSON
    kml_data = archivo.read()
    geojson_data = kml_to_geojson(kml_data)
    print("Conversión de KML a GeoJSON completada.")  # Verifica la conversión

    # Subir el archivo a S3
    archivo.seek(0)  # Restablecer el puntero del archivo antes de subirlo
    mensaje = subir_archivo_a_s3(archivo, ruta_s3)

    # Si la subida a S3 fue exitosa, guardamos la información en la base de datos
    if "exitosamente" in mensaje:
        nuevo_kml = KML(
            ruta_archivo=f'https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/{ruta_s3}',
            us_asociado=productor.id_usuario  # Usar id_usuario del productor
        )
        db.session.add(nuevo_kml)
        db.session.commit()

        return jsonify({
            "msg": "Archivo KML cargado exitosamente",
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






    


