import React, { useState, useEffect } from "react";

const VerInformesCliente = ({ productorId, onClose }) => {
  const [informes, setInformes] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = "https://appproducotres-backend.onrender.com/"

  //const apiUrl = "http://192.168.1.246:3001/";
  //const apiUrl = "http://192.168.1.65:3001/";
  useEffect(() => {
    if (!productorId) {
      setLoading(false);
      return;
    }

    const fetchInformes = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        console.error("No token found");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${apiUrl}api/productor/archivos?cod_productor=${productorId}`, // Cambié la URL a la que se ajusta mejor
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();

          if (data.archivos && data.archivos.Informes) {
            setInformes(data.archivos.Informes); // Filtra solo los informes
          } else {
            console.error("No se encontraron informes.");
          }
        } else {
          console.error("Error en la respuesta de la API:", response.status);
        }
      } catch (error) {
        console.error("Error al obtener los informes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInformes();
  }, [productorId]);

  return (
    <div
      className="modal fade show d-block"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1050,
      }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">Informes del Productor {productorId}</h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            <h4 className="mb-4">Informes Disponibles</h4>

            {loading ? (
              <div className="text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p>Cargando informes...</p>
              </div>
            ) : informes.length === 0 ? (
              <div className="alert alert-warning">
                No se encontraron informes disponibles.
              </div>
            ) : (
              <div className="list-group">
                {informes.map((informe) => (
                  <div
                    key={informe.id_archivo} // Asegúrate de que 'id_archivo' sea la propiedad correcta
                    className="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <strong>{informe.nombre}</strong>
                    </div>
                    <a
                      href={informe.ruta_descarga} // Asegúrate de que 'ruta_descarga' esté en el objeto informe
                      className="btn btn-success btn-sm"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Descargar
                    </a>
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

export default VerInformesCliente;
