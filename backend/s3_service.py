import os
import boto3
from config import Config

s3 = boto3.client(
    's3',
    aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
    region_name=Config.S3_REGION
)

def subir_archivo_a_s3(archivo, nombre_archivo, carpeta=None, return_url=False):
    try:
        # Construir la clave del archivo con el prefijo de carpeta, si se proporciona
        if carpeta:
            nombre_archivo = f"{carpeta}/{nombre_archivo}"
        
        # Subir el archivo a S3
        s3.upload_fileobj(archivo, Config.S3_BUCKET_NAME, nombre_archivo)
        print(f"Archivo {nombre_archivo} subido exitosamente a S3")

        if return_url:
            url = f"https://{Config.S3_BUCKET_NAME}.s3.{Config.S3_REGION}.amazonaws.com/{nombre_archivo}"
            return f"Archivo {nombre_archivo} subido exitosamente", url

        return f"Archivo {nombre_archivo} subido exitosamente"

    except Exception as e:
        print(f"Error al subir archivo a S3: {e}")
        if return_url:
            return f"Error al subir archivo a S3: {e}", None
        return f"Error al subir archivo a S3: {e}"
    
def obtener_url_presignada(carpeta_productor, archivo_nombre):
    # Ruta completa del archivo en S3
    ruta_archivo_s3 = f"{carpeta_productor}/{archivo_nombre}"

    # Generar la URL presignada
    presigned_url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': Config.S3_BUCKET_NAME, 'Key': ruta_archivo_s3},
        ExpiresIn=3600  # 1 hora de validez
    )

    return presigned_url

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




