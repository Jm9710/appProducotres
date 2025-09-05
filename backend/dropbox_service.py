# dropbox_service.py
import os
import io
import posixpath
import dropbox
from dropbox.files import WriteMode, FileMetadata, FolderMetadata, CreateFolderError
from dropbox.exceptions import ApiError
from dotenv import load_dotenv

load_dotenv()

# --- Preferir refresh token (tokens de corta duración se renuevan solos) ---
APP_KEY = os.getenv("DROPBOX_APP_KEY")
APP_SECRET = os.getenv("DROPBOX_APP_SECRET")
REFRESH_TOKEN = os.getenv("DROPBOX_REFRESH_TOKEN")
ACCESS_TOKEN = os.getenv("DROPBOX_ACCESS_TOKEN")  # fallback

if REFRESH_TOKEN and APP_KEY and APP_SECRET:
    dbx = dropbox.Dropbox(
        oauth2_refresh_token=REFRESH_TOKEN,
        app_key=APP_KEY,
        app_secret=APP_SECRET,
    )
elif ACCESS_TOKEN:
    # OJO: si es de corta duración, puede expirar (mejor configurar refresh)
    dbx = dropbox.Dropbox(ACCESS_TOKEN)
else:
    raise ValueError(
        "Configura DROPBOX_REFRESH_TOKEN + DROPBOX_APP_KEY + DROPBOX_APP_SECRET "
        "o bien un DROPBOX_ACCESS_TOKEN válido en tu .env"
    )

# =========================
# Helpers internos
# =========================
def _norm(p: str) -> str:
    """Normaliza rutas Dropbox: inicia con '/', colapsa '//' y remueve slash final (excepto '/')"""
    if not p:
        return "/"
    p = p.strip()
    if not p.startswith("/"):
        p = "/" + p
    while "//" in p:
        p = p.replace("//", "/")
    if len(p) > 1 and p.endswith("/"):
        p = p[:-1]
    return p

def _parent_dir(p: str) -> str:
    p = _norm(p)
    return posixpath.dirname(p) or "/"

def _ensure_folder(folder_path: str):
    """Crea recursivamente las carpetas necesarias (si no existen). Idempotente."""
    folder_path = _norm(folder_path)
    if folder_path == "/":
        return
    parts = folder_path.strip("/").split("/")
    cur = ""
    for part in parts:
        cur = _norm(cur + "/" + part)
        try:
            dbx.files_get_metadata(cur)
        except ApiError:
            try:
                dbx.files_create_folder_v2(cur)
            except ApiError as e2:
                # si ya existe por condición de carrera, ignorar
                err = getattr(e2, "error", None)
                if not (err and err.is_path() and err.get_path().is_conflict()):
                    raise

# =========================
# API que usás en Flask
# =========================
def listar_archivos(folder_path: str = ""):
    """
    Lista archivos de una carpeta de Dropbox (no recursivo).
    Retorna lista de dicts: { name, path, type, size?, server_modified? }
    """
    try:
        folder_path = _norm(folder_path or "/")
        result = dbx.files_list_folder(folder_path)

        items = []
        def _to_item(e):
            base = {
                "name": e.name,
                "path": getattr(e, "path_lower", None) or getattr(e, "path_display", None),
                "type": type(e).__name__,  # FileMetadata | FolderMetadata
            }
            if isinstance(e, FileMetadata):
                base["size"] = e.size
                base["server_modified"] = e.server_modified.isoformat() if e.server_modified else None
            return base

        items.extend([_to_item(e) for e in result.entries])

        while result.has_more:
            result = dbx.files_list_folder_continue(result.cursor)
            items.extend([_to_item(e) for e in result.entries])

        return items
    except ApiError as e:
        return {"error": f"Dropbox API error en listar_archivos: {e}"}
    except Exception as e:
        return {"error": f"Error en listar_archivos: {str(e)}"}

def subir_archivo(file_storage, path: str):
    """
    Sube el contenido de file_storage (werkzeug) a 'path' (ruta completa en Dropbox).
    Crea las carpetas destino si no existen. Usa upload por sesión si >150MB.
    """
    try:
        path = _norm(path)
        _ensure_folder(_parent_dir(path))

        stream = file_storage.stream if hasattr(file_storage, "stream") else io.BytesIO(file_storage.read())
        stream.seek(0, io.SEEK_END)
        size = stream.tell()
        stream.seek(0)

        CHUNK_SIZE = 8 * 1024 * 1024  # 8MB
        if size <= 150 * 1024 * 1024:
            dbx.files_upload(stream.read(), path, mode=WriteMode("overwrite"))
        else:
            upload_session_start_result = dbx.files_upload_session_start(stream.read(CHUNK_SIZE))
            cursor = dropbox.files.UploadSessionCursor(
                session_id=upload_session_start_result.session_id,
                offset=stream.tell()
            )
            commit = dropbox.files.CommitInfo(path=path, mode=WriteMode("overwrite"))
            while stream.tell() < size:
                if (size - stream.tell()) <= CHUNK_SIZE:
                    dbx.files_upload_session_finish(stream.read(CHUNK_SIZE), cursor, commit)
                else:
                    dbx.files_upload_session_append_v2(stream.read(CHUNK_SIZE), cursor)
                    cursor.offset = stream.tell()

        return {"msg": f"Archivo {path} subido con éxito"}
    except ApiError as e:
        return {"error": f"Dropbox API error en subir_archivo: {e}"}
    except Exception as e:
        return {"error": f"Error en subir_archivo: {str(e)}"}

def descargar_archivo(path: str):
    """
    Devuelve (bytes, filename) o (None, 'mensaje de error')
    """
    try:
        path = _norm(path)
        metadata, res = dbx.files_download(path)
        return res.content, metadata.name
    except ApiError as e:
        return None, f"Dropbox API error en descargar_archivo: {e}"
    except Exception as e:
        return None, f"Error en descargar_archivo: {str(e)}"

def mover_archivo(from_path: str, to_path: str):
    """
    Mueve un archivo. Crea la carpeta destino si no existe.
    """
    try:
        from_path = _norm(from_path)
        to_path = _norm(to_path)
        _ensure_folder(_parent_dir(to_path))
        dbx.files_move_v2(from_path, to_path, autorename=True)
        return {"msg": f"Archivo movido de {from_path} a {to_path}"}
    except ApiError as e:
        return {"error": f"Dropbox API error en mover_archivo: {e}"}
    except Exception as e:
        return {"error": f"Error en mover_archivo: {str(e)}"}
