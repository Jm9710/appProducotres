import React, { useState } from "react";

const CargarKml = ({ productorId, onClose }) => {
  const [archivo, setArchivo] = useState(null);
  const [mensaje, setMensaje] = useState("");

  const handleFileChange = (e) => {
    setArchivo(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!archivo) {
      setMensaje("Por favor, selecciona un archivo KML.");
      return;
    }

    const formData = new FormData();
    formData.append("archivo", archivo);
    formData.append("productorId", productorId);
    formData.append("tipoArchivo", 4); // ID del tipo de archivo para KML

    try {
      const response = await fetch("http://127.0.0.1:3001/api/subir_archivo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        setMensaje(data.msg || "Error al subir el archivo.");
        return;
      }

      // Archivo subido con éxito
      setMensaje("Archivo KML cargado con éxito.");
      setTimeout(() => {
        onClose(); // Cerrar el modal
        window.location.reload(); // Recargar Home
      }, 1500); // Esperar 1.5 segundos para que el mensaje sea visible
    } catch (error) {
      setMensaje("Error de red al intentar subir el archivo.");
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
          />
        </div>
        {mensaje && <p className={mensaje.includes("éxito") ? "text-success" : "text-danger"}>{mensaje}</p>}
        <div className="d-flex justify-content-between">
          <button type="submit" className="btn btn-primary">
            Subir Archivo
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </form>
    </div>
  );
};

export default CargarKml;
