import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate("/home");
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Imagen de fondo con opacidad */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: "url('/images/ArrozW.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.5, // Aplicar opacidad a la imagen de fondo
          zIndex: -1,
        }}
      ></div>

      {/* Contenido del formulario */}
      <div
        className="card p-4 shadow-lg bg-white"
        style={{ width: "100%", maxWidth: "400px", opacity: 0.9 }}
      >
        <div className="text-center mb-4">
          <img
            src="./images/logosdc.png"
            alt="Logo"
            style={{ maxWidth: "150px", width: "100%" }} // Ajusta el tamaño según necesites
          />
        </div>        <form onSubmit={handleSubmit}>
          <div className="form-group mb-3">
            <label htmlFor="email">Usuario</label>
            <input
              type="email"
              className="form-control"
              id="email"
              aria-describedby="emailHelp"
              placeholder="Escribe tu usuario aquí"
            />
          </div>
          <div className="form-group mb-3">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              className="form-control"
              id="password"
              placeholder="Escribe tu contraseña aquí"
            />
          </div>
          <button type="submit" className="btn btn-primary w-100">
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
