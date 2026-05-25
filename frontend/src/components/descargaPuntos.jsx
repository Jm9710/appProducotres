import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";

/**
 * DescargaPuntos
 *
 * Funcionalidad pedida:
 * - Botón/formulario para Cargar archivos
 * - Listado de archivos disponibles (carpeta de "entrantes" en Dropbox)
 * - Reglas de subida:
 *   - Medido por DRON: subir un LAS y un DXF, comprimirlos en ZIP (nombre elegido por el usuario)
 *   - Medido por GPS: subir CSV tal cual (sin comprimir, conserva el nombre de archivo)
 * - Descarga: cuando se descarga un archivo, debe moverse automáticamente a otra carpeta en Dropbox
 *   y desaparecer de la lista (carpeta de "procesados").
 *
 * Notas de integración backend asumidas (Flask sugerido):
 *   GET    /list?folder=<path>                 -> lista archivos de Dropbox en <path>
 *   POST   /upload (multipart: file, path)     -> sube archivo a Dropbox en "path"
 *   GET    /download?path=<path>               -> descarga archivo binario (Content-Disposition)
 *   POST   /move                               -> { from: <path>, to: <path> }
 *   GET    /consume?path=...&dest=...          -> (opcional) descarga y mueve en una sola llamada
 *
 * Si /consume no existe, este componente hace fallback a (descargar -> mover) en dos pasos.
 */

const AVAILABLE_FOLDER = "/superficies/entrantes";   // carpeta "disponibles"
const PROCESSED_FOLDER = "/superficies/procesados";  // carpeta "descargados"
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "https://appproducotres-backend.onrender.com/";

const apiUrl = (path) => `${API_BASE_URL.replace(/\/$/, "")}${path}`;

