from flask import Flask
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView
from models import db, Usuario, TipoUsuario, KML, KMLTaipas, Archivo, TipoArchivo

# Configuración del panel de administración
def setup_admin(app):
    admin = Admin(app, name="Panel de Administración", template_mode="bootstrap4")

    # Agregar modelos al panel de administración
    admin.add_view(ModelView(Usuario, db.session))
    admin.add_view(ModelView(TipoUsuario, db.session))
    admin.add_view(ModelView(KML, db.session))
    admin.add_view(ModelView(KMLTaipas, db.session))
    admin.add_view(ModelView(Archivo, db.session))
    admin.add_view(ModelView(TipoArchivo, db.session))

    return admin

