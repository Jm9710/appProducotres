import os
import boto3
from app_config import Config
import mimetypes
<<<<<<< HEAD
=======
from io import BytesIO
>>>>>>> temp-backup
from urllib.parse import quote


s3 = boto3.client(
    's3',
    aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
    region_name=Config.S3_REGION,
    endpoint_url=f'https://s3.{Config.S3_REGION}.amazonaws.com'
)

def subir_archivo_a_s3(archivo, nombre_archivo, carpeta=None, return_url=False):
    try:
        # Construir la clave del archivo con el prefijo de carpeta, si se proporciona
        if carpeta:
            nombre_archivo = f"{carpeta}/{nombre_archivo}"

        # Detectar el Content-Type
        content_type, _ = mimetypes.guess_type(nombre_archivo)
        if content_type is None:
            # Por defecto si no se detecta
            content_type = 'application/octet-stream'

<<<<<<< HEAD
=======
        archivo.seek(0, os.SEEK_END)
        upload_size = archivo.tell()
        archivo.seek(0)

>>>>>>> temp-backup
        # Configurar headers extras
        extra_args = {
            'ContentType': content_type,
            'ContentDisposition': f'attachment; filename="{quote(nombre_archivo.split("/")[-1])}"'  # Asegurarse de que el nombre del archivo esté codificado correctamente
        }

        # Subir el archivo con los headers
        s3.upload_fileobj(archivo, Config.S3_BUCKET_NAME, nombre_archivo, ExtraArgs=extra_args)
<<<<<<< HEAD
=======
        print(f"[S3_UPLOAD] key={nombre_archivo} bytes={upload_size} content_type={content_type}")
>>>>>>> temp-backup
        print(f"Archivo {nombre_archivo} subido exitosamente a S3 con Content-Type {content_type}")

        if return_url:
            url = f"https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/{nombre_archivo}"
            return f"Archivo {nombre_archivo} subido exitosamente", url

        return f"Archivo {nombre_archivo} subido exitosamente"

    except Exception as e:
        print(f"Error al subir archivo a S3: {e}")
        if return_url:
            return f"Error al subir archivo a S3: {e}", None
        return f"Error al subir archivo a S3: {e}"
    

def generar_url_firmada(ruta_s3, expiracion=3600):
    try:
        content_type, _ = mimetypes.guess_type(ruta_s3)
        if content_type is None:
            content_type = 'application/octet-stream'
<<<<<<< HEAD
=======
        if ruta_s3.lower().endswith('.zip'):
            content_type = 'application/zip'

        try:
            head = s3.head_object(Bucket=Config.S3_BUCKET_NAME, Key=ruta_s3)
            print(
                "[S3_SIGN] "
                f"key={ruta_s3} "
                f"bytes={head.get('ContentLength')} "
                f"stored_content_type={head.get('ContentType')} "
                f"response_content_type={content_type}"
            )
        except Exception as head_error:
            print(f"[S3_SIGN] No se pudo leer metadata de {ruta_s3}: {head_error}")
>>>>>>> temp-backup

        url = s3.generate_presigned_url(
            ClientMethod='get_object',
            Params={
                'Bucket': Config.S3_BUCKET_NAME,
                'Key': ruta_s3,
                'ResponseContentDisposition': f'attachment; filename="{os.path.basename(ruta_s3)}"',
                'ResponseContentType': content_type,
            },
            ExpiresIn=expiracion
        )

        print("URL firmada generada:", url)  # Aquí verificas la URL

        return url
    except Exception as e:
        print(f"Error generando URL firmada: {e}")
        return None

<<<<<<< HEAD
=======
def descargar_archivo_de_s3(ruta_s3):
    try:
        content_type, _ = mimetypes.guess_type(ruta_s3)
        if content_type is None:
            content_type = 'application/octet-stream'
        if ruta_s3.lower().endswith('.zip'):
            content_type = 'application/zip'

        response = s3.get_object(Bucket=Config.S3_BUCKET_NAME, Key=ruta_s3)
        data = response['Body'].read()
        buffer = BytesIO(data)
        buffer.seek(0)

        metadata = {
            'key': ruta_s3,
            'filename': os.path.basename(ruta_s3),
            'content_type': content_type,
            's3_content_type': response.get('ContentType'),
            'content_length': len(data),
            's3_content_length': response.get('ContentLength'),
        }
        print(
            "[S3_DOWNLOAD] "
            f"key={metadata['key']} "
            f"bytes={metadata['content_length']} "
            f"s3_bytes={metadata['s3_content_length']} "
            f"content_type={metadata['content_type']} "
            f"s3_content_type={metadata['s3_content_type']}"
        )
        return buffer, metadata
    except Exception as e:
        print(f"Error descargando archivo de S3: {e}")
        return None, None

>>>>>>> temp-backup
def eliminar_archivo_de_s3(ruta_completa_s3):
    try:
        print(f"Intentando eliminar el archivo: {ruta_completa_s3} del bucket: {Config.S3_BUCKET_NAME}")

        # Asegurarse de que solo enviamos la ruta correcta (clave), no la URL completa
        # Extraer la clave del archivo de la URL completa
        if ruta_completa_s3.startswith(f"https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/"):
            clave = ruta_completa_s3[len(f"https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/"):]
        else:
            clave = ruta_completa_s3  # Si la URL no es completa, asumir que ya está en la forma correcta

        # Verifica si la clave está correctamente formateada
        print(f"Clave del archivo a eliminar: {clave}")

        # Eliminar el archivo de S3
        response = s3.delete_object(Bucket=Config.S3_BUCKET_NAME, Key=clave)
        print(f"Respuesta de S3: {response}")
        
        print(f"Archivo eliminado exitosamente: {ruta_completa_s3}")
        return True
    except Exception as e:
        print(f"Error al eliminar archivo de S3: {e}")
        return False



<<<<<<< HEAD

=======
>>>>>>> temp-backup
