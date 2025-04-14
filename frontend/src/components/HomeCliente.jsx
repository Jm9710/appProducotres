import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";




const Home = () => {
  const [nomUsuario, setNomUsuario] = React.useState("");
  const navigate = useNavigate();
  
  useEffect(() => {
    const nombre = localStorage.getItem("nombre");
    if (nombre){
      setNomUsuario(nombre);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("nombre");
    navigate("/");
  }

  return (
    <div className="container-fluid p-0 min-vh-100 d-flex flex-column">
      {/* Barra superior */}
      <header className="d-flex align-items-center justify-content-between bg-light shadow-sm p-3">
        <div className="d-flex align-items-center">
          <img
            src="./images/logosdc.png" // Reemplaza con la ruta real del logo
            alt="SDC Agro"
            className="me-3"
            style={{ width: "50px", height: "50px" }}
          />
          <h5 className="m-0">SDC Taipas</h5>
        </div>
        <h5 className="m-0 text-center flex-grow-1">Bienvenido {nomUsuario}</h5>
        <button className="btn btn-outline-secondary" onClick={handleLogout}>Cerrar Sesión</button>
      </header>


      {/* Contenido principal */}
      <div className="row m-0 flex-grow-1">
        {/* Panel lateral */}
        <aside className="col-12 col-md-3 bg-light border-end p-3 d-flex flex-column">
          <button className="btn btn-outline-secondary w-100 mb-3">Taipas</button>
          <button className="btn btn-outline-secondary w-100 mb-3">Desgotes</button>
          <button className="btn btn-outline-secondary w-100">Informes</button>
        </aside>

        {/* Contenido principal */}
        <main className="col-12 col-md-9 d-flex align-items-center justify-content-center">
          <h3 className="text-muted">Contenido principal (en desarrollo)</h3>
        </main>
      </div>
    </div>
  );
};

export default Home;
