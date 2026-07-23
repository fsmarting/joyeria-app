import { useState, useEffect, useMemo } from "react";
import { Modal, Button, Form, Row, Col, Spinner } from "react-bootstrap";
import { useQuery, useLazyQuery, gql } from "@apollo/client";
import { toast } from "react-toastify";
import Select from "react-select";
import { VALIDAR_CODIGO_EMPRESA } from "../graphql/empresaQueries.js";

// ── Helpers ────────────────────────────────────────────────────────
const obtenerValor = (obj, path) => {
  if (!obj || !path) return "";
  return path
    .split(".")
    .reduce(
      (acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined),
      obj,
    );
};

const asignarValorProfundo = (obj, path, value) => {
  const partes = path.split(".");
  let p = obj;
  for (let i = 0; i < partes.length - 1; i++) {
    p[partes[i]] = p[partes[i]] ? { ...p[partes[i]] } : {};
    p = p[partes[i]];
  }
  p[partes[partes.length - 1]] = value;
};

const QUERY_DEFECTO = gql`
  query Init {
    __typename
  }
`;

// ── SelectInteligente ──────────────────────────────────────────────
const SelectInteligente = ({
  campo,
  form,
  handleChange,
  isReadOnly,
  errores,
}) => {
  const config = campo.relationConfig || {};
  const queryVariables = {};
  let skipQuery = false;

  if (config.variables) {
    Object.keys(config.variables).forEach((v) => {
      const val = form[config.variables[v]];
      if (!val) skipQuery = true;
      else queryVariables[v] = Number(val);
    });
  }
  if (config.fixedVariables)
    Object.assign(queryVariables, config.fixedVariables);
  if (config.dependsOn && !form[config.dependsOn]) skipQuery = true;

  const { data, loading, error } = useQuery(config.query || QUERY_DEFECTO, {
    variables: queryVariables,
    skip: !config.query || skipQuery,
    fetchPolicy: "network-only",
  });
  if (error) console.error(`❌ ${campo.nombre}:`, error);

  let opciones = [];
  if (data && !skipQuery && config.dataKey && data[config.dataKey]) {
    const raw = data[config.dataKey];
    opciones = config.isEdge
      ? raw.edges.map((e) => e.node)
      : Array.isArray(raw)
        ? raw
        : [];
  }

  const onSelectChange = (e) => {
    const obj = opciones.find(
      (op) => String(op[config.valueField]) === String(e.target.value),
    );
    handleChange(e, obj);
  };

  return (
    <Form.Group className="mb-3">
      <Form.Label>
        {campo.etiqueta}{" "}
        {campo.obligatorio && <span className="text-danger">*</span>}
      </Form.Label>
      <Form.Select
        name={campo.nombre}
        value={form[campo.nombre] || ""}
        onChange={onSelectChange}
        disabled={isReadOnly || loading}
        isInvalid={!!errores[campo.nombre]}
      >
        <option value="">{loading ? "Cargando..." : "Seleccione..."}</option>
        {opciones.map((op) => {
          const label = config.formatLabel
            ? config.formatLabel(op)
            : op.codigo
              ? `${op.codigo} - ${op[config.displayField]}`
              : op[config.displayField];
          return (
            <option key={op[config.valueField]} value={op[config.valueField]}>
              {label}
            </option>
          );
        })}
      </Form.Select>
      <Form.Control.Feedback type="invalid">
        {errores[campo.nombre]}
      </Form.Control.Feedback>
    </Form.Group>
  );
};

