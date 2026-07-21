export const camposJoyero = [
  {
    nombre: "telefono",
    etiqueta: "Celular",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 30,
    ancho: "130px",
    ordenListado: 1,
    placeholder: "3001234567",
  },
  {
    nombre: "nombre",
    etiqueta: "Nombre",
    tipoForm: "text",
    obligatorio: false,
    maxLength: 150,
    ancho: "auto",
    ordenListado: 2,
  },
  {
    // Columna solo de listado — muestra badges de especialidades
    nombre: "especialidades",
    etiqueta: "Especialidades",
    soloListado: true,
    ancho: "260px",
    ordenListado: 3,
    ordenable: false,
    render: (fila) => {
      const esp = fila.especialidades || [];
      if (esp.length === 0)
        return (
          <span className="text-muted" style={{ fontSize: 12 }}>
            Sin especialidades
          </span>
        );
      return (
        <div className="d-flex flex-wrap gap-1">
          {esp.map((e) => (
            <span
              key={e.id}
              className={`badge ${e.esPrincipal ? "bg-primary" : "bg-secondary"}`}
              title={e.nivel || ""}
              style={{ fontSize: 11 }}
            >
              {e.esPrincipal ? "⭐ " : ""}
              {e.especialidad?.nombre}
              {e.nivel ? ` · ${e.nivel}` : ""}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    nombre: "activo",
    etiqueta: "Activo",
    tipoForm: "custom",
    ancho: "80px",
    ordenListado: 4,
    valorDefecto: true,
    renderForm: ({ form, handleChange }) => (
      <select
        className="form-select"
        name="activo"
        value={String(form.activo ?? true)}
        onChange={handleChange}
      >
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    ),
    render: (fila) => (
      <span className={`badge ${fila.activo ? "bg-success" : "bg-secondary"}`}>
        {fila.activo ? "Activo" : "Inactivo"}
      </span>
    ),
  },
  {
    nombre: "version",
    tipoForm: "hidden",
    soloFormulario: true,
    valorDefecto: 1,
  },
];
