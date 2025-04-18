import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import "bootstrap/dist/css/bootstrap.min.css";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";
import "leaflet-geometryutil";
import "leaflet-kml";
import * as toGeoJSON from "@mapbox/togeojson";
import CargarArchivos from "./CargarArchivos";
import EliminarArchivo from "./EliminarArchivos";
import CargarKml from "./CargarKml";
import VerInformes from "./VerInformes";

const Home = () => {
  const [nomUsuario, setNomUsuario] = useState("");
  const [productores, setProductores] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [botonesVisible, setBotonesVisible] = useState(false);
  const [tiposArchivo, setTiposArchivo] = useState([]);
  const [mostrarCargarArchivos, setMostrarCargarArchivos] = useState(false);
  const [productorSeleccionado, setProductorSeleccionado] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [archivosPorCategoria, setArchivosPorCategoria] = useState({});
  const [archivosMostrados, setArchivosMostrados] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [loading, setLoading] = useState(false);
  const [archivosColapsados, setArchivosColapsados] = React.useState(false);
  const [showEliminarModal, setShowEliminarModal] = useState(false);
  const [showCargarKmlModal, setShowCargarKmlModal] = useState(false);
  const [showInformesModal, setShowInformesModal] = useState(false);
  const [kmlLayers, setKmlLayers] = useState([]);
  const [cargandoKml, setCargandoKml] = useState(false);
  const [kmlData, setKmlData] = useState(null);
  const [kmlError, setKmlError] = useState(null);

  const navigate = useNavigate();
  const mapRef = useRef(null);
  const isMobile = useMediaQuery({ maxWidth: 767 });

  const apiUrl = "http://127.0.0.1:3001/";

  const handleCargarArchivosClick = () => {
    if (!productorSeleccionado) {
      alert("Por favor seleccione un productor primero");
      return;
    }
    setShowModal(true);
  };

  const handleVerInformesClick = () => {
    if (!productorSeleccionado) {
      alert("Por favor seleccione un productor primero");
      return;
    }
    setShowInformesModal(true);
  }


  const hanldeCargarKml = () => {
    if (!productorSeleccionado) {
      alert("Por favor seleccione un productor primero");
      return;
    }
    setShowCargarKmlModal(true);
  };

  const handleShowEliminarModal = () => {
    setShowEliminarModal(true);
  };

  const handleCloseEliminarModal = () => {
    setShowEliminarModal(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const fetchArchivos = async (productorId, categoria) => {
    if (!productorId) return;

    setLoading(true);
    console.log(`Cargando archivos para el productor ${productorId}`);

    try {
      const response = await fetch(
        `${apiUrl}api/productor/archivos?cod_productor=${productorId}`
      );

      if (!response.ok) {
        throw new Error("Error al obtener los archivos");
      }

      const data = await response.json();
      console.log("Datos recibidos:", data);

      setArchivosPorCategoria(data.archivos || {});

      if (categoria) {
        setArchivosMostrados(data.archivos[categoria] || []);
      } else {
        const todosArchivos = Object.values(data.archivos).flat();
        setArchivosMostrados(todosArchivos);
      }
    } catch (error) {
      console.error("Error al cargar los archivos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoriaClick = (categoria) => {
    setCategoriaSeleccionada(categoria);
    if (categoria) {
      setArchivosMostrados(archivosPorCategoria[categoria] || []);
    } else {
      const todosArchivos = Object.values(archivosPorCategoria).flat();
      setArchivosMostrados(todosArchivos);
    }
  };

  useEffect(() => {
    const fetchTiposArchivo = async () => {
      try {
        const response = await fetch(`${apiUrl}api/tipo_archivo`);
        const data = await response.json();
        setTiposArchivo(data);
      } catch (error) {
        console.error("Error fetching tipos de archivo:", error);
      }
    };

    fetchTiposArchivo();
  }, []);

  useEffect(() => {
    const nombre = localStorage.getItem("nombre");
    if (nombre) {
      setNomUsuario(nombre);
    }

    const fetchProductores = async () => {
      try {
        const response = await fetch(`${apiUrl}api/usuarios/productores`);
        const data = await response.json();
        setProductores(data);
      } catch (error) {
        console.error("Error fetching productores:", error);
      }
    };

    fetchProductores();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("nombre");
    navigate("/");
  };

  const cargarKmlEnMapa = (kmlUrl, nombre, archivos) => {
    return new Promise((resolve, reject) => {
      fetch(kmlUrl)
        .then((res) => res.text())
        .then((kmlText) => {
          const parser = new DOMParser();
          const kml = parser.parseFromString(kmlText, "text/xml");
          const geojson = toGeoJSON.kml(kml);

          const capa = L.geoJSON(geojson, {
            style: (feature) => {
              const poligonoNombre = feature.properties?.name?.toString();
              const tieneArchivos = archivos.some((archivo) => {
                const cuadros =
                  archivo
                    .match(/_C(\d+)(?=_|$)/g)
                    ?.map((match) => match.slice(2)) || [];
                return cuadros.includes(poligonoNombre);
              });

              return {
                color: tieneArchivos ? "#28a745" : "#dc3545",
                weight: 3,
                opacity: 0.7,
                fillColor: tieneArchivos ? "#28a745" : "#dc3545",
                fillOpacity: 0.2,
              };
            },
            onEachFeature: (feature, layer) => {
              const poligonoNombre = feature.properties?.name?.toString();
              const archivosAsociados = archivos.filter((archivo) => {
                const cuadros =
                  archivo
                    .match(/_C(\d+)(?=_|$)/g)
                    ?.map((match) => match.slice(2)) || [];
                return cuadros.includes(poligonoNombre);
              });

              // Calcular el área del polígono
              let areaFormatted = "N/A";
              if (
                feature.geometry.type === "Polygon" ||
                feature.geometry.type === "MultiPolygon"
              ) {
                const coords =
                  feature.geometry.type === "Polygon"
                    ? feature.geometry.coordinates[0].map(([lng, lat]) =>
                        L.latLng(lat, lng)
                      )
                    : feature.geometry.coordinates[0][0].map(([lng, lat]) =>
                        L.latLng(lat, lng)
                      );
                const area = L.GeometryUtil.geodesicArea(coords);
                areaFormatted = (area / 10000).toFixed(2); // Convertir a hectáreas (ha)
              }

              // Popup simplificado (solo nombre, área y archivos)
              let popupContent = "";
              if (feature.properties?.name) {
                const poligonoNombre = "C " + feature.properties.name; // Prefijo C + nombre
                popupContent += `<b>${poligonoNombre}</b><br>`;
              }
              popupContent += `Área: ${areaFormatted} ha`;

              if (archivosAsociados.length > 0) {
                popupContent += `<br>Archivos:<br><ul>`;
                popupContent += archivosAsociados
                  .map((archivo) => {
                    // Aquí puedes ajustar el nombre de archivo a tu formato deseado
                    const nombreArchivo = archivo.split("/").pop(); // Obtener el nombre del archivo
                    const nombreAjustado = nombreArchivo.replace(/_/g, " "); // Reemplazar guiones bajos con espacios

                    return `<li><a href="${archivo}" target="_blank" download>${nombreAjustado}</a></li>`;
                  })
                  .join("");
                popupContent += `</ul>`;
              }

              layer.bindPopup(popupContent);
            },
          }).addTo(mapRef.current);

          // Ajustar el mapa para que muestre el contenido del KML
          if (mapRef.current && capa.getBounds) {
            const bounds = capa.getBounds();
            if (bounds.isValid()) {
              mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            }
          }

          resolve(capa);
        })
        .catch((error) => {
          console.error("Error cargando el KML:", error);
          reject(error);
        });
    });
  };

  const cargarKmlsProductor = async (codProductor) => {
    if (!codProductor) return;

    setCargandoKml(true);

    try {
      const response = await fetch(
        `${apiUrl}api/productor/kml?cod_productor=${codProductor}`
      );
      const data = await response.json();

      setKmlData(data);

      if (data.kmls && data.kmls.length > 0) {
        const nuevasCapas = [];
        for (const kml of data.kmls) {
          try {
            const nombreKml = kml.ruta_archivo.split("/").pop();
            const archivos = kml.archivos.map((archivo) => archivo.nombre);

            const capa = await cargarKmlEnMapa(
              kml.ruta_archivo,
              nombreKml,
              archivos
            );
            nuevasCapas.push(capa);
          } catch (error) {
            console.error(`Error cargando KML ${kml.ruta_archivo}:`, error);
          }
        }
        setKmlLayers(nuevasCapas);
      }
    } catch (error) {
      setKmlError(error.message);
    } finally {
      setCargandoKml(false);
    }
  };

  useEffect(() => {
    if (productorSeleccionado) {
      fetchArchivos(productorSeleccionado, "");
      cargarKmlsProductor(productorSeleccionado);
    } else {
      setKmlData(null);
      setKmlLayers([]);
      setKmlError(null);
    }
  }, [productorSeleccionado]);

  useEffect(() => {
    const map = L.map("map").setView([-32.5228, -55.7658], 6);

    const osmLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "&copy; OpenStreetMap contributors" }
    ).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isMobile]);

  if (mostrarCargarArchivos) {
    return (
      <CargarArchivos
        productorId={productorSeleccionado}
        tiposArchivo={tiposArchivo}
        onBack={() => setMostrarCargarArchivos(false)}
      />
    );
  }

  if (isMobile) {
    return (
      <div className="container-fluid p-0 min-vh-100 d-flex flex-column">
        <header className="d-flex align-items-center justify-content-between bg-light shadow-sm p-3">
          <div className="d-flex align-items-center">
            <img
              src="./images/logosdc.png"
              alt="SDC Agro"
              className="me-3"
              style={{ width: "50px", height: "50px" }}
            />
            <h5 className="m-0">SDC Taipas</h5>
          </div>
          <h5 className="m-0 text-center flex-grow-1">
            Bienvenido {nomUsuario}
          </h5>
          <button className="btn btn-outline-secondary" onClick={handleLogout}>
            Cerrar Sesión
          </button>
        </header>

        <div className="d-md-none d-flex justify-content-between bg-light p-2">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setBotonesVisible(!botonesVisible)}
          >
            {botonesVisible ? "Ocultar opciones" : "Mostrar opciones"}
          </button>
        </div>

        <div
          className={`bg-light shadow-sm p-2 ${
            botonesVisible ? "d-flex" : "d-none"
          } flex-wrap align-items-center justify-content-between d-md-flex`}
        >
          <div className="d-flex flex-wrap align-items-center mb-2 mb-md-0">
            <button
              className="btn btn-primary me-2 mb-2"
              onClick={handleCargarArchivosClick}
            >
              Cargar Archivos
            </button>
            <button
              className="btn btn-primary me-2 mb-2"
              onClick={handleShowEliminarModal}
            >
              Eliminar Archivos
            </button>
            <button className="btn btn-primary me-2 mb-2">Cargar KML</button>
          </div>
          <select
            className="form-select w-auto"
            onChange={(e) => {
              const selectedProductor = e.target.value;
              setProductorSeleccionado(selectedProductor);
              setCategoriaSeleccionada("");
              if (selectedProductor) {
                fetchArchivos(selectedProductor, "");
              } else {
                setArchivosPorCategoria({});
                setArchivosMostrados([]);
              }
            }}
            value={productorSeleccionado || ""}
          >
            <option value="">Seleccionar productor</option>
            {productores.map((prod) => (
              <option key={prod.cod_productor} value={prod.cod_productor}>
                {prod.cod_productor} - {prod.nombre}
              </option>
            ))}
          </select>
        </div>

        <div id="map" className="flex-grow-1"></div>

        {showModal && (
          <div
            className="modal fade show"
            style={{ display: "block" }}
            tabIndex="-1"
            role="dialog"
            aria-labelledby="exampleModalLabel"
            aria-hidden="true"
          >
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" id="exampleModalLabel">
                    Cargar Archivos
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                    onClick={handleCloseModal}
                  ></button>
                </div>
                <div className="modal-body">
                  <CargarArchivos
                    productorId={productorSeleccionado}
                    tiposArchivo={tiposArchivo}
                    onClose={handleCloseModal}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container-fluid p-0 min-vh-100 d-flex flex-column">
      <header className="d-flex align-items-center justify-content-between bg-light shadow-sm p-1">
        <div className="d-flex align-items-center">
          <img
            src="./images/logosdc.png"
            alt="SDC Agro"
            className="me-3"
            style={{ width: "50px", height: "50px" }}
          />
          <h5 className="m-0">SDC Taipas</h5>
        </div>
        <h5 className="m-0 text-center flex-grow-1">Bienvenido {nomUsuario}</h5>
        <button className="btn btn-outline-secondary" onClick={handleLogout}>
          Cerrar Sesión
        </button>
      </header>

      <div className="d-flex align-items-center justify-content-between bg-light shadow-sm p-2">
        <div className="d-flex align-items-center">
          <button
            className="btn btn-primary me-2"
            onClick={handleCargarArchivosClick}
          >
            Cargar Archivos
          </button>
          <button
            className="btn btn-primary me-2 "
            onClick={handleShowEliminarModal}
          >
            Eliminar Archivos
          </button>
          <button className="btn btn-primary me-2" onClick={hanldeCargarKml}>
            Cargar KML
          </button>
          <button className="btn btn-primary me-2" onClick={handleVerInformesClick}>
            Ver Informes
          </button>
        </div>
        <select
          className="form-select w-auto"
          onChange={(e) => {
            const selectedProductor = e.target.value;
            setProductorSeleccionado(selectedProductor);
            setCategoriaSeleccionada("");
            if (selectedProductor) {
              fetchArchivos(selectedProductor, "");
            } else {
              setArchivosPorCategoria({});
              setArchivosMostrados([]);
            }
          }}
          value={productorSeleccionado || ""}
        >
          <option value="">Seleccionar productor</option>
          {productores.map((prod) => (
            <option key={prod.cod_productor} value={prod.cod_productor}>
              {prod.cod_productor} - {prod.nombre}
            </option>
          ))}
        </select>
      </div>

      <div
        className="d-flex flex-column vh-100"
        style={{
          margin: 0,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* Mapa a pantalla completa */}
        <main
          className="flex-grow-1 position-relative"
          style={{
            height: "100%",
          }}
        >
          <div
            id="map"
            style={{
              height: "100%",
              width: "100%",
              background: "#e8e8e8",
            }}
          />
          {cargandoKml && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                zIndex: 1000,
                padding: "5px 10px",
                background: "white",
                borderRadius: "5px",
                boxShadow: "0 0 5px rgba(0,0,0,0.2)",
              }}
            >
              <div
                className="spinner-border spinner-border-sm text-primary"
                role="status"
              >
                <span className="visually-hidden">Cargando KML...</span>
              </div>
              <span className="ms-2">Cargando KMLs...</span>
            </div>
          )}
        </main>
      </div>

      {showModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Subir Archivos</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseModal}
                ></button>
              </div>
              <div className="modal-body">
                <CargarArchivos
                  productorId={productorSeleccionado}
                  tiposArchivo={tiposArchivo}
                  onBack={handleCloseModal}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para eliminar archivo */}
      {showEliminarModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Eliminar Archivo</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseEliminarModal}
                ></button>
              </div>
              <div className="modal-body">
                <EliminarArchivo
                  productorId={productorSeleccionado}
                  onClose={handleCloseEliminarModal}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {showCargarKmlModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex="-1"
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Cargar Archivo KML</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCargarKmlModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <CargarKml
                  productorId={productorSeleccionado}
                  onClose={() => setShowCargarKmlModal(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showInformesModal && (
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowInformesModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <VerInformes
                  productorId={productorSeleccionado}
                  onClose={() => setShowInformesModal(false)}
                />
              </div>
            </div>
          </div>
      )}

    </div>
  );
};

export default Home;
