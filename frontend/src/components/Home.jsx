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
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import * as toGeoJSON from "@mapbox/togeojson";
import CargarArchivos from "./CargarArchivos";
import EliminarArchivo from "./EliminarArchivos";
import CargarKml from "./CargarKml";
import VerInformes from "./VerInformes";
import Clientes from "./Clientes";
import { useDropzone } from "react-dropzone";
import Select from "react-select";

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
  const [showClientesModal, setShowClientesModal] = useState(false);
  const [kmlLayers, setKmlLayers] = useState([]);
  const [cargandoKml, setCargandoKml] = useState(false);
  const [kmlData, setKmlData] = useState(null);
  const [kmlError, setKmlError] = useState(null);
  const [archivosArrastrados, setArchivosArrastrados] = useState([]);
  const kmlBoundsRef = useRef(null);
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const isMobile = useMediaQuery({ maxWidth: 767 });

  const apiUrl = "https://appproducotres-backend.onrender.com/";

  //const apiUrl = "http://192.168.1.246:3001/";
  //const apiUrl = "http://192.168.1.65:3001/";
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
  };

  const hanldeCargarKml = () => {
    if (!productorSeleccionado) {
      alert("Por favor seleccione un productor primero");
      return;
    }
    setShowCargarKmlModal(true);
  };

  const handleShowEliminarModal = () => {
    if (!productorSeleccionado) {
      alert("Por favor seleccione un productor primero");
      return;
    }
    setShowEliminarModal(true);
  };

  const handleCloseEliminarModal = () => {
    setShowEliminarModal(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleShowClientesModal = () => {
    setShowClientesModal(true);
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    onDragEnter: () => {
      if (mapRef.current) {
        mapRef.current.dragging.disable();
        mapRef.current.doubleClickZoom.disable();
      }
    },
    onDragLeave: () => {
      if (mapRef.current) {
        mapRef.current.dragging.enable();
        mapRef.current.doubleClickZoom.enable();
      }
    },
    onDrop: (acceptedFiles) => {
      if (mapRef.current) {
        mapRef.current.dragging.enable();
        mapRef.current.doubleClickZoom.enable();
      }

      if (!productorSeleccionado) {
        alert("Por favor seleccione un productor primero");
        return;
      }

      if (acceptedFiles.length > 0) {
        setArchivosArrastrados(acceptedFiles);
        setShowModal(true);
      }
    },
    // Sin restricciones:
    accept: undefined, // Permite cualquier tipo
    maxSize: undefined, // Sin límite de tamaño
    multiple: true,
  });

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
              kmlBoundsRef.current = bounds;
              mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            } else {
              console.warn("Los límites del KML no son válidos.");
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
    kmlBoundsRef.current = null;

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

  const limpiarKmlsMapa = () => {
    if (kmlLayers.length > 0) {
      kmlLayers.forEach((capa) => {
        if (mapRef.current.hasLayer(capa)) {
          mapRef.current.removeLayer(capa);
        }
        if (mapRef.current) {
          mapRef.current.setView([-32.5228, -55.7658], 7);
        }
      });

      setKmlLayers([]);
    }
  };

  useEffect(() => {
    if (productorSeleccionado) {
      limpiarKmlsMapa();
      fetchArchivos(productorSeleccionado, "");
      cargarKmlsProductor(productorSeleccionado);
    } else {
      setKmlData(null);
      setKmlLayers([]);
      setKmlError(null);
      kmlBoundsRef.current = null;
    }
  }, [productorSeleccionado]);

  useEffect(() => {
    // Crear el mapa y establecer vista inicial
    const map = L.map("map").setView([-32.5228, -55.7658], 7);

    // Capa estándar de OpenStreetMap
    const osmLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }
    );

    // Capa satelital de ESRI
    const satelliteLayer = L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "&copy; Esri &copy; OpenStreetMap contributors",
        maxZoom: 18,
      }
    );

    // Agregar la capa predeterminada
    osmLayer.addTo(map);

    // Función para agregar control de "Volver al KML"
    // Función para agregar control de "Volver al KML" (con icono de casa)
    // Función para agregar control de "Volver al KML"
    // Función para agregar control de "Volver al KML" (con icono de casa)
    const addKmlHomeControl = () => {
      const kmlHomeControl = L.control({ position: "topright" });

      kmlHomeControl.onAdd = () => {
        const div = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        div.innerHTML = `
      <button style="
        background: white;
        border: 2px solid rgba(0,0,0,0.2);
        border-radius: 4px;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      " title="Volver al KML">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#666">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      </button>
    `;

        div.onclick = () => {
          if (kmlBoundsRef.current) {
            map.flyToBounds(kmlBoundsRef.current, {
              padding: [50, 50],
              duration: 1,
              easeLinearity: 0.25,
            });
          } else {
            map.flyTo([-32.5228, -55.7658], 6, {
              duration: 1,
              easeLinearity: 0.25,
            });
          }
        };

        return div;
      };

      return kmlHomeControl;
    };
    // Función para agregar control de ubicación (versión mejorada)
    const addLocationControl = () => {
      const handleLocate = async () => {
        // 1. Verificar si el navegador soporta geolocalización
        if (!navigator.geolocation) {
          alert("ERROR: Tu navegador no soporta geolocalización");
          return;
        }

        // 2. Mostrar indicador de carga
        const loadingIndicator = L.DomUtil.create(
          "div",
          "location-loading-indicator"
        );
        loadingIndicator.innerHTML = `
          <div style="
            background: white;
            padding: 8px 12px;
            border-radius: 4px;
            box-shadow: 0 0 8px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            font-size: 14px;
          ">
            <div class="spinner-border spinner-border-sm text-primary" role="status" style="margin-right: 8px;"></div>
            Buscando tu ubicación...
          </div>
        `;
        loadingIndicator.style.position = "absolute";
        loadingIndicator.style.bottom = "20px";
        loadingIndicator.style.left = "50%";
        loadingIndicator.style.transform = "translateX(-50%)";
        loadingIndicator.style.zIndex = "1000";
        map.getContainer().appendChild(loadingIndicator);

        try {
          fixed - top;
          // 3. Verificar permisos de geolocalización
          const permissionStatus = await navigator.permissions?.query({
            name: "geolocation",
          });

          if (permissionStatus?.state === "denied") {
            showPermissionInstructions();
            return;
          }

          // 4. Obtener ubicación con opciones mejoradas
          navigator.geolocation.getCurrentPosition(
            (position) => {
              // Eliminar indicador de carga
              map.getContainer().removeChild(loadingIndicator);

              const { latitude, longitude, accuracy } = position.coords;
              const userLatLng = [latitude, longitude];

              console.log("Ubicación obtenida:", latitude, longitude);

              // Centrar mapa con animación
              map.flyTo(userLatLng, 16, {
                duration: 1,
                easeLinearity: 0.25,
              });

              // Limpiar marcadores previos
              map.eachLayer((layer) => {
                if (
                  layer instanceof L.Marker ||
                  (layer instanceof L.Circle &&
                    layer.options.fillColor === "#30f")
                ) {
                  map.removeLayer(layer);
                }
              });

              // Añadir marcador con estilo mejorado
              const marker = L.marker(userLatLng, {
                icon: L.divIcon({
                  className: "location-marker",
                  html: '<div style="background-color:#4285F4;border-radius:50%;width:20px;height:20px;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.3)"></div>',
                  iconSize: [26, 26],
                  iconAnchor: [13, 13],
                }),
              }).addTo(map);

              marker.bindPopup("<b>Tu ubicación actual</b>").openPopup();

              // Añadir círculo de precisión si es relevante
              if (accuracy && accuracy < 1000) {
                L.circle(userLatLng, {
                  radius: accuracy,
                  fillColor: "#4285F4",
                  fillOpacity: 0.2,
                  color: "#4285F4",
                  weight: 1,
                }).addTo(map);
              }
            },
            (error) => {
              // Eliminar indicador de carga
              map.getContainer().removeChild(loadingIndicator);
              handleGeolocationError(error);
            },
            {
              enableHighAccuracy: true,
              timeout: 30000, // Aumentado timeout para mejorar la obtención de la ubicación
              maximumAge: 0,
            }
          );
        } catch (error) {
          map.getContainer().removeChild(loadingIndicator);
          console.error("Error al verificar permisos:", error);
          alert("Error al verificar los permisos de ubicación");
        }
      };

      // Función para mostrar instrucciones de permisos
      const showPermissionInstructions = () => {
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const instructions = isIOS
          ? "1. Ve a Ajustes > Privacidad > Ubicación\n2. Selecciona Safari\n3. Elige 'Mientras uso la app'\n4. Recarga esta página"
          : "1. Abre Configuración del navegador\n2. Ve a Configuración del sitio > Ubicación\n3. Habilita los permisos\n4. Recarga la página";

        alert(`🔍 Permiso de ubicación requerido\n\n${instructions}`);
      };

      // Función para manejar errores
      const handleGeolocationError = (error) => {
        const errorMessages = {
          1: "Permiso denegado. Por favor habilita la ubicación en ajustes.",
          2: "No se pudo obtener la ubicación (GPS apagado o sin señal).",
          3: "Tiempo de espera agotado. ¿Estás en un área con poca cobertura?",
        };

        const errorDiv = L.DomUtil.create("div", "location-error-message");
        errorDiv.innerHTML = `
          <div style="
            background: #ff4444;
            color: white;
            padding: 10px;
            border-radius: 5px;
            max-width: 250px;
          ">
            <strong>❌ ${
              errorMessages[error.code] || "Error desconocido"
            }</strong>
            <div style="margin-top: 8px;">
              <button style="
                background: white;
                color: #ff4444;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                font-size: 12px;
                width: 100%;
              ">Reintentar</button>
            </div>
          </div>
        `;

        errorDiv.style.position = "absolute";
        errorDiv.style.bottom = "20px";
        errorDiv.style.left = "50%";
        errorDiv.style.transform = "translateX(-50%)";
        errorDiv.style.zIndex = "1000";

        const button = errorDiv.querySelector("button");
        button.onclick = () => {
          map.getContainer().removeChild(errorDiv);
          handleLocate();
        };

        map.getContainer().appendChild(errorDiv);
        setTimeout(() => {
          if (errorDiv.parentNode) {
            map.getContainer().removeChild(errorDiv);
          }
        }, 10000);
      };

      // Crear control de ubicación con icono SVG
      const locationControl = L.control({ position: "topright" });
      locationControl.onAdd = () => {
        const div = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        div.innerHTML = `
          <button style="
            background: white;
            border: 2px solid rgba(0,0,0,0.2);
            border-radius: 4px;
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          " title="Mi ubicación">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#4285F4">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </button>
        `;
        div.onclick = handleLocate;
        return div;
      };

      return locationControl;
    };

    // Función para agregar control de capas personalizado
    // Función para agregar control de capas (con icono de capas)
    const addLayersControl = () => {
      const layersControl = L.control({ position: "topright" });

      layersControl.onAdd = () => {
        const div = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        div.innerHTML = `
      <button style="
        background: white;
        border: 2px solid rgba(0,0,0,0.2);
        border-radius: 4px;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      " title="Cambiar vista">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#666">
          <path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
        </svg>
      </button>
    `;

        let currentLayer = "osm";
        div.onclick = () => {
          if (currentLayer === "osm") {
            map.removeLayer(osmLayer);
            satelliteLayer.addTo(map);
            currentLayer = "satellite";
          } else {
            map.removeLayer(satelliteLayer);
            osmLayer.addTo(map);
            currentLayer = "osm";
          }
        };

        return div;
      };

      return layersControl;
    };
    // Agregar controles al mapa
    addLocationControl().addTo(map);
    addLayersControl().addTo(map);
    addKmlHomeControl().addTo(map); // Agregar el nuevo control

    // Guardar referencia del mapa
    mapRef.current = map;

    // Ajustar el mapa al redimensionar
    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", handleResize);

    // Limpieza
    return () => {
      window.removeEventListener("resize", handleResize);
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
            <button className="btn btn-primary me-2" onClick={hanldeCargarKml}>
              Cargar KML
            </button>
            <button
              className="btn btn-primary me-2"
              onClick={handleVerInformesClick}
            >
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
            className="btn btn-primary me-2"
            onClick={handleShowEliminarModal}
          >
            Eliminar Archivos
          </button>
          <button className="btn btn-primary me-2" onClick={hanldeCargarKml}>
            Cargar KML
          </button>
          <button
            className="btn btn-primary me-2"
            onClick={handleVerInformesClick}
          >
            Ver Informes
          </button>
          <button
            className="btn btn-primary me-2"
            onClick={handleShowClientesModal}
          >
            Clientes
          </button>
        </div>
        <Select
          className="basic-single"
          classNamePrefix="select"
          placeholder="Buscar productor..."
          options={productores.map((prod) => ({
            value: prod.cod_productor,
            label: `${prod.cod_productor} - ${prod.nombre}`,
          }))}
          onChange={(selectedOption) => {
            const selectedProductor = selectedOption?.value || "";
            setProductorSeleccionado(selectedProductor);
            setCategoriaSeleccionada("");
            if (selectedProductor) {
              fetchArchivos(selectedProductor, "");
            } else {
              setArchivosPorCategoria({});
              setArchivosMostrados([]);
            }
          }}
          value={
            productorSeleccionado
              ? {
                  value: productorSeleccionado,
                  label: `${productorSeleccionado} - ${
                    productores.find(
                      (p) => p.cod_productor === productorSeleccionado
                    )?.nombre || ""
                  }`,
                }
              : null
          }
          isClearable
          isSearchable
          noOptionsMessage={() => "No se encontraron productores"}
          styles={{
            control: (base) => ({
              ...base,
              minWidth: "250px",
              width: "auto",
            }),
            menu: (base) => ({
              ...base,
              zIndex: 9999,
            }),
          }}
        />
      </div>

      <div
        className="d-flex flex-column flex-grow-1"
        style={{
          margin: 0,
          padding: 0,
          overflow: "hidden",
        }}
      >
        <main
          className="flex-grow-1 position-relative"
          style={{
            height: "calc(100vh - 120px)", // Restar altura de header y barra adicional
            ...(isDragActive && {
              border: "3px dashed #007bff",
              backgroundColor: "rgba(0, 123, 255, 0.05)",
            }),
          }}
          {...getRootProps()} // Dropzone integrado
        >
          <div
            id="map"
            style={{
              height: "100%", // Ocupa todo el contenedor restante
              width: "100%",
              background: "#e8e8e8",
            }}
          >
            <input {...getInputProps()} /> {/* Dropzone input */}
          </div>

          {isDragActive && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0, 123, 255, 0.2)",
                border: "4px dashed #007bff",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: "20px",
                  borderRadius: "5px",
                  boxShadow: "0 0 10px rgba(0,0,0,0.3)",
                }}
              >
                <h5>Suelte los archivos para cargarlos</h5>
                <p>Se aceptan todo tipo de archivos</p>
              </div>
            </div>
          )}

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
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  {archivosArrastrados.length > 0
                    ? `Subir ${archivosArrastrados.length} archivo(s)`
                    : "Subir archivos"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setArchivosArrastrados([]);
                    handleCloseModal();
                  }}
                />
              </div>
              <div className="modal-body">
                <CargarArchivos
                  productorId={productorSeleccionado}
                  tiposArchivo={tiposArchivo}
                  onBack={() => {
                    setArchivosArrastrados([]);
                    handleCloseModal();
                  }}
                  archivosPrecargados={archivosArrastrados}
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

      {showClientesModal && (
        <div
          className="modal fade show"
          style={{ display: "block", backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Clientes</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowClientesModal(false); // Cierra el modal
                    window.location.reload(); // Recarga la página
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <Clientes
                  onClose={() => {
                    setShowClientesModal(false); // Cierra el modal
                    window.location.reload(); // Recarga la página
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
