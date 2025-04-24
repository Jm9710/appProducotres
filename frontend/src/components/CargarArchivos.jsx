import React, { useState, useEffect } from 'react'; // Añade useEffect aquí

const CargarArchivos = ({ productorId, tiposArchivo, archivosPrecargados = [], onBack }) => {
  const [archivos, setArchivos] = useState([]);
  const [tipoArchivo, setTipoArchivo] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const apiUrl = "http://192.168.1.246:3001/";
  //const apiUrl = "http://192.168.1.65:3001/";
  // Carga inicial de archivos arrastrados
  useEffect(() => {
    if (archivosPrecargados.length > 0) {
      setArchivos(archivosPrecargados);
    }
  }, [archivosPrecargados]);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setArchivos(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      const token = localStorage.getItem("token");
      
      for (const file of archivos) {
        const formData = new FormData();
        formData.append('archivo', file);
        formData.append('tipoArchivo', tipoArchivo);
        formData.append('productorId', productorId);

        const response = await fetch(`${apiUrl}api/subir_archivo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (!response.ok) throw new Error(`Error subiendo ${file.name}`);
      }

      alert("Archivos subidos exitosamente!");
      onBack();
      window.location.reload();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <h4>Cargar Archivos</h4>
      {archivos.length > 0 && (
        <div className="mb-3">
          <h6>Archivos seleccionados:</h6>
          <ul className="list-group">
            {archivos.map((file, index) => (
              <li key={index} className="list-group-item">
                {file.name} - {(file.size / (1024 * 1024)).toFixed(2)} MB
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <input
            type="file"
            className="form-control"
            onChange={handleFileChange}
            multiple
            disabled={isUploading}
          />
        </div>

        <div className="mb-3">
          <select
            className="form-select"
            value={tipoArchivo}
            onChange={(e) => setTipoArchivo(e.target.value)}
            required
          >
            <option value="">Seleccionar tipo de archivo</option>
            {tiposArchivo.map(tipo => (
              <option key={tipo.id_tipo_archivo} value={tipo.id_tipo_archivo}>
                {tipo.tipo}
              </option>
            ))}
          </select>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={isUploading || archivos.length === 0}
        >
          {isUploading ? 'Subiendo...' : `Subir ${archivos.length} archivo(s)`}
        </button>
      </form>
    </div>
  );
};

export default CargarArchivos;
