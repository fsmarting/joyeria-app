import { gql } from "@apollo/client";

const VENTA_FIELDS = `
  id empresaId clienteId productoId vendedoraId cotizacionId fecha
  precioVenta medioPagoId porcentajeComision valorComision estadoId version
  origenLabel
  cliente    { id nombre telefono }
  producto   { id referencia nombre }
  vendedora  { id nombre }
  medioPago  { id codigo nombre }
  estado     { id codigo nombre }
  cotizacion { id numero }
  repartos   { id socioId porcentaje valor socio { id nombre } }
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
