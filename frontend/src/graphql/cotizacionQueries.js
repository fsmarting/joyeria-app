import { gql } from "@apollo/client";

const ITEM_FIELDS = `
  id cotizacionId productoId precioUnitario cantidad subtotal nota version
  producto { id referencia nombre precioVenta foto enStock categoria { nombre } }
`;

const COT_FIELDS = `
  id empresaId numero clienteId conversacionId vendedoraId
  fecha validezDias estadoId nota version total
  cliente      { id nombre telefono }
  conversacion { id telefono nombreContacto }
  vendedora    { id nombre }
  estado       { id codigo nombre }
  items        { ${ITEM_FIELDS} }
`;

export const GET_COTIZACIONES_CURSOR = gql`
  query CotizacionesFiltradosCursor(
    $first: Int $after: String $orden: [String] $direccion: [String] $busqueda: String
  ) {
    cotizacionesFiltradosCursor(
      first: $first after: $after orden: $orden direccion: $direccion busqueda: $busqueda
    ) {
      edges { node { ${COT_FIELDS} } cursor }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const SIGUIENTE_NUMERO = gql`
  query SiguienteNumeroCotizacion($empresaId: Int!) {
    siguienteNumeroCotizacion(empresaId: $empresaId)
  }
`;

export const CREAR_COTIZACION = gql`
  mutation CrearCotizacion($input: CotizacionInput!) {
    crearCotizacion(input: $input) {
      id
      numero
    }
  }
`;
export const ACTUALIZAR_COTIZACION = gql`
  mutation ActualizarCotizacion($input: CotizacionUpdateInput!) {
    actualizarCotizacion(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_COTIZACION = gql`
  mutation EliminarCotizacion($id: Int!) {
    eliminarCotizacion(id: $id)
  }
`;

export const AGREGAR_ITEM_COTIZACION = gql`mutation AgregarItemCotizacion($input: CotizacionItemInput!) { agregarItemCotizacion(input: $input) { ${ITEM_FIELDS} } }`;
export const ACTUALIZAR_ITEM_COTIZACION = gql`mutation ActualizarItemCotizacion($input: CotizacionItemUpdateInput!) { actualizarItemCotizacion(input: $input) { ${ITEM_FIELDS} } }`;
export const ELIMINAR_ITEM_COTIZACION = gql`
  mutation EliminarItemCotizacion($id: Int!) {
    eliminarItemCotizacion(id: $id)
  }
`;

// ── CAMBIO — convertirEnVenta ahora devuelve una LISTA de Venta (una por
// cada línea de la cotización), ya no exige "1 solo producto por cotización".
// ── CAMBIO (ronda 34) — Venta ahora es cabeza/detalle; cantidad y
// precioVenta ya no existen en la cabeza (viven en cada línea de
// items{}). Cotizacion.jsx solo usa el largo del arreglo devuelto, así
// que basta con id + estado.
export const CONVERTIR_EN_VENTA = gql`
  mutation ConvertirEnVenta($input: ConvertirVentaInput!) {
    convertirEnVenta(input: $input) {
      id
      estado {
        nombre
      }
    }
  }
`;
