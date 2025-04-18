import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";
import "leaflet-geometryutil";
import "leaflet-kml";
import * as toGeoJSON from "@mapbox/togeojson";
import VerInformesClientes from "./VerinformesCliente";

const HomeCliente = () => {
  const [nomUsuario, setNomUsuario] = useState("");
  const [codProductor, setCodProductor] = useState(null);
  const [productores, setProductores] = useState([]);
  const [productorSeleccionado, setProductorSeleccionado] = useState(null);
  const [archivosPorCategoria, setArchivosPorCategoria] = useState({});
  const [archivosMostrados, setArchivosMostrados] = useState([]);
  const [kmlLayers, setKmlLayers] = useState([]);
  const [kmlData, setKmlData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cargandoKml, setCargandoKml] = useState(false);
  const [showInformesModal, setShowInformesModal] = useState(false);

  const mapRef = useRef(null);
  const apiUrl = "http://127.0.0.1:3001/";
  const isMobile = useMediaQuery({ maxWidth: 767 });

  const navigate = useNavigate();

  const handleVerInformesClick = () => {
    setShowInformesModal(true);
  };

  useEffect(() => {
    const nombre = localStorage.getItem("nombre");
    const productor = localStorage.getItem("cod_productor");

    if (nombre) setNomUsuario(nombre);
    if (productor) setCodProductor(productor);

    const fetchProductores = async () => {
      try {
        const response = await fetch(`${apiUrl}api/usuarios/productores`);
        if (!response.ok) throw new Error("Error al obtener productores");
        const data = await response.json();
        setProductores(data);
      } catch (error) {
        console.error("Error fetching productores:", error);
      }
    };

    fetchProductores();
  }, []);

  useEffect(() => {
    const productorId = productorSeleccionado || codProductor;
    if (productorId) {
      fetchArchivos(productorId);
      cargarKmlsProductor(productorId);
    } else {
      setKmlData(null);
      setKmlLayers([]);
    }
  }, [productorSeleccionado, codProductor]);

  const fetchArchivos = async (productorId) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${apiUrl}api/productor/archivos?cod_productor=${productorId}`
      );
      if (!response.ok)
        throw new Error(
          `Error ${response.status}: No se pudieron cargar los archivos.`
        );
      const data = await response.json();
      setArchivosPorCategoria(data.archivos || {});
      setArchivosMostrados(Object.values(data.archivos).flat());
    } catch (error) {
      console.error("Error al cargar los archivos:", error);
    } finally {
      setLoading(false);
    }
  };

  const cargarKmlEnMapa = (kmlUrl, archivos) => {
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
                areaFormatted = (area / 10000).toFixed(2);
              }

              let popupContent = `<b>C ${feature.properties?.name}</b><br>`;
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

          if (mapRef.current && capa.getBounds) {
            const bounds = capa.getBounds();
            if (bounds.isValid()) {
              mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            } else {
              console.error("Bounds no válidos para el KML.");
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

  const cargarKmlsProductor = async (productorId) => {
    setCargandoKml(true);

    try {
      const response = await fetch(
        `${apiUrl}api/productor/kml?cod_productor=${productorId}`
      );
      if (!response.ok) throw new Error("Error cargando KMLs");
      const data = await response.json();
      setKmlData(data);

      const nuevasCapas = [];
      for (const kml of data.kmls) {
        try {
          const capa = await cargarKmlEnMapa(
            kml.ruta_archivo,
            kml.archivos.map((archivo) => archivo.nombre)
          );
          nuevasCapas.push(capa);
        } catch (error) {
          console.error(`Error cargando KML ${kml.ruta_archivo}:`, error);
        }
      }
      setKmlLayers(nuevasCapas);
    } catch (error) {
      console.error("Error cargando KML:", error);
    } finally {
      setCargandoKml(false);
    }
  };

  useEffect(() => {
    const map = L.map("map").setView([-32.5228, -55.7658], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    mapRef.current = map;

    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

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
        <button className="btn btn-primary me-2" onClick={handleVerInformesClick}>
            Ver Informes
          </button>
        </div>
      </div>
      <main
        className="flex-grow-1 position-relative"
        style={{
          height: "100vh", // Aquí aseguramos que el contenedor ocupe toda la altura de la pantalla
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
        <VerInformesClientes
          productorId={productorSeleccionado}
          onClose={() => setShowInformesModal(false)} // Cerrar modal
        />
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default HomeCliente;
