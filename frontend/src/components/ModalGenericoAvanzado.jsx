import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button, Form, Row, Col, Spinner } from "react-bootstrap";
import { useQuery, useLazyQuery, gql } from "@apollo/client";
import { toast } from "react-toastify";
import Select from "react-select";

// -------------------------------------------------------------------
// 1. IMPORTACIÓN DE VALIDACIONES
// -------------------------------------------------------------------
import { VALIDAR_CODIGO_EMPRESA } from "../graphql/empresaQueries";
import { VALIDAR_CODIGO_USUARIO } from "../graphql/usuarioQueries";
import { VALIDAR_CODIGO_USUARIO_EMPRESA } from "../graphql/usuarioempresaQueries";
import { VALIDAR_CODIGO_CATALOGO } from "../graphql/catalogoQueries";
import { VALIDAR_CODIGO_SUBCATALOGO } from "../graphql/subcatalogoQueries";
import { VALIDAR_CODIGO_GRUPO } from "../graphql/grupoQueries";
import { VALIDAR_CODIGO_PRODUCTO } from "../graphql/productoQueries";
import { VALIDAR_CODIGO_PIEDRA } from "../graphql/piedraQueries";

// Helper para acceder a propiedades anidadas de forma segura
const obtenerValor = (obj, path) => {
  if (!obj || !path) return "";
  return path
    .split(".")
    .reduce(
      (acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined),
      obj,
    );
};

// Helper para asignar valor en objeto anidado (Mutante)
const asignarValorProfundo = (obj, path, value) => {
  const partes = path.split(".");
  let puntero = obj;
  for (let i = 0; i < partes.length - 1; i++) {
    const parte = partes[i];
    puntero[parte] = puntero[parte] ? { ...puntero[parte] } : {};
    puntero = puntero[parte];
  }
  puntero[partes[partes.length - 1]] = value;
};

