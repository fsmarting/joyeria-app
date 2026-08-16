import { gql } from "@apollo/client";

// ── CAMBIO (ronda 34) — Venta (cabeza) + VentaDetalle (detalle, un
// renglón por SKU vendido en esa venta) — antes toda la venta era una
// sola fila con un solo producto. Mismo patrón que
// Compra/CompraInsumo y Muestrario/MuestrarioItem.
const ITEM_FIELDS = `
  id ventaId productoId muestrarioItemId cotizacionItemId
  cantidad precioVenta subtotal version origenLabel
  producto { id referencia nombre }
`;

const VENTA_FIELDS = `
  id empresaId numero clienteId vendedoraId canalId medioPagoId fecha
  porcentajeComision estadoId version
  totalItems valorTotal valorComision origenLabel
  cliente   { id nombre telefono }
  vendedora { id nombre }
  canal     { id codigo nombre }
  medioPago { id codigo nombre }
  estado    { id codigo nombre }
  repartos  { id socioId porcentaje valor socio { id nombre } }
  items     { ${ITEM_FIELDS} }
`;

export const GET_VENTAS_CURSOR = gql`
  query VentasFiltradosCursor(
    $first: Int $after: String $orden: [String] $direccion: [String] $busqueda: String
  ) {
    ventasFiltradosCursor(
      first: $first after: $after orden: $orden direccion: $direccion busqueda: $busqueda
    ) {
      edges { node { ${VENTA_FIELDS} } cursor }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const CREAR_VENTA = gql`
  mutation CrearVenta($input: VentaInput!) {
    crearVenta(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_VENTA = gql`
  mutation ActualizarVenta($input: VentaUpdateInput!) {
    actualizarVenta(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_VENTA = gql`
  mutation EliminarVenta($id: Int!) {
    eliminarVenta(id: $id)
  }
`;

// ── NUEVO (ronda 34) — agregar/editar/quitar líneas de una venta ya
// creada, mismo patrón que Compra/CompraInsumo.
export const AGREGAR_ITEM_VENTA = gql`
  mutation AgregarItemVenta($input: VentaItemInput!) {
    agregarItemVenta(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_ITEM_VENTA = gql`
  mutation ActualizarItemVenta($input: VentaItemUpdateInput!) {
    actualizarItemVenta(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_ITEM_VENTA = gql`
  mutation EliminarItemVenta($id: Int!) {
    eliminarItemVenta(id: $id)
  }
`;

// ── NUEVO — anular con motivo, restaura stock automáticamente.
export const ANULAR_VENTA = gql`
  mutation AnularVenta($id: Int!, $version: Int!, $motivo: String!) {
    anularVenta(id: $id, version: $version, motivo: $motivo) {
      id
      version
      estado {
        codigo
        nombre
      }
    }
  }
`;

export const GUARDAR_REPARTO = gql`
  mutation GuardarReparto($ventaId: Int!, $repartos: [RepartoInput!]!) {
    guardarReparto(ventaId: $ventaId, repartos: $repartos) {
      id
      socioId
      porcentaje
      valor
      socio {
        id
        nombre
      }
    }
  }
`;

export const OBTENER_SOCIOS = gql`
  query ObtenerSocios {
    obtenerSocios {
      id
      nombre
      porcentajeDefecto
      activo
    }
  }
`;
export const OBTENER_USUARIOS = gql`
  query ObtenerUsuarios {
    obtenerUsuarios {
      id
      nombre
      codigo
    }
  }
`;
