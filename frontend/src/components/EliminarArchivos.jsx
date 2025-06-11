import React, { useState, useEffect } from "react";

const EliminarArchivos = ({ productorId, onClose }) => {
  const [archivos, setArchivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const apiUrl = "https://appproducotres-backend.onrender.com/"

  //const apiUrl = "http://192.168.1.246:3001/";
  //const apiUrl = "http://192.168.1.65:3001/";
  useEffect(() => {
    if (!productorId) {
      setLoading(false);
      return;
    }

    const fetchArchivos = async () => {
      const token = localStorage.getItem("token");
      try {
        const response = await fetch(`${apiUrl}api/productor/archivos?cod_productor=${productorId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Respuesta completa:', data);

          // Accede a las categorías dentro de 'archivos' y combina los archivos
          const archivosData = [];
          
          // Iterar sobre las propiedades de 'archivos' (como Informes, Taipas, etc.)
          Object.keys(data.archivos).forEach(key => {
            archivosData.push(...data.archivos[key]);  // Añadir todos los archivos de cada categoría
          });

          // Filtrar los archivos disponibles
          const archivosDisponibles = archivosData.filter(archivo => archivo.disponible !== false);

          setArchivos(archivosDisponibles);
        } else {
          console.error('Error en la respuesta:', await response.text());
        }
      } catch (error) {
        console.error('Error al obtener archivos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArchivos();
  }, [productorId]);

  const eliminarArchivo = async (archivo) => {
    if (!window.confirm("¿Estás seguro de eliminar este archivo?")) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${apiUrl}api/eliminar_archivo`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          archivo_nombre: archivo.nombre
        })
      });
    
      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.msg || 'No se pudo eliminar el archivo');
      }
      
      setArchivos(prev => prev.filter(a => a.id_archivo !== archivo.id_archivo));
      alert("Archivo eliminado correctamente");
       // Recargar la página principal (Home)
    window.location.reload(); // Recarga la página
    
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert(`Error: ${error.message}`);
    }
};
  

  return (
    <div className="modal fade show d-block" style={{ 
      backgroundColor: "rgba(0,0,0,0.5)",
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1050
    }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">Eliminar Archivos</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <h4 className="mb-4">Archivos del Productor {productorId}</h4>
            
            {loading ? (
              <div className="text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p>Cargando archivos...</p>
              </div>
            ) : archivos.length === 0 ? (
              <div className="alert alert-warning">
                No se encontraron archivos disponibles para eliminar.
              </div>
            ) : (
              <div className="list-group">
                {archivos.map((archivo) => (
                  <div key={archivo.id_archivo} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{archivo.nombre}</strong>
                      <div className="text-muted small">
                        Subido: {new Date(archivo.fecha_subida).toLocaleDateString()}
                      </div>
                    </div>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => eliminarArchivo(archivo)}  // Aquí pasas el objeto completo
                    >
                      <i className="bi bi-trash"></i> Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EliminarArchivos;
