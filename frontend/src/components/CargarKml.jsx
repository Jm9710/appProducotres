import React, { useState } from "react";

const CargarKml = ({ productorId, onClose, onUploaded }) => {
  const [archivo, setArchivo] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const apiUrl = "https://appproducotres-backend.onrender.com/"

  //const apiUrl = "http://192.168.1.246:3001/";
  //const apiUrl = "http://192.168.88.193:3001/";
  const handleFileChange = (e) => {
    setMensaje("");
    setArchivo(e.target.files?.[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");

    if (!archivo) {
      setMensaje("Por favor, selecciona un archivo KML.");
      return;
    }

    if (!productorId) {
      setMensaje("Por favor, selecciona un productor antes de subir el KML.");
      return;
    }

    const formData = new FormData();
    formData.append("archivo", archivo);
    formData.append("tipoArchivo", 4); // 4 corresponde a KML
    formData.append("productorId", productorId);

    setIsUploading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${apiUrl}api/subir_kml`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      const text = await response.text();
      let data = {};

      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Respuesta inesperada del servidor: ${text.slice(0, 200)}`);
        }
      }

      if (response.ok) {
        await onUploaded?.(data);
        return;
      } else {
        setMensaje(data.msg || data.error || "Error al subir el archivo.");
      }
    } catch (error) {
      setMensaje(error.message || "Error de red al intentar subir el archivo.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="archivo" className="form-label">
            Selecciona un archivo KML:
          </label>
          <input
            type="file"
            className="form-control"
            id="archivo"
            accept=".kml"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </div>
        {mensaje && <p className="text-danger">{mensaje}</p>}
        <div className="d-flex justify-content-between">
          <button type="submit" className="btn btn-primary" disabled={isUploading}>
            {isUploading ? "Subiendo..." : "Subir Archivo"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isUploading}
          >
            Cerrar
          </button>
        </div>
      </form>
    </div>
  );
};

export default CargarKml;
