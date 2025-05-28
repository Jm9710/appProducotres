import React, { useEffect, useState } from "react";
import Select from "react-select";

const Clientes = () => {
  const apiUrl = "https://appproducotres-backend.onrender.com/"

  //const apiUrl = "http://192.168.1.246:3001/";

  const [activePanel, setActivePanel] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const [formData, setFormData] = useState({
    nom_us: "",
    pass_us: "",
    nombre: "",
    tipo_us: "4",
    cod_productor: "",
    premium: false,
  });
  
  const [editFormData, setEditFormData] = useState({
    id_usuario: "",
    pass_us: "",
    premium: false,
  });

  const [deleteFormData, setDeleteFormData] = useState({
    id_usuario: "",
  });

  const togglePanel = (panel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setMessage(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleDeleteChange = (e) => {
    setDeleteFormData({
      id_usuario: e.target.value,
    });
  };

  // Obtener lista de clientes (productores)
  const fetchClientes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}api/usuarios/productores`);
      if (response.ok) {
        const data = await response.json();
        setClientes(data);
      }
    } catch (error) {
      console.error("Error al obtener clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  // Crear nuevo cliente
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${apiUrl}api/usuario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Cliente creado exitosamente" });
        setFormData({
          nom_us: "",
          pass_us: "",
          nombre: "",
          tipo_us: "4",
          cod_productor: "",
          premium: false,
        });
        fetchClientes();
      } else {
        const error = await response.json();
        setMessage({
          type: "error",
          text: error.msg || "Error al crear el cliente",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "No se pudo conectar con el servidor",
      });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      // Solo enviamos los campos editables
      const updateData = {
        premium: editFormData.premium
      };
      
      // Solo agregamos la contraseña si se proporcionó
      if (editFormData.pass_us) {
        updateData.pass_us = editFormData.pass_us;
      }
  
      const response = await fetch(
        `${apiUrl}api/usuario/${editFormData.id_usuario}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );
  
      if (response.ok) {
        setMessage({ type: "success", text: "Cliente actualizado exitosamente" });
        setEditFormData({
          id_usuario: "",
          pass_us: "",
          premium: false,
        });
        fetchClientes();
        togglePanel("edit");
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.msg || "Error al actualizar el cliente" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "No se pudo conectar con el servidor" });
    }
  };

  // Eliminar cliente
  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    if (!deleteFormData.id_usuario) {
      setMessage({ type: "error", text: "Seleccione un cliente para eliminar" });
      return;
    }
  
    if (!window.confirm("¿Está seguro que desea eliminar este cliente?")) {
      return;
    }
  
    setLoading(true); // Mostrar indicador de carga
  
    try {
      const response = await fetch(
        `${apiUrl}api/usuario/${deleteFormData.id_usuario}`,
        { method: "DELETE" }
      );
  
      if (response.ok) {
        setMessage({ type: "success", text: "Cliente eliminado exitosamente" });
        setDeleteFormData({ id_usuario: "" });
        fetchClientes();
        togglePanel("delete");
      } else {
        const error = await response.json();
        setMessage({
          type: "error",
          text: error.msg || "Error al eliminar el cliente",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "No se pudo conectar con el servidor",
      });
    } finally {
      setLoading(false); // Ocultar indicador de carga
    }
  };

  // Cargar datos del cliente seleccionado para editar
  const loadClienteData = (id) => {
    const cliente = clientes.find((c) => c.id_usuario == id);
    if (cliente) {
      setEditFormData({
        id_usuario: cliente.id_usuario,
        pass_us: "",
        premium: cliente.premium || false,
      });
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  return (
    <div>
      <h4>Clientes</h4>
      <header className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <button
            className="btn btn-primary me-2"
            onClick={() => togglePanel("add")}
          >
            Agregar Cliente
          </button>
          <button
            className="btn btn-secondary me-2"
            onClick={() => togglePanel("edit")}
          >
            Editar Cliente
          </button>
          <button
            className="btn btn-danger me-2"
            onClick={() => togglePanel("delete")}
          >
            Eliminar Cliente
          </button>
        </div>
      </header>

      {/* Mensajes de estado */}
      {message && (
        <div
          className={`alert ${
            message.type === "success" ? "alert-success" : "alert-danger"
          } mt-3`}
        >
          {message.text}
        </div>
      )}

      {/* Panel Agregar Cliente */}
      {activePanel === "add" && (
        <div className="border p-3 mt-3">
          <h5>Agregar Cliente</h5>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="nombre" className="form-label">
                Nombre del Cliente
              </label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                className="form-control"
                value={formData.nombre}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="nom_us" className="form-label">
                Nombre de Usuario
              </label>
              <input
                type="text"
                id="nom_us"
                name="nom_us"
                className="form-control"
                value={formData.nom_us}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="pass_us" className="form-label">
                Contraseña
              </label>
              <input
                type="password"
                id="pass_us"
                name="pass_us"
                className="form-control"
                value={formData.pass_us}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="cod_productor" className="form-label">
                Código de Productor
              </label>
              <input
                type="text"
                id="cod_productor"
                name="cod_productor"
                className="form-control"
                value={formData.cod_productor}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3 form-check">
              <input
                type="checkbox"
                id="premium"
                name="premium"
                checked={formData.premium}
                onChange={handleChange}
                className="form-check-input"
              />
              <label htmlFor="premium" className="form-check-label">
                ¿Premium?
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              Guardar
            </button>
          </form>
        </div>
      )}

{/* Panel Editar Cliente */}
{activePanel === "edit" && (
  <div className="border p-3 mt-3">
    <h5>Editar Cliente</h5>
    <form onSubmit={handleEditSubmit}>
      <div className="mb-3">
        <label htmlFor="editClientSelect" className="form-label">
          Selecciona el Cliente
        </label>
        <Select
          className="basic-single"
          classNamePrefix="select"
          placeholder="Buscar cliente..."
          options={clientes.map(cliente => ({
            value: cliente.id_usuario,
            label: `${cliente.cod_productor || 'Sin código'} - ${cliente.nombre} (${cliente.nom_us})`
          }))}
          onChange={(selectedOption) => {
            const clienteId = selectedOption?.value || "";
            if (clienteId) {
              loadClienteData(clienteId);
            } else {
              setEditFormData({
                id_usuario: "",
                pass_us: "",
                premium: false,
              });
            }
          }}
          value={
            editFormData.id_usuario
              ? {
                  value: editFormData.id_usuario,
                  label: `${clientes.find(c => c.id_usuario == editFormData.id_usuario)?.cod_productor || 'Sin código'} - ${
                    clientes.find(c => c.id_usuario == editFormData.id_usuario)?.nombre
                  } (${
                    clientes.find(c => c.id_usuario == editFormData.id_usuario)?.nom_us
                  })`
                }
              : null
          }
          isClearable
          isSearchable
          noOptionsMessage={() => "No se encontraron clientes"}
          styles={{
            control: (base) => ({
              ...base,
              minWidth: "250px",
              width: "auto"
            }),
            menu: (base) => ({
              ...base,
              zIndex: 9999
            })
          }}
        />
      </div>

      {editFormData.id_usuario && (
        <>
          <div className="mb-3">
            <label htmlFor="editPassUs" className="form-label">
              Nueva Contraseña
            </label>
            <input
              type="password"
              id="editPassUs"
              name="pass_us"
              className="form-control"
              value={editFormData.pass_us}
              onChange={handleEditChange}
              placeholder="Dejar en blanco para no cambiar"
            />
          </div>
          <div className="mb-3 form-check">
            <input
              type="checkbox"
              id="editPremium"
              name="premium"
              checked={editFormData.premium}
              onChange={handleEditChange}
              className="form-check-input"
            />
            <label htmlFor="editPremium" className="form-check-label">
              ¿Premium?
            </label>
          </div>
          <button type="submit" className="btn btn-secondary">
            Guardar Cambios
            </button>
        </>
      )}
    </form>
  </div>
)}
      {/* Panel Eliminar Cliente */}
      {activePanel === "delete" && (
        <div className="border p-3 mt-3">
          <h5>Eliminar Cliente</h5>
          <form onSubmit={handleDeleteSubmit}>
            <div className="mb-3">
              <label htmlFor="deleteClientSelect" className="form-label">
                Selecciona el Cliente
              </label>
              <select
                id="deleteClientSelect"
                className="form-select"
                value={deleteFormData.id_usuario}
                onChange={handleDeleteChange}
                required
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id_usuario} value={cliente.id_usuario}>
                    {cliente.nombre} ({cliente.nom_us})
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-danger">
              Eliminar
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Clientes;
