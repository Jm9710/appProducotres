import os
import boto3
from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError
from app_config import Config
import mimetypes
from io import BytesIO
from urllib.parse import quote
import re


SENSITIVE_ERROR_CODES = {
    'InvalidAccessKeyId': (503, 'Credenciales AWS invalidas o revocadas'),
    'SignatureDoesNotMatch': (503, 'Firma AWS invalida. Revisar secret key, region y reloj del servidor'),
    'AccessDenied': (403, 'Acceso denegado al archivo en S3'),
    'NoSuchKey': (404, 'Archivo no encontrado en S3'),
    'NoSuchBucket': (404, 'Bucket S3 no encontrado'),
}


class S3ServiceError(Exception):
    def __init__(self, message, status_code=500, aws_code=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.aws_code = aws_code


def _create_s3_client():
    client_kwargs = {
        'region_name': Config.S3_REGION,
    }

    if Config.AWS_ACCESS_KEY_ID and Config.AWS_SECRET_ACCESS_KEY:
        client_kwargs['aws_access_key_id'] = Config.AWS_ACCESS_KEY_ID
        client_kwargs['aws_secret_access_key'] = Config.AWS_SECRET_ACCESS_KEY

    if Config.S3_REGION:
        client_kwargs['endpoint_url'] = f'https://s3.{Config.S3_REGION}.amazonaws.com'

    return boto3.client('s3', **client_kwargs)


s3 = _create_s3_client()


def _log_s3_client_error(action, error, key=None):
    response = getattr(error, 'response', {}) or {}
    error_data = response.get('Error', {}) or {}
    metadata = response.get('ResponseMetadata', {}) or {}
    aws_code = error_data.get('Code')
    http_status = metadata.get('HTTPStatusCode')

    print(
        "[S3_ERROR] "
        f"action={action} "
        f"bucket={Config.S3_BUCKET_NAME} "
        f"key={key or ''} "
        f"aws_code={aws_code} "
        f"http_status={http_status} "
        f"request_id={metadata.get('RequestId', '')}"
    )

    status_code, message = SENSITIVE_ERROR_CODES.get(
        aws_code,
        (500, 'Error al acceder al archivo en S3')
    )
    return S3ServiceError(message, status_code=status_code, aws_code=aws_code)


def _sanitize_log_value(value):
    text = str(value)
    text = re.sub(r'(AWSAccessKeyId=)[^&\s]+', r'\1[REDACTED]', text)
    text = re.sub(r'(X-Amz-Credential=)[^&\s]+', r'\1[REDACTED]', text)
    text = re.sub(r'(X-Amz-Signature=)[^&\s]+', r'\1[REDACTED]', text)
    text = re.sub(r'(Signature=)[^&\s]+', r'\1[REDACTED]', text)
    text = re.sub(r'AKIA[0-9A-Z]{16}', '[REDACTED_AWS_KEY]', text)
    text = re.sub(r'ASIA[0-9A-Z]{16}', '[REDACTED_AWS_KEY]', text)
    return text


def _log_s3_unexpected_error(action, error, key=None):
    print(
        "[S3_ERROR] "
        f"action={action} "
        f"bucket={Config.S3_BUCKET_NAME} "
        f"key={key or ''} "
        f"error_type={type(error).__name__} "
        f"error={_sanitize_log_value(error)}"
    )
    return S3ServiceError('Error inesperado al acceder a S3', status_code=500)

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

        archivo.seek(0, os.SEEK_END)
        upload_size = archivo.tell()
        archivo.seek(0)

        # Configurar headers extras
        extra_args = {
            'ContentType': content_type,
            'ContentDisposition': f'attachment; filename="{quote(nombre_archivo.split("/")[-1])}"'  # Asegurarse de que el nombre del archivo esté codificado correctamente
        }

        # Subir el archivo con los headers
        s3.upload_fileobj(archivo, Config.S3_BUCKET_NAME, nombre_archivo, ExtraArgs=extra_args)
        print(f"[S3_UPLOAD] key={nombre_archivo} bytes={upload_size} content_type={content_type}")
        print(f"Archivo {nombre_archivo} subido exitosamente a S3 con Content-Type {content_type}")

        if return_url:
            url = f"https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/{nombre_archivo}"
            return f"Archivo {nombre_archivo} subido exitosamente", url

        return f"Archivo {nombre_archivo} subido exitosamente"

    except Exception as e:
        print(f"Error al subir archivo a S3: {type(e).__name__}")
        if return_url:
            return "Error al subir archivo a S3", None
        return "Error al subir archivo a S3"
    

def generar_url_firmada(ruta_s3, expiracion=3600):
    try:
        content_type, _ = mimetypes.guess_type(ruta_s3)
        if content_type is None:
            content_type = 'application/octet-stream'
        if ruta_s3.lower().endswith('.zip'):
            content_type = 'application/zip'

        head = s3.head_object(Bucket=Config.S3_BUCKET_NAME, Key=ruta_s3)
        print(
            "[S3_SIGN] "
            f"bucket={Config.S3_BUCKET_NAME} "
            f"key={ruta_s3} "
            f"bytes={head.get('ContentLength')} "
            f"stored_content_type={head.get('ContentType')} "
            f"response_content_type={content_type} "
            f"expires_in={expiracion}"
        )

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

        print(f"[S3_SIGN] presigned_url_created key={ruta_s3} expires_in={expiracion}")

        return url
    except ClientError as e:
        _log_s3_client_error('generate_presigned_url', e, ruta_s3)
        return None
    except Exception as e:
        _log_s3_unexpected_error('generate_presigned_url', e, ruta_s3)
        return None

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
    except ClientError as e:
        raise _log_s3_client_error('get_object', e, ruta_s3)
    except (NoCredentialsError, PartialCredentialsError) as e:
        print(
            "[S3_ERROR] "
            f"action=get_object bucket={Config.S3_BUCKET_NAME} key={ruta_s3} "
            f"error_type={type(e).__name__}"
        )
        raise S3ServiceError('Credenciales AWS no configuradas correctamente', status_code=503)
    except Exception as e:
        raise _log_s3_unexpected_error('get_object', e, ruta_s3)

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

