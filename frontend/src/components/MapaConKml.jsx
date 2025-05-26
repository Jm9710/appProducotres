import React, { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-kml"; // Asegúrate de tener este paquete para cargar KML


const MapWithKML = ({ productorId }) => {
  const [kmlUrls, setKmlUrls] = useState([]);

  const apiUrl = "https://appproducotres-backend.onrender.com"

  //const apiUrl = "http://192.168.1.246:3001/";
  //const apiUrl = "http://192.168.1.65:3001/";

  useEffect(() => {
    // Hacer una solicitud para obtener las URLs de los archivos KML del productor
    const fetchKMLUrls = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/kml/${productorId}`);
        const data = await response.json();
        setKmlUrls(data); // Guardar las URLs de los archivos KML
      } catch (error) {
        console.error("Error al cargar los KML:", error);
      }
    };

    fetchKMLUrls();
  }, [productorId]);

  useEffect(() => {
    if (kmlUrls.length > 0) {
      const map = L.map("map").setView([-33.184, -55.94], 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

      kmlUrls.forEach((url) => {
        // Cargar cada archivo KML en el mapa usando leaflet-kml
        new L.KML(url, {
          async: true,
          onEachFeature: function (feature, layer) {
            // Aquí puedes agregar cualquier personalización de los popups, tooltips, etc.
            layer.bindPopup("<b>" + feature.properties.name + "</b>");
          }
        }).addTo(map);
      });
    }
  }, [kmlUrls]);

  return (
    <main
      className={`col-${kmlUrls.length > 0 ? "11" : "9"} d-flex align-items-center justify-content-center`}
      style={{ height: "100vh" }}
    >
      <div id="map" style={{ height: "100%", width: "100%" }} />
    </main>
  );
};

export default MapWithKML;