// ── SelectAutocomplete ─────────────────────────────────────────────
const SelectAutocomplete = ({
  campo,
  form,
  handleChange,
  isReadOnly,
  errores,
}) => {
  const config = campo.relationConfig || {};
  const queryVariables = {};
  let skipQuery = false;
  if (config.variables) {
    Object.keys(config.variables).forEach((v) => {
      const val = form[config.variables[v]];
      if (!val) skipQuery = true;
      else queryVariables[v] = Number(val);
    });
  }
  if (config.fixedVariables)
    Object.assign(queryVariables, config.fixedVariables);
  if (config.dependsOn && !form[config.dependsOn]) skipQuery = true;

  const { data, loading } = useQuery(config.query || QUERY_DEFECTO, {
    variables: queryVariables,
    skip: !config.query || skipQuery,
    fetchPolicy: "network-only",
  });

  let rawDataList = [];
  if (data && !skipQuery && config.dataKey && data[config.dataKey]) {
    const raw = data[config.dataKey];
    rawDataList = config.isEdge
      ? raw.edges.map((e) => e.node)
      : Array.isArray(raw)
        ? raw
        : [];
  }

  const opcionesSelect = rawDataList.map((item) => ({
    value: item[config.valueField],
    label: config.formatLabel
      ? config.formatLabel(item)
      : item.codigo
        ? `${item.codigo} - ${item[config.displayField]}`
        : item[config.displayField],
    original: item,
  }));

  const onReactSelectChange = (option) => {
    handleChange(
      {
        target: {
          name: campo.nombre,
          value: option ? option.value : "",
          type: "text",
        },
      },
      option ? option.original : null,
    );
  };

  const valorActual = opcionesSelect.find(
    (op) => String(op.value) === String(form[campo.nombre]),
  );

  return (
    <Form.Group className="mb-3">
      <Form.Label>
        {campo.etiqueta}{" "}
        {campo.obligatorio && <span className="text-danger">*</span>}
      </Form.Label>
      <Select
        name={campo.nombre}
        value={valorActual || null}
        onChange={onReactSelectChange}
        options={opcionesSelect}
        isDisabled={isReadOnly || loading}
        isLoading={loading}
        isClearable
        placeholder={loading ? "Cargando..." : "Escriba para buscar..."}
        noOptionsMessage={() => "No se encontraron resultados"}
        menuPosition="fixed"
        menuPortalTarget={document.body}
        styles={{
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
          control: (base) => ({
            ...base,
            borderColor: errores[campo.nombre] ? "#dc3545" : base.borderColor,
          }),
        }}
      />
      <div
        className="invalid-feedback"
        style={{ display: errores[campo.nombre] ? "block" : "none" }}
      >
        {errores[campo.nombre]}
      </div>
    </Form.Group>
  );
};

