import { gql } from "@apollo/client";

// ── CAMBIO — Compra (cabeza) + CompraInsumo (detalle, un renglón por
// insumo/lote de esa compra) — antes todo era una sola fila y una compra
// solo podía tener un insumo. Ver conversación "deber ser" sobre separar
// cabeza/detalle en Compras de Insumos, mismo patrón que
// Muestrario/MuestrarioItem.
const ITEM_FIELDS = `
  id compraId piedraId
  cantidad costoUnitario costoTotal cantidadDisponible version
  piedra { id codigo nombre tipo { id nombre } unidad { id nombre } }
`;

const COMPRA_FIELDS = `
  id empresaId numero fecha nota version
  totalItems valorTotal
  proveedor { id nombre }
  items { ${ITEM_FIELDS} }
`;

export const GET_COMPRAS_CURSOR = gql`
  query ComprasFiltradosCursor(
    $first: Int
    $after: String
    $orden: [String]
    $direccion: [String]
    $busqueda: String
  ) {
    comprasFiltradosCursor(
      first: $first
      after: $after
      orden: $orden
      direccion: $direccion
      busqueda: $busqueda
    ) {
      edges { node { ${COMPRA_FIELDS} } cursor }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const CREAR_COMPRA = gql`
  mutation CrearCompra($input: CompraInput!) {
    crearCompra(input: $input) {
      id
    }
  }
`;

export const ACTUALIZAR_COMPRA = gql`
  mutation ActualizarCompra($input: CompraUpdateInput!) {
    actualizarCompra(input: $input) {
      id
    }
  }
`;

export const ELIMINAR_COMPRA = gql`
  mutation EliminarCompra($id: Int!) {
    eliminarCompra(id: $id)
  }
`;

export const AGREGAR_ITEM_COMPRA = gql`
  mutation AgregarItemCompra($input: CompraInsumoItemInput!) {
    agregarItemCompra(input: $input) {
      id
    }
  }
`;

export const ACTUALIZAR_ITEM_COMPRA = gql`
  mutation ActualizarItemCompra($input: CompraInsumoItemUpdateInput!) {
    actualizarItemCompra(input: $input) {
      id
    }
  }
`;

export const ELIMINAR_ITEM_COMPRA = gql`
  mutation EliminarItemCompra($id: Int!) {
    eliminarItemCompra(id: $id)
  }
`;

// ── Sigue a nivel de detalle (los lotes con stock de un insumo) — lo
// que ya usa OrdenProduccion para elegir de dónde enviar no cambia de
// significado, solo trae numero/fecha anidados bajo `compra`.
export const GET_COMPRAS_POR_PIEDRA = gql`
  query ComprasPorPiedra($piedraId: Int!) {
    comprasPorPiedra(piedraId: $piedraId) {
      id
      costoUnitario
      cantidadDisponible
      compra {
        numero
        fecha
      }
      piedra {
        id
        nombre
        unidad {
          nombre
        }
      }
    }
  }
`;
