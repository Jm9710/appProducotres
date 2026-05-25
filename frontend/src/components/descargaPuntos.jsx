import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";

<<<<<<< HEAD
// ===== Base URL (igual que en Home) =====
const apiUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://appproducotres-backend.onrender.com/";

// Helpers de fetch
const apiGet = (pathWithQuery) =>
  fetch(`${apiUrl.replace(/\/$/, "")}${pathWithQuery}`);
const apiPostJson = (path, body) =>
  fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const apiPostForm = (path, formData) =>
  fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    body: formData,
  });

// Rutas Dropbox por modo
const PATHS = {
  drone: { avail: "/00004/Nubes", processed: "/00004/Nubes/Descargados" },
  gps: { avail: "/00004/CSV", processed: "/00004/CSV/Descargados" },
};

// --- Helper robusto para detectar carpetas ---
const isFolder = (it) => {
  const t = String(it.type || it[".tag"] || it.tag || "").toLowerCase();
  return t.includes("folder"); // cubre "folder", "foldermetadata", etc.
};
=======
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
>>>>>>> temp-backup

const DescargaPuntos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

<<<<<<< HEAD
=======
  // Form state
>>>>>>> temp-backup
  const [modo, setModo] = useState("drone"); // "drone" | "gps"
  const [lasFile, setLasFile] = useState(null);
  const [dxfFile, setDxfFile] = useState(null);
  const [zipName, setZipName] = useState("");
  const [csvFiles, setCsvFiles] = useState([]);

  const canUpload = useMemo(() => {
<<<<<<< HEAD
    if (modo === "drone")
      return !!lasFile && !!dxfFile && zipName.trim().length > 0;
    return csvFiles && csvFiles.length > 0;
  }, [modo, lasFile, dxfFile, zipName, csvFiles]);

  // Lista ---------------------------------------------------------------
=======
    if (modo === "drone") {
      return !!lasFile && !!dxfFile && zipName.trim().length > 0;
    }
    // gps
    return csvFiles && csvFiles.length > 0;
  }, [modo, lasFile, dxfFile, zipName, csvFiles]);

  // Helpers -------------------------------------------------------------