// ── ModalGenericoAvanzado ──────────────────────────────────────────
export default function ModalGenericoAvanzado({
  show,
  onClose,
  onSubmit,
  campos,
  registroParaEditar,
  titulo = "Registro",
  tipoEntidad = "",
  cols = 2,
  fixedValues = {},
}) {
  const [form, setForm] = useState({});
  const [errores, setErrores] = useState({});
  const [cargando, setCargando] = useState(false);
  const [valoresIniciales, setValoresIniciales] = useState({});
  const fixedMemo = useMemo(() => fixedValues, [JSON.stringify(fixedValues)]);
  const [validarEmpresa] = useLazyQuery(VALIDAR_CODIGO_EMPRESA, {
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (!show) return;
    let datos = registroParaEditar
      ? { ...registroParaEditar, ...fixedMemo }
      : { ...fixedMemo };
    campos.forEach((c) => {
      if (
        !registroParaEditar &&
        c.valorDefecto !== undefined &&
        datos[c.nombre] === undefined
      )
        datos[c.nombre] = c.valorDefecto;
    });
    // Resolver IDs desde objetos anidados (ej: categoriaId desde categoria.id)
    campos.forEach((c) => {
      if (
        (c.tipoForm === "select" || c.tipoForm === "autocomplete") &&
        c.nombre.endsWith("Id")
      ) {
        const nombreObj = c.nombre.slice(0, -2);
        if (datos[nombreObj]?.id) datos[c.nombre] = datos[nombreObj].id;
      }
    });
    setForm(datos);
    setValoresIniciales(datos);
    setErrores({});
  }, [show, registroParaEditar, fixedMemo, campos]);

  const handleChange = (e, objetoExtra = null) => {
    const { name, value, type } = e.target;
    let valorFinal = value;
    if (type === "number" || (name.endsWith("Id") && value !== ""))
      valorFinal = Number(value);

    setForm((prev) => {
      const nuevo = { ...prev, [name]: valorFinal };
      // Limpiar hijos dependientes
      const hijos = campos.filter(
        (c) => c.relationConfig?.dependsOn === name || c.dependsOn === name,
      );
      hijos.forEach((h) => {
        nuevo[h.nombre] = "";
      });
      // Rellenar campos extras del objeto seleccionado
      const config = campos.find((c) => c.nombre === name);
      if (objetoExtra && config?.relationConfig?.rellenarCampos) {
        Object.keys(config.relationConfig.rellenarCampos).forEach((dest) => {
          const prop = config.relationConfig.rellenarCampos[dest];
          asignarValorProfundo(nuevo, dest, objetoExtra[prop] || "");
        });
      }
      return nuevo;
    });
    if (errores[name]) setErrores((prev) => ({ ...prev, [name]: null }));
  };

  const verificarUnicidad = async () => {
    if (
      tipoEntidad === "empresa" &&
      (!registroParaEditar || form.codigo !== valoresIniciales.codigo)
    ) {
      const { data } = await validarEmpresa({
        variables: { codigo: form.codigo },
      });
      if (data?.validarCodigoEmpresa)
        return { existe: true, mensaje: "Este código ya existe." };
    }
    return { existe: false, mensaje: "" };
  };

  const handleGuardar = async () => {
    setCargando(true);
    const erroresTemp = {};
    campos.forEach((c) => {
      if (c.obligatorio && !c.readOnly && !c.soloLecturaEnEdicion) {
        if (!form[c.nombre] && form[c.nombre] !== 0 && form[c.nombre] !== false)
          erroresTemp[c.nombre] = "Campo obligatorio";
      }
    });
    if (Object.keys(erroresTemp).length > 0) {
      setErrores(erroresTemp);
      setCargando(false);
      return toast.warning("Complete los campos obligatorios");
    }

    const { existe, mensaje } = await verificarUnicidad();
    if (existe) {
      setErrores({ codigo: `⚠️ ${mensaje}` });
      setCargando(false);
      return;
    }

    try {
      const datos = { ...form };
      Object.keys(datos).forEach((k) => {
        if (datos[k] === "true") datos[k] = true;
        if (datos[k] === "false") datos[k] = false;
      });
      await onSubmit(datos);
    } catch (error) {
      toast.error("Error al guardar: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  const renderCampo = (campo) => {
    if (campo.soloListado) return null;
    const isReadOnly =
      typeof campo.readOnly === "function"
        ? campo.readOnly(form, registroParaEditar)
        : campo.readOnly;
    if (campo.renderForm)
      return (
        <Form.Group key={campo.nombre} className="mb-3">
          <Form.Label>
            {campo.etiqueta}{" "}
            {campo.obligatorio && <span className="text-danger">*</span>}
          </Form.Label>
          {campo.renderForm({ form, handleChange, isReadOnly, errores })}
        </Form.Group>
      );
    if (campo.tipoForm === "autocomplete")
      return (
        <SelectAutocomplete
          key={campo.nombre}
          campo={campo}
          form={form}
          handleChange={handleChange}
          isReadOnly={isReadOnly}
          errores={errores}
        />
      );
    if (campo.tipoForm === "select")
      return (
        <SelectInteligente
          key={campo.nombre}
          campo={campo}
          form={form}
          handleChange={handleChange}
          isReadOnly={isReadOnly}
          errores={errores}
        />
      );
    if (campo.tipoForm === "hidden") return null;
    return (
      <Form.Group key={campo.nombre} className="mb-3">
        <Form.Label>
          {campo.etiqueta}{" "}
          {campo.obligatorio && <span className="text-danger">*</span>}
        </Form.Label>
        <Form.Control
          type={campo.tipoForm || "text"}
          name={campo.nombre}
          value={obtenerValor(form, campo.nombre) || ""}
          onChange={handleChange}
          readOnly={isReadOnly}
          disabled={campo.disabled}
          isInvalid={!!errores[campo.nombre]}
          maxLength={campo.maxLength}
          placeholder={campo.placeholder}
        />
        <Form.Control.Feedback type="invalid">
          {errores[campo.nombre]}
        </Form.Control.Feedback>
      </Form.Group>
    );
  };

  return (
    <Modal show={show} onHide={onClose} size="lg" backdrop="static" centered>
      <Modal.Header closeButton className="bg-light">
        <Modal.Title>
          {registroParaEditar ? "Editar" : "Nuevo"} {titulo}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row>
            {campos.map((c, i) => (
              <Col key={i} md={12 / cols}>
                {renderCampo(c)}
              </Col>
            ))}
          </Row>
        </Form>
      </Modal.Body>
      <Modal.Footer className="bg-light">
        <Button
          variant="outline-secondary"
          onClick={onClose}
          disabled={cargando}
        >
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleGuardar} disabled={cargando}>
          {cargando ? (
            <>
              <Spinner as="span" animation="border" size="sm" /> Procesando...
            </>
          ) : registroParaEditar ? (
            "Actualizar"
          ) : (
            "Guardar"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
