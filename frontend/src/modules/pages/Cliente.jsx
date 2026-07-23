import { useMemo } from "react";
import EntidadGenerica from "../../components/EntidadGenerica.jsx";
import { camposCliente } from "../../data/camposCliente.jsx";
import {
  GET_CLIENTES_CURSOR,
  CREAR_CLIENTE,
  ACTUALIZAR_CLIENTE,
  ELIMINAR_CLIENTE,
} from "../../graphql/clienteQueries.js";

export default function Cliente() {
  const empresaActual = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("empresa") || "{}");
    } catch {
      return {};
    }
  }, []);
  return (
    <EntidadGenerica
      tipoEntidad="cliente"
      campos={camposCliente}
      titulo="Base de Clientas"
      descripcion="Registro de clientas con tier y canal de llegada"
      textoBoton="Clienta"
      queries={{
        GET: GET_CLIENTES_CURSOR,
        CREAR: CREAR_CLIENTE,
        ACTUALIZAR: ACTUALIZAR_CLIENTE,
        ELIMINAR: ELIMINAR_CLIENTE,
      }}
      fixedValues={{ empresaId: empresaActual.id }}
    />
  );
}
