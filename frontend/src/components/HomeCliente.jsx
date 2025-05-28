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
  const kmlBoundsRef = useRef(null); // Referencia para guardar los bounds del KML
  const apiUrl = "https://appproducotres-backend.onrender.com/"

  //const apiUrl = "http://192.168.1.246:3001/";
  //const apiUrl = "http://192.168.1.65:3001/";
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
      kmlBoundsRef.current = null; // Limpiar bounds cuando no hay KML
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
            
              // Calcular el área del polígono
              let areaFormatted = "N/A";
              let centro = null;
            
              if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
                const coords =
                  feature.geometry.type === "Polygon"
                    ? feature.geometry.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng))
                    : feature.geometry.coordinates[0][0].map(([lng, lat]) => L.latLng(lat, lng));
                const area = L.GeometryUtil.geodesicArea(coords);
                areaFormatted = (area / 10000).toFixed(2); // Convertir a hectáreas (ha)
            
                // Calcular el centro geométrico del polígono
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
  
  // Ocultar inicialmente
  etiqueta.setOpacity(0);
  
  // Controlar visibilidad basada en el zoom
  mapRef.current.on('zoomend', function() {
    const currentZoom = mapRef.current.getZoom();
    const polygonBounds = layer.getBounds();
    const polygonSize = mapRef.current.latLngToLayerPoint(polygonBounds.getNorthEast())
                      .subtract(mapRef.current.latLngToLayerPoint(polygonBounds.getSouthWest()));
    
    // Mostrar solo si estamos lo suficientemente cerca
    const shouldShow = currentZoom >= 13 || // Zoom mínimo
                     (polygonSize.x > 150 && polygonSize.y > 150); // Tamaño mínimo en píxeles
    
    etiqueta.setOpacity(shouldShow ? 1 : 0);
  });
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

  const cargarKmlsProductor = async (productorId) => {
    setCargandoKml(true);
    kmlBoundsRef.current = null; // Resetear bounds antes de cargar nuevos KMLs

    try {
      const response = await fetch(
        `${apiUrl}api/productor/kml?cod_productor=${productorId}`
      );
      if (!response.ok) throw new Error("Error cargando KMLs");
      const data = await response.json();
      setKmlData(data);

      // Limpiar capas anteriores
      kmlLayers.forEach((layer) => mapRef.current?.removeLayer(layer));
      setKmlLayers([]);

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
    // Verificar si el mapa ya está inicializado
    if (mapRef.current) return;

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

        try {fixed-top
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
      <div
        className="d-flex align-items-center justify-content-between bg-light shadow-sm p-2 "
        style={{ top: "60px" }}
      >
        <div className="d-flex align-items-center">
          <button
            className="btn btn-primary me-2"
            onClick={handleVerInformesClick}
          >
            Ver Informes
          </button>
        </div>
      </div>

      <main className="flex-grow-1 position-relative">
        <div
          id="map"
          style={{
            height: "calc(100vh - 120px)", // 60px header + 60px barra adicional
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
                onClose={() => setShowInformesModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeCliente;