const DescargaPuntos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  // Form state
  const [modo, setModo] = useState("drone"); // "drone" | "gps"
  const [lasFile, setLasFile] = useState(null);
  const [dxfFile, setDxfFile] = useState(null);
  const [zipName, setZipName] = useState("");
  const [csvFiles, setCsvFiles] = useState([]);

  const canUpload = useMemo(() => {
    if (modo === "drone") {
      return !!lasFile && !!dxfFile && zipName.trim().length > 0;
    }
    // gps
    return csvFiles && csvFiles.length > 0;
  }, [modo, lasFile, dxfFile, zipName, csvFiles]);

  // Helpers -------------------------------------------------------------
  const fetchList = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/list?folder=${encodeURIComponent(AVAILABLE_FOLDER)}`));
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  // Upload --------------------------------------------------------------
  const handleUpload = async () => {
    setError("");
    if (!canUpload) return;

    try {
      if (modo === "drone") {
        // Crear ZIP con LAS + DXF
        const zip = new JSZip();
        zip.file(lasFile.name, lasFile);
        zip.file(dxfFile.name, dxfFile);
        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        const finalName = zipName.endsWith(".zip") ? zipName : `${zipName}.zip`;
        const path = `${AVAILABLE_FOLDER}/${finalName}`;

        const fd = new FormData();
        fd.append("file", new File([blob], finalName, { type: "application/zip" }));
        fd.append("path", path);

        console.log("[ZIP_UPLOAD]", {
          name: finalName,
          bytes: blob.size,
          contentType: blob.type || "application/zip"
        });

        const up = await fetch(apiUrl("/upload"), { method: "POST", body: fd });
        if (!up.ok) throw new Error(await up.text());
      } else {
        // GPS: subir CSV(s) tal cual (uno por uno)
        for (const f of csvFiles) {
          const fd = new FormData();
          const path = `${AVAILABLE_FOLDER}/${f.name}`;
          fd.append("file", f, f.name);
          fd.append("path", path);
          const up = await fetch(apiUrl("/upload"), { method: "POST", body: fd });
          if (!up.ok) throw new Error(await up.text());
        }
      }

      // Limpio formulario y refresco lista
      setLasFile(null);
      setDxfFile(null);
      setZipName("");
      setCsvFiles([]);
      await fetchList();
      alert("Subida completada");
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    }
  };

  // Download + Move -----------------------------------------------------
  const handleDownload = async (item) => {
    setError("");
    const fromPath = item.path;
    const fileName = item.name;
    const toPath = `${PROCESSED_FOLDER}/${fileName}`;

    try {
      // 1) Intento /consume (descarga y move atómico)
      const consumeUrl = apiUrl(`/consume?path=${encodeURIComponent(fromPath)}&dest=${encodeURIComponent(toPath)}`);
      const tryConsume = await fetch(consumeUrl);

      if (tryConsume.ok) {
        // Descargar blob devuelto por /consume
        const blob = await readDownloadBlob(tryConsume, fileName);
        triggerBrowserDownload(blob, fileName);
      } else if (tryConsume.status === 404) {
        // 2) Fallback: /download y luego /move
        const down = await fetch(apiUrl(`/download?path=${encodeURIComponent(fromPath)}`));
        if (!down.ok) throw new Error(await down.text());
        const blob = await readDownloadBlob(down, fileName);
        triggerBrowserDownload(blob, fileName);

        // mover
        const mv = await fetch(apiUrl("/move"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: fromPath, to: toPath })
        });
        if (!mv.ok) throw new Error(await mv.text());
      } else {
        throw new Error(await tryConsume.text());
      }

      // refrescar lista (el archivo debe desaparecer de disponibles)
      await fetchList();
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    }
  };

  const readDownloadBlob = async (response, fileName) => {
    const contentType = response.headers.get("Content-Type") || "";
    const contentLength = response.headers.get("Content-Length");
    const disposition = response.headers.get("Content-Disposition") || "";

    console.log("[ZIP_DOWNLOAD_HEADERS]", {
      fileName,
      contentType,
      contentLength,
      disposition
    });

    if (/text\/html|application\/json|text\/plain/i.test(contentType)) {
      const body = await response.text();
      throw new Error(
        `La descarga de ${fileName} no devolvio un binario ZIP. ` +
        `Content-Type=${contentType || "sin header"}. ` +
        body.slice(0, 200)
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const expected = contentLength ? Number(contentLength) : null;
    const received = arrayBuffer.byteLength;

    console.log("[ZIP_DOWNLOAD_BODY]", {
      fileName,
      expectedBytes: expected,
      receivedBytes: received,
      contentType
    });

    if (expected !== null && expected !== received) {
      throw new Error(`Tamaño de descarga inválido para ${fileName}: esperado ${expected}, recibido ${received}`);
    }

    const blobType = fileName.toLowerCase().endsWith(".zip")
      ? "application/zip"
      : contentType || "application/octet-stream";
    return new Blob([arrayBuffer], { type: blobType });
  };

  const triggerBrowserDownload = (blob, name) => {
    console.log("[BROWSER_DOWNLOAD]", {
      name,
      bytes: blob.size,
      contentType: blob.type
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // UI ------------------------------------------------------------------
  return (
    <div className="container py-3">
      <h3 className="mb-3">Cargar y descargar superficies</h3>

      {/* Formulario de carga */}
      <div className="card shadow-sm mb-4">
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
                <label className="form-check-label" htmlFor="modoDrone">Dron (LAS + DXF → ZIP)</label>
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
                <label className="form-check-label" htmlFor="modoGPS">GPS (CSV)</label>
              </div>
            </div>
          </div>

          {modo === "drone" ? (
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Archivo LAS</label>
                <input className="form-control" type="file" accept=".las,.laz" onChange={(e)=>setLasFile(e.target.files?.[0]||null)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Archivo DXF</label>
                <input className="form-control" type="file" accept=".dxf" onChange={(e)=>setDxfFile(e.target.files?.[0]||null)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Nombre del ZIP</label>
                <input className="form-control" placeholder="ej: campo_norte_2025-08-28.zip" value={zipName} onChange={(e)=>setZipName(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <label className="form-label">Archivos CSV</label>
              <input className="form-control" type="file" multiple accept=".csv" onChange={(e)=>setCsvFiles(Array.from(e.target.files||[]))} />
              <div className="form-text">Puedes seleccionar uno o varios CSV.</div>
            </div>
          )}

          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-success" disabled={!canUpload} onClick={handleUpload}>
              Cargar archivos
            </button>
            {error && <span className="text-danger">{error}</span>}
          </div>
        </div>
      </div>

      {/* Lista de archivos disponibles */}
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="m-0">Archivos disponibles</h5>
            <button className="btn btn-outline-secondary btn-sm" onClick={fetchList} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-muted">No hay archivos en espera.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.path_lower || it.path}>
                      <td>{it.name}</td>
                      <td>{it.type?.replace("Metadata", "").replace("File", "Archivo") || "Archivo"}</td>
                      <td className="text-end">
                        <button className="btn btn-primary btn-sm" onClick={() => handleDownload({
                          name: it.name,
                          path: it.path_lower || it.path || `${AVAILABLE_FOLDER}/${it.name}`
                        })}>
                          Descargar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DescargaPuntos;
