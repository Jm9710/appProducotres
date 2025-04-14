from eralchemy2 import render_er
from models import Base  # Importa el modelo que creamos

# Generar el diagrama en formato PNG
render_er(Base, 'database_schema.png')
