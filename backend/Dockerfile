# Usa una imagen base de Python
FROM python:3.12.3

# Actualiza e instala las dependencias necesarias del sistema
RUN apt-get update && apt-get install -y \
    libpq-dev \
    pkg-config \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Establece el directorio de trabajo en el contenedor
WORKDIR /app

# Copia el archivo requirements.txt al contenedor
COPY requirements.txt .

# Instala las dependencias desde requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copia el resto del código del backend al contenedor
COPY . .

# Exponer el puerto en el que corre la aplicación Flask
EXPOSE 3001

# Comando por defecto para iniciar la aplicac
CMD ["python", "app.py"]