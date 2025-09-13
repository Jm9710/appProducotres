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
import DescargarPuntos from "./descargaPuntos";
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
  const [showDescargaPuntosModal, setShowDescargaPuntosModal] = useState(false);
  const [kmlLayers, setKmlLayers] = useState([]);
  const [cargandoKml, setCargandoKml] = useState(false);
  const [kmlData, setKmlData] = useState(null);
  const [kmlError, setKmlError] = useState(null);
  const [archivosArrastrados, setArchivosArrastrados] = useState([]);
  const kmlBoundsRef = useRef(null);
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [puntosCount, setPuntosCount] = useState(0);

  const apiUrl = "https://appproducotres-backend.onrender.com/";

 //onst apiUrl = "http://192.168.1.66:3001/";

  //const apiUrl = "http://192.168.1.246:3001/";
  //const apiUrl = "http://192.168.1.65:3001/";

// Carpeta de puntos (la misma de DescargaPuntos modo "drone")
// === arriba, cerca de apiUrl ===
const AVAIL_FOLDERS = ["/00004/Nubes", "/00004/CSV"]; // Drone + CSV

const isFolder = (it) =>
  String(it?.type || it?.[".tag"] || it?.tag || "")
    .toLowerCase()
    .includes("folder");



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

  const handleShowDescargarPuntosModal = () => {
    setShowDescargaPuntosModal(true);
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
      console.log("Datos recibidos:", JSON.stringify(data, null, 2));

      setArchivosPorCategoria(data.archivos || {});

      if (categoria) {
        setArchivosMostrados(data.archivos[categoria] || []);
      } else {
        const todosArchivos = Object.values(data.archivos).flat();
        console.log("Todos los archivos:", todosArchivos); // Confirmar contenido
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

// === reemplaza tu useEffect de fetch/polling del contador ===
useEffect(() => {
  const folders = AVAIL_FOLDERS.join(",");
  const es = new EventSource(`${apiUrl}/events?folders=${encodeURIComponent(folders)}`, { withCredentials: false });

  let closed = false;

  const onMessage = (ev) => {
    if (!ev.data) return;
    try {
      const msg = JSON.parse(ev.data); // { type, folder, name, size, ts }
      if (msg.type === "file_created") {
        // 1) Mostrá notificación
        // 2) Si querés, refrescá el conteo UNA sola vez:
        fetchCountOnce(); // tu función existente pero sin intervalos agresivos
      }
    } catch {}
  };

  const onOpen = () => console.log("SSE abierto");
  const onError = () => {
    console.warn("SSE error; reintentará solo");
    // EventSource reintenta solo; no hagas reconexión manual salvo que quieras backoff custom
  };

  es.addEventListener("message", onMessage);
  es.addEventListener("open", onOpen);
  es.addEventListener("error", onError);

  const fetchCountOnce = async () => {
    // Podés usar la opción /list_counts que te pasé en el mensaje anterior
    try {
      const r = await fetch(`${apiUrl}/list_counts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folders: AVAIL_FOLDERS }),
      });
      if (!r.ok) return;
      const counts = await r.json();
      const total = Object.values(counts).reduce((a,b)=>a+(b||0),0);
      setPuntosCount(total);
    } catch {}
  };

  document.addEventListener("visibilitychange", () => {
    // opcional: cuando vuelve visible, hacé un sync por las dudas
    if (!document.hidden) fetchCountOnce();
  });

  return () => {
    if (!closed) {
      es.close();
      closed = true;
    }
  };
}, [apiUrl]);

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
              let centro = null;

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

                centro = L.polygon(coords).getBounds().getCenter();
              }

              // Agregar etiqueta en el centro del polígono
              if (centro && poligonoNombre) {
                const etiqueta = L.marker(centro, {
                  icon: L.divIcon({
                    className: "polygon-label",
                    html: `<div class="label-container">${poligonoNombre}</div>`,
                    iconSize: [100, 30],
                    iconAnchor: [50, 15],
                  }),
                  interactive: false,
                  zIndexOffset: 1000,
                }).addTo(mapRef.current);

                etiqueta.setOpacity(0);
                mapRef.current.on("zoomend", () => {
                  const currentZoom = mapRef.current.getZoom();
                  const polygonBounds = layer.getBounds();
                  const polygonSize = mapRef.current
                    .latLngToLayerPoint(polygonBounds.getNorthEast())
                    .subtract(
                      mapRef.current.latLngToLayerPoint(
                        polygonBounds.getSouthWest()
                      )
                    );

                  const shouldShow =
                    currentZoom >= 13 ||
                    (polygonSize.x > 150 && polygonSize.y > 150);

                  etiqueta.setOpacity(shouldShow ? 1 : 0);
                });
              }

              // Crear contenido del popup dinámicamente
              const popupContainer = document.createElement("div");

              if (poligonoNombre) {
                const titulo = document.createElement("b");
                titulo.textContent = `C ${poligonoNombre}`;
                popupContainer.appendChild(titulo);
                popupContainer.appendChild(document.createElement("br"));
              }

              const areaTexto = document.createElement("span");
              areaTexto.textContent = `Área: ${areaFormatted} ha`;
              popupContainer.appendChild(areaTexto);

              if (archivosAsociados.length > 0) {
                popupContainer.appendChild(document.createElement("br"));
                const listaArchivos = document.createElement("ul");

                archivosAsociados.forEach((archivoUrl) => {
                  console.log("URL usada:", archivoUrl);

                  const nombreArchivo = archivoUrl.split("/").pop();
                  const nombreAjustado = nombreArchivo.replace(/_/g, " ");

                  const listItem = document.createElement("li");
                  const enlace = document.createElement("a");
                  enlace.textContent = nombreAjustado;
                  enlace.href = archivoUrl;
                  enlace.target = "_blank";
                  enlace.download = nombreAjustado;

                  enlace.addEventListener("click", (e) => {
                    e.preventDefault();

                    if (archivoUrl.includes("amazonaws.com")) {
                      // Abrir directo en nueva pestaña para evitar problemas con CORS o headers
                      window.open(archivoUrl, "_blank");
                      return;
                    }

                    // Si no es URL S3, fallback con fetch para descargar blob
                    fetch(archivoUrl)
                      .then((res) => {
                        if (!res.ok)
                          throw new Error(
                            `Error al descargar el archivo: ${res.statusText}`
                          );
                        return res.blob();
                      })
                      .then((blob) => {
                        const urlBlob = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = urlBlob;
                        a.download = nombreAjustado;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(urlBlob);
                      })
                      .catch((error) => {
                        console.error(
                          "Error al descargar el archivo desde el blob:",
                          error
                        );
                        alert(
                          "No se pudo descargar el archivo. Intente nuevamente."
                        );
                      });
                  });

                  listItem.appendChild(enlace);
                  listaArchivos.appendChild(listItem);
                });

                popupContainer.appendChild(listaArchivos);
              }

              layer.bindPopup(popupContainer);
            },
          }).addTo(mapRef.current);

          // Ajustar el mapa para mostrar el contenido del KML
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
    // Función mejorada para agregar control de ubicación
    const addLocationControl = () => {
      // Función principal para manejar la geolocalización
      const handleLocate = async () => {
        // 1. Verificar soporte de geolocalización
        if (!navigator.geolocation) {
          showGeolocationError({
            code: 0,
            message: "Geolocalización no soportada por tu navegador",
          });
          return;
        }

        // 2. Mostrar indicador de carga mejorado
        const loadingIndicator = createLoadingIndicator();
        map.getContainer().appendChild(loadingIndicator);

        try {
          // 3. Verificar permisos (mejorado para más navegadores)
          let permissionGranted = true;

          if (navigator.permissions?.query) {
            try {
              const permissionStatus = await navigator.permissions.query({
                name: "geolocation",
              });
              if (permissionStatus.state === "denied") {
                permissionGranted = false;
                showPermissionInstructions();
              }
            } catch (e) {
              console.log("API de permisos no disponible en este navegador");
            }
          }

          if (!permissionGranted) {
            map.getContainer().removeChild(loadingIndicator);
            return;
          }

          // 4. Obtener ubicación con opciones mejoradas
          navigator.geolocation.getCurrentPosition(
            (position) => handleGeolocationSuccess(position, loadingIndicator),
            (error) => handleGeolocationError(error, loadingIndicator),
            {
              enableHighAccuracy: true,
              timeout: 15000, // 15 segundos es más razonable
              maximumAge: 0,
            }
          );
        } catch (error) {
          console.error("Error inesperado:", error);
          map.getContainer().removeChild(loadingIndicator);
          showGeolocationError({
            code: 0,
            message: "Error inesperado al obtener la ubicación",
          });
        }
      };

      // Función para crear indicador de carga
      const createLoadingIndicator = () => {
        const indicator = L.DomUtil.create("div", "location-loading-indicator");
        indicator.innerHTML = `
      <div style="
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        font-size: 14px;
        min-width: 200px;
      ">
        <div style="
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top: 2px solid white;
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
          margin-right: 12px;
        "></div>
        Buscando tu ubicación...
      </div>
    `;
        indicator.style.position = "absolute";
        indicator.style.bottom = "30px";
        indicator.style.left = "50%";
        indicator.style.transform = "translateX(-50%)";
        indicator.style.zIndex = "1000";

        // Agregar animación CSS
        const style = document.createElement("style");
        style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
        indicator.appendChild(style);

        return indicator;
      };

      // Manejar éxito en geolocalización
      const handleGeolocationSuccess = (position, loadingIndicator) => {
        // Eliminar indicador de carga
        if (loadingIndicator.parentNode) {
          map.getContainer().removeChild(loadingIndicator);
        }

        const { latitude, longitude, accuracy } = position.coords;
        const userLatLng = [latitude, longitude];
        console.log(
          "Ubicación obtenida:",
          latitude,
          longitude,
          "Precisión:",
          accuracy,
          "metros"
        );

        // Centrar mapa con animación mejorada
        map.flyTo(userLatLng, 16, {
          duration: 0.75,
          easeLinearity: 0.1,
        });

        // Limpiar marcadores previos de ubicación
        clearPreviousLocationMarkers();

        // Añadir marcador con estilo mejorado y efecto de pulso
        const marker = L.marker(userLatLng, {
          icon: L.divIcon({
            className: "location-marker",
            html: `
          <div style="
            position: relative;
            width: 26px;
            height: 26px;
          ">
            <div style="
              background-color: #4285F4;
              border-radius: 50%;
              width: 100%;
              height: 100%;
              border: 3px solid white;
              box-shadow: 0 0 5px rgba(0,0,0,0.3);
              position: relative;
              z-index: 2;
            "></div>
            <div style="
              position: absolute;
              top: -10px;
              left: -10px;
              width: 46px;
              height: 46px;
              border-radius: 50%;
              background-color: rgba(66, 133, 244, 0.3);
              animation: pulse 2s infinite;
              z-index: 1;
            "></div>
          </div>
        `,
            iconSize: [46, 46],
            iconAnchor: [23, 23],
          }),
        }).addTo(map);

        // Popup mejorado
        marker
          .bindPopup(
            `
      <div style="font-size: 14px;">
        <b style="color: #4285F4;">Tu ubicación actual</b>
        <div style="margin-top: 6px;">
          <div>Lat: ${latitude.toFixed(6)}</div>
          <div>Lng: ${longitude.toFixed(6)}</div>
          ${
            accuracy
              ? `<div>Precisión: ~${Math.round(accuracy)} metros</div>`
              : ""
          }
        </div>
      </div>
    `
          )
          .openPopup();

        // Añadir círculo de precisión si es relevante
        if (accuracy && accuracy < 500) {
          // Solo mostrar para precisiones menores a 500m
          L.circle(userLatLng, {
            radius: accuracy,
            fillColor: "#4285F4",
            fillOpacity: 0.15,
            color: "#4285F4",
            weight: 1,
            dashArray: "5, 5",
          }).addTo(map);
        }
      };

      // Limpiar marcadores previos de ubicación
      const clearPreviousLocationMarkers = () => {
        map.eachLayer((layer) => {
          if (
            layer instanceof L.Marker &&
            layer.options.icon?.options?.className === "location-marker"
          ) {
            map.removeLayer(layer);
          }
          if (
            layer instanceof L.Circle &&
            layer.options.fillColor === "#4285F4"
          ) {
            map.removeLayer(layer);
          }
        });
      };

      // Función mejorada para mostrar instrucciones de permisos
      const showPermissionInstructions = () => {
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);
        const isChrome = /Chrome/i.test(navigator.userAgent);
        const isFirefox = /Firefox/i.test(navigator.userAgent);
        const isSafari = /Safari/i.test(navigator.userAgent) && !isChrome;

        let instructions = "";
        let icon = "📍";

        if (isIOS) {
          icon = "";
          instructions = `
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Abre la app <b>Ajustes</b> en tu dispositivo</li>
          <li>Desplázate y selecciona <b>Safari</b></li>
          <li>Toca <b>Ubicación</b></li>
          <li>Selecciona <b>"Preguntar"</b> o <b>"Permitir"</b></li>
          <li>Vuelve a esta página y recarga</li>
        </ol>
      `;
        } else if (isAndroid) {
          icon = "🤖";
          instructions = `
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Abre <b>Configuración</b> en tu dispositivo</li>
          <li>Ve a <b>Aplicaciones</b> o <b>Apps</b></li>
          <li>Busca tu navegador (Chrome, etc.)</li>
          <li>Toca <b>Permisos</b></li>
          <li>Habilita <b>Ubicación</b></li>
          <li>Vuelve a esta página y recarga</li>
        </ol>
      `;
        } else {
          icon = "💻";
          const browserName = isChrome
            ? "Chrome"
            : isFirefox
            ? "Firefox"
            : isSafari
            ? "Safari"
            : "tu navegador";

          instructions = `
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Haz clic en el icono de <b>candado</b> en la barra de direcciones</li>
          <li>Selecciona <b>Configuración del sitio</b> o <b>Permisos</b></li>
          <li>Busca la opción <b>Ubicación</b></li>
          <li>Cambia a <b>Permitir</b></li>
          <li>Recarga la página</li>
        </ol>
        <div style="font-size: 12px; margin-top: 10px; color: #666;">
          En ${browserName}, también puedes encontrar esta opción en la configuración del navegador.
        </div>
      `;
        }

        // Crear modal con instrucciones
        const modal = document.createElement("div");
        modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
    `;

        modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 10px;
        padding: 25px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
      ">
        <div style="
          font-size: 24px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          color: #4285F4;
        ">
          <span style="margin-right: 10px;">${icon}</span>
          <span>Permiso de ubicación requerido</span>
        </div>
        
        <div style="
          background: #f8f9fa;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 20px;
        ">
          ${instructions}
        </div>
        
        <button style="
          background: #4285F4;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          width: 100%;
          font-size: 16px;
          transition: background 0.2s;
        " onmouseover="this.style.background='#3367d6'" 
         onmouseout="this.style.background='#4285F4'">
          Entendido, voy a configurarlo
        </button>
      </div>
    `;

        modal.querySelector("button").addEventListener("click", () => {
          document.body.removeChild(modal);
        });

        document.body.appendChild(modal);
      };

      // Función mejorada para manejar errores
      const handleGeolocationError = (error, loadingIndicator) => {
        // Eliminar indicador de carga si existe
        if (loadingIndicator && loadingIndicator.parentNode) {
          map.getContainer().removeChild(loadingIndicator);
        }

        console.error("Error de geolocalización:", error);

        const errorDetails = {
          1: {
            title: "Permiso denegado",
            message:
              "Debes habilitar los permisos de ubicación para usar esta función.",
            action: "Configurar permisos",
          },
          2: {
            title: "Ubicación no disponible",
            message:
              "No se pudo obtener tu ubicación. Verifica que el GPS esté activado.",
            action: "Reintentar",
          },
          3: {
            title: "Tiempo agotado",
            message:
              "La solicitud de ubicación tardó demasiado. ¿Estás en un área con poca cobertura?",
            action: "Reintentar",
          },
          default: {
            title: "Error desconocido",
            message: "Ocurrió un problema al obtener tu ubicación.",
            action: "Reintentar",
          },
        };

        const { title, message, action } =
          errorDetails[error.code] || errorDetails.default;

        // Mostrar notificación de error en el mapa
        const errorNotification = L.control({ position: "bottomcenter" });

        errorNotification.onAdd = () => {
          const div = L.DomUtil.create("div", "location-error-notification");
          div.innerHTML = `
        <div style="
          background: #ff4444;
          color: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.2);
          max-width: 280px;
          text-align: center;
        ">
          <div style="
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="margin-right: 8px;">❌</span>
            <span>${title}</span>
          </div>
          <div style="font-size: 14px; margin-bottom: 12px;">${message}</div>
          <div style="display: flex; gap: 8px;">
            <button style="
              flex: 1;
              background: white;
              color: #ff4444;
              border: none;
              padding: 8px;
              border-radius: 4px;
              font-weight: bold;
              cursor: pointer;
              transition: background 0.2s;
            " onmouseover="this.style.background='#f1f1f1'" 
             onmouseout="this.style.background='white'">
              ${action}
            </button>
            ${
              error.code === 1
                ? `
            <button style="
              flex: 1;
              background: transparent;
              color: white;
              border: 1px solid white;
              padding: 8px;
              border-radius: 4px;
              font-weight: bold;
              cursor: pointer;
              transition: background 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
             onmouseout="this.style.background='transparent'">
              Ayuda
            </button>
            `
                : ""
            }
          </div>
        </div>
      `;

          // Configurar acciones de los botones
          const buttons = div.querySelectorAll("button");
          buttons[0].addEventListener("click", () => {
            if (error.code === 1) {
              showPermissionInstructions();
            } else {
              handleLocate();
            }
            map.removeControl(errorNotification);
          });

          if (buttons[1]) {
            buttons[1].addEventListener("click", () => {
              showPermissionInstructions();
              map.removeControl(errorNotification);
            });
          }

          return div;
        };

        errorNotification.addTo(map);

        // Auto-eliminar después de 15 segundos
        setTimeout(() => {
          if (map.hasControl(errorNotification)) {
            map.removeControl(errorNotification);
          }
        }, 15000);
      };

      // Crear control de ubicación con mejoras UX
      const locationControl = L.control({ position: "topright" });

      locationControl.onAdd = () => {
        const div = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        div.style.cursor = "pointer";

        // Botón con efectos hover y active
        div.innerHTML = `
      <button style="
        background: white;
        border: 2px solid rgba(0,0,0,0.2);
        border-radius: 5px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        outline: none;
      " title="Centrar en mi ubicación" aria-label="Mi ubicación">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#4285F4">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </button>
    `;

        const button = div.querySelector("button");

        // Efectos de interacción
        button.addEventListener("mouseenter", () => {
          button.style.background = "#f8f9fa";
          button.style.borderColor = "rgba(0,0,0,0.3)";
        });

        button.addEventListener("mouseleave", () => {
          button.style.background = "white";
          button.style.borderColor = "rgba(0,0,0,0.2)";
        });

        button.addEventListener("mousedown", () => {
          button.style.transform = "scale(0.95)";
          button.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.1)";
        });

        button.addEventListener("mouseup", () => {
          button.style.transform = "";
          button.style.boxShadow = "";
        });

        button.addEventListener("click", (e) => {
          e.stopPropagation();
          handleLocate();
        });

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
<button className="btn btn-primary me-2" onClick={handleShowDescargarPuntosModal}>
  Descarga de puntos {puntosCount > 0 && `(${puntosCount})`}
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

      {showDescargaPuntosModal && (
        <>
          <div
            className="modal fade show"
            style={{ display: "block", backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          >
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Descarga de Puntos</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setShowDescargaPuntosModal(false);
                      window.location.reload();
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  <DescargarPuntos
                    onClose={() => {
                      setShowDescargaPuntosModal(false);
                      window.location.reload();
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;