>>>>>>> temp-backup
  const fetchList = async () => {
    setLoading(true);
    setError("");
    try {
<<<<<<< HEAD
      const folder = PATHS[modo].avail;
      const res = await apiGet(`/list?folder=${encodeURIComponent(folder)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Filtra carpetas al guardar en estado
      const onlyFiles = (Array.isArray(data) ? data : []).filter((it) => !isFolder(it));
      setItems(onlyFiles);
=======
      const res = await fetch(apiUrl(`/list?folder=${encodeURIComponent(AVAILABLE_FOLDER)}`));
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
>>>>>>> temp-backup
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
<<<<<<< HEAD
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  // Subida --------------------------------------------------------------
  const handleUpload = async () => {
    setError("");
    if (!canUpload) return;
    try {
      if (modo === "drone") {
        // ZIP con LAS + DXF
        const zip = new JSZip();
        zip.file(lasFile.name, lasFile);
        zip.file(dxfFile.name, dxfFile);
        const blob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
        });
        const finalName = zipName.endsWith(".zip") ? zipName : `${zipName}.zip`;
        const path = `${PATHS.drone.avail}/${finalName}`;

        const fd = new FormData();
        fd.append(
          "file",
          new File([blob], finalName, { type: "application/zip" })
        );
        fd.append("path", path);

        const up = await apiPostForm("/upload", fd);
        if (!up.ok) throw new Error(await up.text());
      } else {
        // CSV(s) directo
        for (const f of csvFiles) {
          const fd = new FormData();
          const path = `${PATHS.gps.avail}/${f.name}`;
          fd.append("file", f, f.name);
          fd.append("path", path);
          const up = await apiPostForm("/upload", fd);
=======
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
>>>>>>> temp-backup
          if (!up.ok) throw new Error(await up.text());
        }
      }

<<<<<<< HEAD
=======
      // Limpio formulario y refresco lista
>>>>>>> temp-backup
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

<<<<<<< HEAD
  // Descargar + mover ---------------------------------------------------
  const handleDownload = async (item) => {
    setError("");
    const fromPath =
      item.path_lower || item.path || `${PATHS[modo].avail}/${item.name}`;
    const fileName = item.name;
    const toPath = `${PATHS[modo].processed}/${fileName}`;

    try {
      // Intento /consume
      const tryConsume = await apiGet(
        `/consume?path=${encodeURIComponent(
          fromPath
        )}&dest=${encodeURIComponent(toPath)}`
      );

      if (tryConsume.ok) {
        const blob = await tryConsume.blob();
        triggerBrowserDownload(blob, fileName);
      } else if (tryConsume.status === 404) {
        // fallback: /download + /move
        const down = await apiGet(
          `/download?path=${encodeURIComponent(fromPath)}`
        );
        if (!down.ok) throw new Error(await down.text());
        const blob = await down.blob();
        triggerBrowserDownload(blob, fileName);

        const mv = await apiPostJson("/move", { from: fromPath, to: toPath });
=======
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
>>>>>>> temp-backup
        if (!mv.ok) throw new Error(await mv.text());
      } else {
        throw new Error(await tryConsume.text());
      }

<<<<<<< HEAD
=======
      // refrescar lista (el archivo debe desaparecer de disponibles)
>>>>>>> temp-backup
      await fetchList();
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    }
  };

<<<<<<< HEAD
  const triggerBrowserDownload = (blob, name) => {
=======
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
>>>>>>> temp-backup
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

<<<<<<< HEAD
=======
      {/* Formulario de carga */}
>>>>>>> temp-backup
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
<<<<<<< HEAD
                <label className="form-check-label" htmlFor="modoDrone">
                  Dron (LAS + DXF → ZIP)
                </label>
=======
                <label className="form-check-label" htmlFor="modoDrone">Dron (LAS + DXF → ZIP)</label>
>>>>>>> temp-backup
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
<<<<<<< HEAD
                <label className="form-check-label" htmlFor="modoGPS">
                  GPS (CSV)
                </label>
=======
                <label className="form-check-label" htmlFor="modoGPS">GPS (CSV)</label>
>>>>>>> temp-backup
              </div>
            </div>
          </div>

<<<<<<< HEAD
          {/* Zona de subida (opcional) */}
          <div className="d-flex align-items-center gap-2 mt-2">
            <button className="btn btn-success" disabled={!canUpload} onClick={handleUpload}>
              Subir archivos
=======
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
>>>>>>> temp-backup
            </button>
            {error && <span className="text-danger">{error}</span>}
          </div>
        </div>
      </div>

<<<<<<< HEAD
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="m-0">Archivos disponibles ({items.length})</h5>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={fetchList}
              disabled={loading}
            >
=======
      {/* Lista de archivos disponibles */}
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="m-0">Archivos disponibles</h5>
            <button className="btn btn-outline-secondary btn-sm" onClick={fetchList} disabled={loading}>
>>>>>>> temp-backup
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
<<<<<<< HEAD
                  {items
                    .filter((it) => !isFolder(it)) // extra seguro (además del filtrado al cargar)
                    .map((it) => (
                      <tr key={it.path_lower || it.path || it.name}>
                        <td>{it.name}</td>
                        <td>
                          {it.type
                            ?.replace("Metadata", "")
                            .replace("File", "Archivo") || "Archivo"}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              handleDownload({
                                name: it.name,
                                path:
                                  it.path_lower ||
                                  it.path ||
                                  `${PATHS[modo].avail}/${it.name}`,
                              })
                            }
                          >
                            Descargar
                          </button>
                        </td>
                      </tr>
                    ))}
=======
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
>>>>>>> temp-backup
                </tbody>
              </table>
            </div>
          )}
<<<<<<< HEAD

          {error && !loading && <div className="text-danger mt-2">{error}</div>}
=======
>>>>>>> temp-backup
        </div>
      </div>
    </div>
  );
};

export default DescargaPuntos;
