import { gql } from "@apollo/client";

const ITEM_FIELDS = `
  id muestrarioId productoId
  cantidadEntregada cantidadDevuelta cantidadVendida cantidadDisponible version
  producto { id referencia nombre precioVenta foto enStock }
  ventas {
    id clienteId precioVenta cantidad version
    cliente   { id nombre telefono }
    medioPago { id codigo nombre }
    estado    { id codigo nombre }
  }
`;

const MUESTRARIO_FIELDS = `
  id empresaId
  numero
  vendedoraId
  fechaSalida
  fechaCierre
  estado
  nota
  version
  totalPiezas
  totalVendidas
  totalEfectivoPendiente
  vendedora { id nombre codigo }
  items { ${ITEM_FIELDS} }
`;

export const GET_MUESTRARIOS_CURSOR = gql`
  query MuestrariosFiltradosCursor(
    $first: Int $after: String $orden: [String] $direccion: [String] $busqueda: String
  ) {
    muestrariosFiltradosCursor(
      first: $first after: $after orden: $orden direccion: $direccion busqueda: $busqueda
    ) {
      edges { node { ${MUESTRARIO_FIELDS} } cursor }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const CREAR_MUESTRARIO = gql`
  mutation CrearMuestrario($input: MuestrarioInput!) {
    crearMuestrario(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_MUESTRARIO = gql`
  mutation ActualizarMuestrario($input: MuestrarioUpdateInput!) {
    actualizarMuestrario(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_MUESTRARIO = gql`
  mutation EliminarMuestrario($id: Int!) {
    eliminarMuestrario(id: $id)
  }
`;
export const AGREGAR_ITEM_MUESTRARIO = gql`
  mutation AgregarItemMuestrario($input: MuestrarioItemInput!) {
    agregarItemMuestrario(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_ITEM_MUESTRARIO = gql`
  mutation EliminarItemMuestrario($id: Int!) {
    eliminarItemMuestrario(id: $id)
  }
`;
export const REGISTRAR_VENTA_MUESTRARIO = gql`
  mutation RegistrarVentaMuestrario($input: VentaMuestrarioInput!) {
    registrarVentaMuestrario(input: $input) {
      id
      estado {
        codigo
        nombre
      }
    }
  }
`;
export const CONFIRMAR_VENTA_EFECTIVO = gql`
  mutation ConfirmarVentaEfectivo($ventaId: Int!) {
    confirmarVentaEfectivo(ventaId: $ventaId) {
      id
      estado {
        codigo
        nombre
      }
    }
  }
`;
export const LIQUIDAR_MUESTRARIO = gql`
  mutation LiquidarMuestrario($input: LiquidarMuestrarioInput!) {
    liquidarMuestrario(input: $input) {
      id
      estado
      nota
    }
  }
`;
