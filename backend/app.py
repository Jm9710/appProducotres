import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import datetime
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash  # 🔹 Se corrigió el typo
from models import db
from admin import setup_admin
from app_routes import routes
from app_config import Config


# Cargar variables de entorno
load_dotenv()



# Configurar Flask
app = Flask(__name__)
CORS(app)


# Configuración de la base de datos
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')

# AWS
app.config.from_object(Config)

# Inicializar extensiones con la app
db.init_app(app)  # 🔹 Se usa init_app() en lugar de crear otra instancia de db
migrate = Migrate(app, db)
jwt = JWTManager(app)
setup_admin(app)

# Registrar las rutas
app.register_blueprint(routes)



if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=True, port=3001)
