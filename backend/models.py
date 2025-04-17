from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy() 

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id_usuario = Column(Integer, primary_key=True, autoincrement=True)
    nom_us = Column(String(100), nullable=False, unique=True)
    pass_us = Column(String(255), nullable=False)
    nombre = Column(String(100), nullable=False)
    cod_productor = Column(String(50), nullable=True)
    tipo_us = Column(Integer, ForeignKey('tipo_usuarios.id_tipo'), nullable=False)
    premium = Column(Boolean, default=False)
    
    kmls = relationship("KML", back_populates="usuario")
    kml_taipas = relationship("KMLTaipas", back_populates="usuario")
    archivos = relationship("Archivo", back_populates="usuario")

    def serialize(self):
        return {
            'id_usuario': self.id_usuario,
            'nom_us': self.nom_us,
            'nombre': self.nombre,
            'cod_productor': self.cod_productor,
            'tipo_us': self.tipo_us,
            'premium': self.premium
        }

class TipoUsuario(db.Model):
    __tablename__ = 'tipo_usuarios'
    id_tipo = Column(Integer, primary_key=True, autoincrement=True)
    tipo = Column(String(50), nullable=False)
    
    usuarios = relationship("Usuario", backref="tipo_usuario")

    def serialize(self):
        return {
            'id_tipo': self.id_tipo,
            'tipo': self.tipo
        }

class KML(db.Model):
    __tablename__ = 'kml'
    id_kml = Column(Integer, primary_key=True, autoincrement=True)
    ruta_archivo = Column(String(255), nullable=False)
    fecha_subida = Column(DateTime, default=datetime.utcnow)
    us_asociado = Column(Integer, ForeignKey('usuarios.id_usuario'), nullable=False)
    
    usuario = relationship("Usuario", back_populates="kmls")
    archivos = relationship("Archivo", back_populates="kml", lazy='joined')

    def serialize(self):
        return {
            'id_kml': self.id_kml,
            'ruta_archivo': self.ruta_archivo,
            'fecha_subida': self.fecha_subida,
            'us_asociado': self.us_asociado,
            'archivos': [archivo.serialize() for archivo in self.archivos]
        }

class KMLTaipas(db.Model):
    __tablename__ = 'kml_taipas'
    id_kml_taipas = Column(Integer, primary_key=True, autoincrement=True)
    ruta_archivo = Column(String(255), nullable=False)
    fecha_subida = Column(DateTime, default=datetime.utcnow)
    us_asociado = Column(Integer, ForeignKey('usuarios.id_usuario'), nullable=False)
    
    usuario = relationship("Usuario", back_populates="kml_taipas")
    archivos = relationship("Archivo", back_populates="kml_taipas")

    def serialize(self):
        return {
            'id_kml_taipas': self.id_kml_taipas,
            'ruta_archivo': self.ruta_archivo,
            'fecha_subida': self.fecha_subida,
            'us_asociado': self.us_asociado
        }
class Archivo(db.Model):
    __tablename__ = 'archivos'
    id_archivo = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(255), nullable=False)
    disponible = Column(Boolean, default=True)
    ruta_descarga = Column(String(255), nullable=False)
    fecha_subida = Column(DateTime, default=datetime.utcnow)
    us_asociado = Column(Integer, ForeignKey('usuarios.id_usuario'), nullable=False)
    kml_asociado = Column(Integer, ForeignKey('kml.id_kml'), nullable=True)
    kml_taipas_asociado = Column(Integer, ForeignKey('kml_taipas.id_kml_taipas'), nullable=True)
    TipoArchivo = Column(Integer, ForeignKey('tipo_archivos.id_tipo_archivo'), nullable=False)
    
    usuario = relationship("Usuario", back_populates="archivos")
    kml = relationship("KML", back_populates="archivos")
    kml_taipas = relationship("KMLTaipas", back_populates="archivos")

    def serialize(self):
        return {
            'id_archivo': self.id_archivo,
            'nombre': self.nombre,
            'disponible': self.disponible,
            'ruta_descarga': self.ruta_descarga,
            'fecha_subida': self.fecha_subida,
            'us_asociado': self.us_asociado,
            'kml_asociado': self.kml_asociado,
            'kml_taipas_asociado': self.kml_taipas_asociado
        }


class TipoArchivo(db.Model):
    __tablename__ = 'tipo_archivos'
    id_tipo_archivo = Column(Integer, primary_key=True, autoincrement=True)
    tipo = Column(String(50), nullable=False)
    
    archivos = relationship("Archivo", backref="tipo_archivo")

    def serialize(self):
        return {
            'id_tipo_archivo': self.id_tipo_archivo,
            'tipo': self.tipo
        }