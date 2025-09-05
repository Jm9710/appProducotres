# get_refresh_token.py
import os, dropbox
APP_KEY = os.getenv("DROPBOX_APP_KEY") or input("APP_KEY: ").strip()
APP_SECRET = os.getenv("DROPBOX_APP_SECRET") or input("APP_SECRET: ").strip()

auth_flow = dropbox.DropboxOAuth2FlowNoRedirect(
    APP_KEY, APP_SECRET, token_access_type="offline"
)
authorize_url = auth_flow.start()
print("1) Abrí esta URL y autorizá la app:\n", authorize_url)
print("2) Pegá acá el código que te da Dropbox:")
code = input("CODE: ").strip()

oauth_result = auth_flow.finish(code)
print("\nREFRESH TOKEN:\n", oauth_result.refresh_token)
print("\nACCESS TOKEN (corto, se renueva solo con el refresh):\n", oauth_result.access_token)
