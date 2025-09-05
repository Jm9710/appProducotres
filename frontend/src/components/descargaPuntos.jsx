import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";

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

const DescargaPuntos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const [modo, setModo] = useState("drone"); // "drone" | "gps"
  const [lasFile, setLasFile] = useState(null);
  const [dxfFile, setDxfFile] = useState(null);
  const [zipName, setZipName] = useState("");
  const [csvFiles, setCsvFiles] = useState([]);

  const canUpload = useMemo(() => {
    if (modo === "drone")
      return !!lasFile && !!dxfFile && zipName.trim().length > 0;
    return csvFiles && csvFiles.length > 0;
  }, [modo, lasFile, dxfFile, zipName, csvFiles]);

  // Lista ---------------------------------------------------------------
  const fetchList = async () => {
    setLoading(true);
    setError("");
    try {
      const folder = PATHS[modo].avail;
      const res = await apiGet(`/list?folder=${encodeURIComponent(folder)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Filtra carpetas al guardar en estado
      const onlyFiles = (Array.isArray(data) ? data : []).filter((it) => !isFolder(it));
      setItems(onlyFiles);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
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
          if (!up.ok) throw new Error(await up.text());
        }
      }

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
        if (!mv.ok) throw new Error(await mv.text());
      } else {
        throw new Error(await tryConsume.text());
      }

      await fetchList();
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    }
  };

  const triggerBrowserDownload = (blob, name) => {
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

          {/* Zona de subida (opcional) */}
          <div className="d-flex align-items-center gap-2 mt-2">
            <button className="btn btn-success" disabled={!canUpload} onClick={handleUpload}>
              Subir archivos
            </button>
            {error && <span className="text-danger">{error}</span>}
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="m-0">Archivos disponibles ({items.length})</h5>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={fetchList}
              disabled={loading}
            >
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
                </tbody>
              </table>
            </div>
          )}

          {error && !loading && <div className="text-danger mt-2">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default DescargaPuntos;
