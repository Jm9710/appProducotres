import React, { useState } from 'react';

const CargarArchivos = ({ productorId, tiposArchivo }) => {
  const [archivo, setArchivo] = useState(null);
  const [tipoArchivo, setTipoArchivo] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const apiUrl = "http://127.0.0.1:3001/";

  const handleFileChange = (e) => {
    setArchivo(e.target.files[0]);
  };

  const handleTipoArchivoChange = (e) => {
    setTipoArchivo(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!archivo || !tipoArchivo) {
      alert('Debe seleccionar un archivo y un tipo de archivo.');
      return;
    }

    setIsUploading(true);

    try {
      const token = localStorage.getItem("token");

      const formData = new FormData();
      formData.append('archivo', archivo);
      formData.append('tipoArchivo', tipoArchivo);
      formData.append('productorId', productorId);

      const response = await fetch(`${apiUrl}api/subir_archivo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.msg || 'Error desconocido del servidor');
      }

      alert('Archivo cargado exitosamente.');
      
       // Recargar la página principal (Home)
    window.location.reload(); // Recarga la página

    } catch (error) {
      alert(`Error al cargar el archivo: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <h4>Cargar Archivos</h4>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="fileInput" className="form-label">Seleccionar archivo</label>
          <input
            type="file"
            className="form-control"
            id="fileInput"
            onChange={handleFileChange}
          />
        </div>

        <div className="mb-3">
          <label htmlFor="tipoArchivo" className="form-label">Tipo de archivo</label>
          <select
            className="form-select"
            id="tipoArchivo"
            value={tipoArchivo}
            onChange={handleTipoArchivoChange}
          >
            <option value="">Seleccionar tipo de archivo</option>
            {(Array.isArray(tiposArchivo) ? tiposArchivo : []).map((tipo) => (
              <option key={tipo.id_tipo_archivo} value={tipo.id_tipo_archivo}>
                {tipo.tipo}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-primary" disabled={isUploading}>
          {isUploading ? 'Subiendo...' : 'Subir archivo'}
        </button>
      </form>
    </div>
  );
};

export default CargarArchivos;
