import React, { useState } from "react";

const CargarKml = ({ productorId, onClose }) => {
  const [archivo, setArchivo] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [geojsonData, setGeojsonData] = useState(null);
  const apiUrl = "http://192.168.1.246:3001/";
  //const apiUrl = "http://192.168.1.65:3001/";
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
    formData.append("tipoArchivo", 4); // 4 corresponde a KML
    formData.append("productorId", productorId);

    try {
      const response = await fetch(`${apiUrl}api/subir_kml`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje("Archivo KML cargado con éxito.");
        setGeojsonData(data.geojson); // Obtén el GeoJSON para usarlo en el mapa
        // Recargar la página principal (Home)
        window.location.reload(); // Recarga la página
      } else {
        setMensaje(data.msg || "Error al subir el archivo.");
      }
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
        {mensaje && <p className="text-danger">{mensaje}</p>}
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