// =====================================================================
// COMPONENTE INTERNO: SELECT INTELIGENTE (Nativo HTML)
// =====================================================================
const QUERY_DEFECTO = gql`
  query Init {
    __typename
  }
`;

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
    Object.keys(config.variables).forEach((varNameInQuery) => {
      const fieldNameInForm = config.variables[varNameInQuery];
      const value = form[fieldNameInForm];
      if (!value) {
        skipQuery = true;
      } else {
        queryVariables[varNameInQuery] = Number(value);
      }
    });
  }

  if (config.fixedVariables) {
    Object.assign(queryVariables, config.fixedVariables);
  }

  if (config.dependsOn && !form[config.dependsOn]) {
    skipQuery = true;
  }

  const queryToUse = config.query || QUERY_DEFECTO;

  const { data, loading, error } = useQuery(queryToUse, {
    variables: queryVariables,
    skip: !config.query || skipQuery,
    fetchPolicy: "network-only",
  });

  if (error) console.error(`❌ Error en ${campo.nombre}:`, error);

  let opciones = [];

  if (data && !skipQuery && config.dataKey && data[config.dataKey]) {
    const rawData = data[config.dataKey];
    if (config.isEdge && rawData.edges) {
      opciones = rawData.edges.map((e) => e.node);
    } else if (Array.isArray(rawData)) {
      opciones = rawData;
    }
  }

  const onSelectChange = (e) => {
    const selectedValue = e.target.value;
    const objetoSeleccionado = opciones.find(
      (op) => String(op[config.valueField]) === String(selectedValue),
    );
    handleChange(e, objetoSeleccionado);
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
        disabled={
          isReadOnly || loading || (config.dependsOn && !form[config.dependsOn])
        }
        isInvalid={!!errores[campo.nombre]}
      >
        <option value="">
          {loading
            ? "Cargando..."
            : config.dependsOn && !form[config.dependsOn]
              ? "Seleccione primero el anterior"
              : "Seleccione..."}
        </option>

        {opciones.map((op) => {
          let label = "";
          if (config.formatLabel) {
            label = config.formatLabel(op);
          } else {
            label = op.codigo
              ? `${op.codigo} - ${op[config.displayField]}`
              : op[config.displayField];
          }
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

// =====================================================================
// COMPONENTE INTERNO: AUTOCOMPLETE (React-Select)
// =====================================================================
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
    Object.keys(config.variables).forEach((varNameInQuery) => {
      const fieldNameInForm = config.variables[varNameInQuery];
      const value = form[fieldNameInForm];
      if (!value) skipQuery = true;
      else queryVariables[varNameInQuery] = Number(value);
    });
  }
  if (config.fixedVariables)
    Object.assign(queryVariables, config.fixedVariables);
  if (config.dependsOn && !form[config.dependsOn]) skipQuery = true;

  const queryToUse = config.query || QUERY_DEFECTO;

  const { data, loading, error } = useQuery(queryToUse, {
    variables: queryVariables,
    skip: !config.query || skipQuery,
    fetchPolicy: "network-only",
  });

  if (error) console.error(`❌ Error en Autocomplete ${campo.nombre}:`, error);

  let opcionesSelect = [];
  let rawDataList = [];

  if (data && !skipQuery && config.dataKey && data[config.dataKey]) {
    const rawData = data[config.dataKey];
    if (config.isEdge && rawData.edges)
      rawDataList = rawData.edges.map((e) => e.node);
    else if (Array.isArray(rawData)) rawDataList = rawData;

    opcionesSelect = rawDataList.map((item) => ({
      value: item[config.valueField],
      label: config.formatLabel
        ? config.formatLabel(item)
        : item.codigo
          ? `${item.codigo} - ${item[config.displayField]}`
          : item[config.displayField],
      original: item,
    }));
  }

  const onReactSelectChange = (option) => {
    const fakeEvent = {
      target: {
        name: campo.nombre,
        value: option ? option.value : "",
        type: "text",
      },
    };
    handleChange(fakeEvent, option ? option.original : null);
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
        isDisabled={
          isReadOnly || loading || (config.dependsOn && !form[config.dependsOn])
        }
        isLoading={loading}
        isClearable={true}
        placeholder={loading ? "Cargando datos..." : "Escriba para buscar..."}
        noOptionsMessage={() =>
          skipQuery
            ? "Seleccione el campo anterior"
            : "No se encontraron resultados"
        }
        menuPosition="fixed"
        styles={{
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
          control: (base, state) => ({
            ...base,
            borderColor: errores[campo.nombre] ? "#dc3545" : base.borderColor,
            "&:hover": {
              borderColor: errores[campo.nombre] ? "#dc3545" : base.borderColor,
            },
          }),
        }}
        menuPortalTarget={document.body}
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

// =====================================================================
// COMPONENTE PRINCIPAL: MODAL GENÉRICO AVANZADO
// =====================================================================
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
  const [validarUsuario] = useLazyQuery(VALIDAR_CODIGO_USUARIO, {
    fetchPolicy: "network-only",
  });
  const [validarUsuarioEmpresa] = useLazyQuery(VALIDAR_CODIGO_USUARIO_EMPRESA, {
    fetchPolicy: "network-only",
  });
  const [validarCatalogo] = useLazyQuery(VALIDAR_CODIGO_CATALOGO, {
    fetchPolicy: "network-only",
  });
  const [validarSubCatalogo] = useLazyQuery(VALIDAR_CODIGO_SUBCATALOGO, {
    fetchPolicy: "network-only",
  });
  const [validarGrupo] = useLazyQuery(VALIDAR_CODIGO_GRUPO, {
    fetchPolicy: "network-only",
  });
  const [validarProducto] = useLazyQuery(VALIDAR_CODIGO_PRODUCTO, {
    fetchPolicy: "network-only",
  });
  const [validarPiedra] = useLazyQuery(VALIDAR_CODIGO_PIEDRA, {
    fetchPolicy: "network-only",
  });

  // -------------------------------------------------------------------
  // 3. INICIALIZACIÓN
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!show) return;

    let datosListos = {};

    if (registroParaEditar) {
      datosListos = { ...registroParaEditar };

      campos.forEach((campo) => {
        if (campo.valueTransformer && datosListos[campo.nombre]) {
          datosListos[campo.nombre] = campo.valueTransformer(
            datosListos[campo.nombre],
          );
        }
      });

      campos.forEach((campoInicial) => {
        if (
          (campoInicial.tipoForm === "select" ||
            campoInicial.tipoForm === "autocomplete") &&
          campoInicial.nombre.endsWith("Id")
        ) {
          let nombreObjeto = campoInicial.nombre.slice(0, -2);

          if (
            !datosListos[nombreObjeto] &&
            campoInicial.relationConfig?.rellenarCampos
          ) {
            const primeraLlave = Object.keys(
              campoInicial.relationConfig.rellenarCampos,
            )[0];
            if (primeraLlave && primeraLlave.includes(".")) {
              nombreObjeto = primeraLlave.split(".")[0];
            }
          }

          if (datosListos[nombreObjeto]) {
            if (datosListos[nombreObjeto].id) {
              datosListos[campoInicial.nombre] = datosListos[nombreObjeto].id;
            }

            let campoActual = campoInicial;
            let objetoActual = datosListos[nombreObjeto];

            while (campoActual.relationConfig?.dependsOn) {
              const nombrePadreId = campoActual.relationConfig.dependsOn;
              const configPadre = campos.find(
                (c) => c.nombre === nombrePadreId,
              );

              if (!configPadre) break;

              let nombrePadreObj = nombrePadreId.slice(0, -2);
              if (configPadre.relationConfig?.rellenarCampos) {
                const key = Object.keys(
                  configPadre.relationConfig.rellenarCampos,
                )[0];
                if (key && key.includes(".")) {
                  const partes = key.split(".");
                  if (
                    !objetoActual["departamento"] &&
                    !objetoActual[nombrePadreObj]
                  ) {
                    if (partes.length > 1)
                      nombrePadreObj = partes[partes.length - 2] || partes[0];
                  }
                }
              }

              let objetoPadre =
                objetoActual[nombrePadreObj] ||
                objetoActual["departamento"] ||
                objetoActual["pais"] ||
                objetoActual["catalogo"];

              if (objetoPadre && objetoPadre.id) {
                datosListos[nombrePadreId] = objetoPadre.id;
                campoActual = configPadre;
                objetoActual = objetoPadre;
              } else {
                break;
              }
            }
          }
        }
      });

      datosListos = { ...datosListos, ...fixedMemo };
    } else {
      datosListos = { ...fixedMemo };
    }

    campos.forEach((c) => {
      if (
        !registroParaEditar &&
        c.valorDefecto !== undefined &&
        datosListos[c.nombre] === undefined
      ) {
        datosListos[c.nombre] = c.valorDefecto;
      }
    });

    setForm(datosListos);
    setValoresIniciales(datosListos);
    setErrores({});
  }, [show, registroParaEditar, fixedMemo, campos]);

  // -------------------------------------------------------------------
  // ⭐ NUEVO EFECTO: CALCULADORA AUTOMÁTICA DE TOTALES ⭐
  // -------------------------------------------------------------------
  useEffect(() => {
    // Verificamos si los campos existen en el formulario (solo para Facturas)
    if (form.valorBruto !== undefined) {
      // 1. Convertimos a números (evita concatenar texto "50" + "10" = "5010")
      const bruto = parseFloat(form.valorBruto) || 0;
      const iva = parseFloat(form.valorIva) || 0;
      const retencion = parseFloat(form.valorRetencion) || 0;

      // 2. Suma aritmética
      const totalCalculado = bruto + iva - retencion;

      // 3. Actualizamos el estado solo si el valor cambió (para evitar loops)
      setForm((prev) => {
        if (prev.valorTotal === totalCalculado) return prev;

        // Si es CREACIÓN (!registroParaEditar), saldoPendiente = totalCalculado.
        // Si es EDICIÓN, dejamos el saldoPendiente que ya traía.
        const nuevoSaldo = !registroParaEditar
          ? totalCalculado
          : prev.saldoPendiente;

        return {
          ...prev,
          valorTotal: totalCalculado,
          saldoPendiente: nuevoSaldo,
        };
      });
    }
  }, [form.valorBruto, form.valorIva, form.valorRetencion, registroParaEditar]);

  // -------------------------------------------------------------------
  // 4. MANEJO DE CAMBIOS
  // -------------------------------------------------------------------
  const handleChange = (e, objetoExtra = null) => {
    const { name, value, type } = e.target;
    let valorFinal = value;

    if (type === "number" || (name.endsWith("Id") && value !== "")) {
      valorFinal = Number(value);
    }

    setForm((prev) => {
      const nuevo = { ...prev };
      nuevo[name] = valorFinal;

      let camposPorRevisar = [name];

      while (camposPorRevisar.length > 0) {
        const padreActual = camposPorRevisar.shift();

        const hijos = campos.filter(
          (c) =>
            c.relationConfig?.dependsOn === padreActual ||
            c.dependsOn === padreActual,
        );

        hijos.forEach((hijo) => {
          nuevo[hijo.nombre] = "";

          if (hijo.relationConfig?.rellenarCampos) {
            Object.keys(hijo.relationConfig.rellenarCampos).forEach(
              (target) => {
                asignarValorProfundo(nuevo, target, "");
              },
            );
          }
          camposPorRevisar.push(hijo.nombre);
        });
      }

      const campoConfig = campos.find((c) => c.nombre === name);
      if (objetoExtra && campoConfig?.relationConfig?.rellenarCampos) {
        const mapa = campoConfig.relationConfig.rellenarCampos;
        Object.keys(mapa).forEach((campoDestino) => {
          const propiedadOrigen = mapa[campoDestino];
          const valorAInsertar = objetoExtra[propiedadOrigen] || "";
          asignarValorProfundo(nuevo, campoDestino, valorAInsertar);
        });
      }

      return nuevo;
    });

    if (errores[name]) setErrores((prev) => ({ ...prev, [name]: null }));
  };

  // -------------------------------------------------------------------
  // VALIDACIÓN Y GUARDADO
  // -------------------------------------------------------------------
  const verificarUnicidad = async () => {
    const clavesHanCambiado = (keys) =>
      keys.some((k) => form[k] !== valoresIniciales[k]);
    let existeDuplicado = false;
    let mensajeError = "";

    // TRAMPA 2 CORREGIDA: Convertimos a minúsculas para asegurar que coincida
    const entidadNormalizada = tipoEntidad ? tipoEntidad.toLowerCase() : "";
    try {
      switch (entidadNormalizada) {
        case "empresa":
          if (registroParaEditar && !clavesHanCambiado(["codigo"])) break;
          const { data: respEmp } = await validarEmpresa({
            variables: { codigo: form.codigo },
          });
          if (respEmp?.validarCodigoEmpresa) {
            existeDuplicado = true;
            mensajeError = "Este código ya existe.";
          }
          break; // 🚀 TRAMPA 1 CORREGIDA: Agregamos break

        case "usuario":
          console.log("Usuario....");
          if (registroParaEditar && !clavesHanCambiado(["codigo"])) break;
          const { data: respUsu } = await validarUsuario({
            variables: { codigo: form.codigo },
          });
          if (respUsu?.validarCodigoUsuario) {
            existeDuplicado = true;
            mensajeError = "Este código ya existe.";
          }
          break; // 🚀 TRAMPA 1 CORREGIDA: Agregamos break

        case "usuarioempresa":
          if (registroParaEditar && !clavesHanCambiado(["usuarioId"])) break;

          const { data: respUsuEmp } = await validarUsuarioEmpresa({
            variables: { empresaId: form.empresaId, usuarioId: form.usuarioId },
          });
          if (respUsuEmp?.validarCodigoUsuarioEmpresa) {
            existeDuplicado = true;
            mensajeError = "Este usuario ya está asignado a esta empresa.";
          }
          break;

        case "catalogo":
          if (registroParaEditar && !clavesHanCambiado(["codigo"])) break;

          const { data: respCat } = await validarCatalogo({
            variables: { empresaId: form.empresaId, codigo: form.codigo },
          });

          if (respCat?.validarCodigoCatalogo) {
            existeDuplicado = true;
            mensajeError =
              "Este codigo de catalogo ya está asignado a esta empresa.";
          }
          break;

        case "subcatalogo":
          if (registroParaEditar && !clavesHanCambiado(["codigo"])) break;

          const { data: respSubCat } = await validarSubCatalogo({
            variables: { catalogoId: form.catalogoId, codigo: form.codigo },
          });

          if (respSubCat?.validarCodigoSubCatalogo) {
            existeDuplicado = true;
            mensajeError =
              "Este codigo de Sub catalogo ya está asignado a este Catalogo.";
          }
          break;

        case "grupo":
          if (registroParaEditar && !clavesHanCambiado(["codigo"])) break;

          const { data: respGru } = await validarGrupo({
            variables: {
              subcatalogoId: form.subcatalogoId,
              codigo: form.codigo,
            },
          });

          if (respGru?.validarCodigoGrupo) {
            existeDuplicado = true;
            mensajeError =
              "Este codigo de Grupo ya está asignado a este Sub Catalogo.";
          }
          break;

        case "producto":
          if (registroParaEditar && !clavesHanCambiado(["referencia"])) break;

          const { data: respPro } = await validarProducto({
            variables: {
              empresaId: form.empresaId,
              referencia: form.referencia,
            },
          });

          if (respPro?.validarCodigoProducto) {
            existeDuplicado = true;
            mensajeError =
              "Esta Referencia de Producto ya está asignado a esta Empresa.";
          }
          break;

        case "piedra":
          if (registroParaEditar && !clavesHanCambiado(["codigo"])) break;

          const { data: respPie } = await validarPiedra({
            variables: {
              empresaId: form.empresaId,
              codigo: form.codigo,
            },
          });

          if (respPie?.validarCodigoPiedra) {
            existeDuplicado = true;
            mensajeError = "Este Insumo ya está asignado a esta Empresa.";
          }
          break;

        default:
          break;
      }
    } catch (error) {
      console.error("Error validando unicidad:", error);
    }

    return { existe: existeDuplicado, mensaje: mensajeError };
  };

  const handleGuardar = async () => {
    setCargando(true);
    const erroresTemp = {};

    campos.forEach((c) => {
      if (c.obligatorio && !c.readOnly && !c.soloLecturaEnEdicion) {
        if (
          !form[c.nombre] &&
          form[c.nombre] !== 0 &&
          form[c.nombre] !== false
        ) {
          erroresTemp[c.nombre] = "Campo obligatorio";
        }
      }
      // FORMA SEGURA (Finanzas adaptado):
      if (
        (c.tipoForm === "select" || c.tipoForm === "autocomplete") &&
        c.obligatorio
      ) {
        if (
          form[c.nombre] === undefined ||
          form[c.nombre] === null ||
          form[c.nombre] === ""
        ) {
          erroresTemp[c.nombre] = "Seleccione una opción";
        }
      }
    });

    if (Object.keys(erroresTemp).length > 0) {
      setErrores(erroresTemp);
      setCargando(false);
      return toast.warning("Complete los campos obligatorios");
    }

    const resultadoValidacion = await verificarUnicidad();
    if (resultadoValidacion.existe) {
      switch (tipoEntidad) {
        case "usuarioempresa":
          setErrores({ usuarioId: `⚠️ ${resultadoValidacion.mensaje}` });
          break;

        case "producto":
          setErrores({ referencia: `⚠️ ${resultadoValidacion.mensaje}` });
          break;

        default:
          // Si no es ninguno de los anteriores, asume que el campo se llama 'codigo'
          setErrores({ codigo: `⚠️ ${resultadoValidacion.mensaje}` });
          break;
      }

      // Apagamos el modo de carga para descongelar la pantalla
      setCargando(false);

      // Detenemos la ejecución para que no guarde el duplicado
      return;
    }

    try {
      const datosParaEnviar = { ...form };

      Object.keys(datosParaEnviar).forEach((key) => {
        if (datosParaEnviar[key] === "true") datosParaEnviar[key] = true;
        if (datosParaEnviar[key] === "false") datosParaEnviar[key] = false;
      });

      await onSubmit(datosParaEnviar);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  // -------------------------------------------------------------------
  // RENDERIZADO
  // -------------------------------------------------------------------
  const renderCampo = (campo) => {
    if (campo.soloListado) return null;
    // ── NUEVO ─────────────────────────────────────────────────────
    // Igual que soloListado pero al revés en el tiempo: oculta el campo
    // SOLO en el formulario de creación (registroParaEditar es null),
    // y lo muestra normalmente al editar un registro ya existente.
    // Caso de uso: Producto.precioVenta — no tiene sentido pedirlo al
    // crear el producto porque todavía no existe el BOM ni el costeo
    // real; se vuelve relevante recién cuando el producto ya existe y
    // se puede usar el botón "usar sugerido" del panel de costeo.
    if (campo.ocultarEnCreacion && !registroParaEditar) return null;

    let isReadOnly = false;
    if (typeof campo.readOnly === "function") {
      isReadOnly = campo.readOnly(form, registroParaEditar);
    } else {
      isReadOnly = campo.readOnly;
    }
    if (registroParaEditar && campo.soloLecturaEnEdicion) {
      isReadOnly = true;
    }

    if (campo.renderForm) {
      return (
        <Form.Group key={campo.nombre} className="mb-3">
          <Form.Label>
            {campo.etiqueta}{" "}
            {campo.obligatorio && <span className="text-danger">*</span>}
          </Form.Label>
          {campo.renderForm({ form, handleChange, isReadOnly, errores })}
          <Form.Control.Feedback
            type="invalid"
            style={{ display: errores[campo.nombre] ? "block" : "none" }}
          >
            {errores[campo.nombre]}
          </Form.Control.Feedback>
        </Form.Group>
      );
    }

    if (campo.tipoForm === "autocomplete") {
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
    }

    if (campo.tipoForm === "select") {
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
    }

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
            {campos.map((campo, idx) => (
              <Col key={idx} md={12 / cols}>
                {renderCampo(campo)}
              </Col>
            ))}
          </Row>
        </Form>
        {Object.keys(errores).length > 0 && !errores.codigo && (
          <div className="alert alert-warning mt-3 py-1 small">
            Verifique los campos marcados en rojo.
          </div>
        )}
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
              {" "}
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
              />{" "}
              Procesando...{" "}
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
