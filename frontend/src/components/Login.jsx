import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { ClipLoader } from "react-spinners"; // Importa el spinner

const Login = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(""); // Corregí "eror" a "error"
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

 const apiUrl = "https://appproducotres-backend.onrender.com/"

//const apiUrl = "http://192.168.1.246:3001/";
//const apiUrl = "http://192.168.1.65:3001/";  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      const response = await fetch(`${apiUrl}api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user, password }),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", user);
        localStorage.setItem("nombre", data.nombre);
        localStorage.setItem("cod_productor", data.cod_productor);  // Guardamos el cod_productor
  
        if (data.tipo_usuario === "Oficina" || data.tipo_usuario === "Admin") {
          navigate("/home");
        }
        if (data.tipo_usuario === "Productor") {
          navigate("/home-cliente");
        }
      } else {
        if (response.status === 404) {
          setError("Usuario no encontrado");
        } else if (response.status === 401) {
          setError("Contraseña incorrecta");
        } else {
          setError(data.error || "Error en el inicio de sesión");
        }
      }
    } catch (err) {
      setError("Error de conexión con el servidor");
    }finally{
      setLoading(false); // Asegúrate de que el loading se desactive al final
    }
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
          opacity: 0.5,
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
            style={{ maxWidth: "150px", width: "100%" }}
          />
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group mb-3">
            <label htmlFor="nom_us">Usuario</label>
            <input
              type="text"
              className="form-control"
              id="nom_us"
              placeholder="Escribe tu usuario aquí"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </div>
          <div className="form-group mb-3">
            <label htmlFor="pass_us">Contraseña</label>
            <div className="input-group">
              <input
                type={showPassword ? "text" : "password"}
                className="form-control"
                id="pass_us"
                placeholder="Escribe tu contraseña aquí"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </div>
          </div>
          {error && <p className="text-danger">{error}</p>}{" "}
          {/* Muestra errores */}
          { loading ? (
            <div className="text-center">
              <ClipLoader color="#007bff" loading={loading} size={30} />
            </div>
          ) : (
            <button type="submit" className="btn btn-primary w-100">
              Iniciar sesión
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
