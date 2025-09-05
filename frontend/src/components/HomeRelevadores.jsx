import React, { useMemo, useState } from "react";
import JSZip from "jszip";
import { useNavigate } from "react-router-dom";

const apiUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://appproducotres-backend.onrender.com/";

// --- Helper: POST con progreso real usando XHR ---
function xhrPostWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    // si tu backend usa cookies/sesión habilita:
    // xhr.withCredentials = true;

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && typeof onProgress === "function") {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        onProgress(pct);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
      else reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Error de red al subir archivo"));
    xhr.send(formData);
  });
}

const uploadUrl = `${apiUrl.replace(/\/$/, "")}/upload`;

const PATHS = {
  drone: { avail: "/00004/Nubes" },
  gps: { avail: "/00004/CSV" },
};

export default function HomeRelevadores() {
  const [modo, setModo] = useState("drone");
  const [lasFile, setLasFile] = useState(null);
  const [dxfFile, setDxfFile] = useState(null);
  const [zipName, setZipName] = useState("");
  const [csvFiles, setCsvFiles] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saliendo, setSaliendo] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100
  const [stage, setStage] = useState(""); // Texto de etapa
  const [currentFile, setCurrentFile] = useState(""); // Nombre archivo actual

  const navigate = useNavigate();

  const canUpload = useMemo(() => {
    if (modo === "drone") return !!lasFile && !!dxfFile && zipName.trim().length > 0;
    return csvFiles && csvFiles.length > 0;
  }, [modo, lasFile, dxfFile, zipName, csvFiles]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("nombre");
    navigate("/");
  };

  // Mapea progreso de sub-etapas a una barra única:
  // - Zipping: 0% -> 60%
  // - Upload:  60% -> 100%
  const mapZipPct = (zipPct) => Math.min(60, Math.round((zipPct / 100) * 60));
  const mapUploadPct = (uploadPct) => Math.min(100, 60 + Math.round((uploadPct / 100) * 40));

  const handleUpload = async () => {
    setMsg("");
    setError("");
    setProgress(0);
    setStage("");
    setCurrentFile("");

    if (!canUpload) return;
    setSubiendo(true);

    try {
      if (modo === "drone") {
        // 1) Generar ZIP con progreso
        setStage("Comprimiendo (ZIP)...");
        const zip = new JSZip();
        zip.file(lasFile.name, lasFile);
        zip.file(dxfFile.name, dxfFile);

        const blob = await zip.generateAsync(
          { type: "blob", compression: "DEFLATE" },
          (metadata) => {
            // metadata.percent: 0..100
            setProgress(mapZipPct(metadata.percent));
          }
        );

        // 2) Subir ZIP con progreso real
        const finalName = zipName.endsWith(".zip") ? zipName : `${zipName}.zip`;
        const path = `${PATHS.drone.avail}/${finalName}`;
        setStage("Subiendo ZIP...");
        setCurrentFile(finalName);

        const fd = new FormData();
        fd.append("file", new File([blob], finalName, { type: "application/zip" }));
        fd.append("path", path);

        await xhrPostWithProgress(uploadUrl, fd, (pct) => setProgress(mapUploadPct(pct)));
      } else {
        // Múltiples CSV: progreso acumulado por tamaño
        const totalBytes = csvFiles.reduce((acc, f) => acc + (f?.size || 0), 0) || 1;
        let uploadedBytes = 0;

        for (const f of csvFiles) {
          setStage("Subiendo CSV...");
          setCurrentFile(f.name);

          // Para aproximar el progreso global, combinamos:
          // - el progreso del XHR para este archivo (0..size)
          // - sumamos lo ya subido
          const fd = new FormData();
          fd.append("file", f, f.name);
          fd.append("path", `${PATHS.gps.avail}/${f.name}`);

          await xhrPostWithProgress(uploadUrl, fd, (pct) => {
            // bytes de ESTE archivo a esta altura:
            const thisLoaded = Math.round((pct / 100) * f.size);
            const globalLoaded = uploadedBytes + thisLoaded;
            const globalPct = Math.round((globalLoaded / totalBytes) * 100);
            // Reservamos un 60-100% para "subiendo" en CSV (no hay zipping),
            // pero como son archivos planos, mostramos rango completo 0-100.
            setProgress(globalPct);
          });

          uploadedBytes += f.size;
          setProgress(Math.round((uploadedBytes / totalBytes) * 100));
        }
      }

      // Reset UI
      setLasFile(null);
      setDxfFile(null);
      setZipName("");
      setCsvFiles([]);
      setStage("");
      setCurrentFile("");
      setMsg("✅ Subida completada");
    } catch (e) {
      console.error(e);
      setError(`❌ Error: ${e.message || e}`);
    } finally {
      setSubiendo(false);
      // Si quedó la barra a menos de 100 por algún redondeo, la cerramos:
      setProgress((p) => (p < 100 && !error ? 100 : p));
    }
  };

  return (
    <div className="container py-3">
      {/* Encabezado con botón de cerrar sesión */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">Cargar superficies</h3>
        <button
          className="btn btn-outline-danger btn-sm"
          onClick={handleLogout}
          disabled={saliendo}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          {saliendo ? "Saliendo..." : "Cerrar sesión"}
        </button>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label">Tipo de medición</label>
            <div className="d-flex gap-3">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="modo"
                  id="modoDrone"
                  checked={modo === "drone"}
                  onChange={() => setModo("drone")}
                />
                <label className="form-check-label" htmlFor="modoDrone">
                  Dron (LAS + DXF → ZIP)
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="modo"
                  id="modoGPS"
                  checked={modo === "gps"}
                  onChange={() => setModo("gps")}
                />
                <label className="form-check-label" htmlFor="modoGPS">
                  GPS (CSV)
                </label>
              </div>
            </div>
          </div>

          {modo === "drone" ? (
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Archivo LAS</label>
                <input
                  className="form-control"
                  type="file"
                  accept=".las,.laz"
                  onChange={(e) => setLasFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Archivo DXF</label>
                <input
                  className="form-control"
                  type="file"
                  accept=".dxf"
                  onChange={(e) => setDxfFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Nombre del ZIP</label>
                <input
                  className="form-control"
                  placeholder="ej: campo_norte_2025-08-28.zip"
                  value={zipName}
                  onChange={(e) => setZipName(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <label className="form-label">Archivos CSV</label>
              <input
                className="form-control"
                type="file"
                multiple
                accept=".csv"
                onChange={(e) => setCsvFiles(Array.from(e.target.files || []))}
              />
              <div className="form-text">Puedes seleccionar uno o varios CSV.</div>
            </div>
          )}

          {/* Barra de progreso */}
          {subiendo && (
            <div className="my-3">
              <div className="d-flex justify-content-between">
                <small className="text-muted">
                  {stage || "Procesando..."} {currentFile && `• ${currentFile}`}
                </small>
                <small className="text-muted">{progress}%</small>
              </div>
              <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                <div
                  className="progress-bar progress-bar-striped progress-bar-animated"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="d-flex align-items-center gap-2 mt-2">
            <button
              className="btn btn-success"
              disabled={!canUpload || subiendo}
              onClick={handleUpload}
            >
              {subiendo ? "Subiendo..." : "Cargar archivos"}
            </button>
            {msg && <span className="text-success">{msg}</span>}
            {error && <span className="text-danger">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
