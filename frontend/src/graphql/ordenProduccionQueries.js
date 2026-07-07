import { gql } from '@apollo/client';

const DETALLE_FIELDS = `
  id ordenProduccionId compraInsumoId piedraId
  cantidad costoUnitario costoTotal desperdicio
  cantidadEnviada valorEnviado cantidadDevuelta valorDevuelto merma version
  piedra       { id codigo nombre unidad { nombre } tipo { nombre } }
  compraInsumo { id numero fecha costoUnitario cantidadDisponible
    piedra { id codigo nombre unidad { nombre } }
  }
`;

const ORDEN_FIELDS = `
  id numero descripcion empresaId productoId joyeroId estadoId
  cantidadProgramada costoUnitarioEstandard costoTotalEstandard
  cantidadEntregada valorEntregado
  fechaEnvio fechaEstimada fechaEntrega nota version
  producto { id referencia nombre enStock }
  joyero   { id nombre }
  estado   { id nombre }
  detalles { ${DETALLE_FIELDS} }
  entregas {
    id numeroRemision numeroJoyero fecha
    cantidad cantidadJoyero valorEntregado
    estadoConciliacion notaConciliacion
    nota usu_creacion version
  }
`;

export const GET_ORDENES_CURSOR = gql`
  query OrdenesFiltradosCursor(
    $first: Int $after: String $orden: [String] $direccion: [String] $busqueda: String
  ) {
    ordenesFiltradosCursor(
      first: $first after: $after orden: $orden direccion: $direccion busqueda: $busqueda
    ) {
      edges { node { ${ORDEN_FIELDS} } cursor }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const CREAR_ORDEN      = gql`mutation CrearOrdenProduccion($input: OrdenProduccionInput!) { crearOrdenProduccion(input: $input) { id } }`;
export const ACTUALIZAR_ORDEN = gql`mutation ActualizarOrdenProduccion($input: OrdenProduccionUpdateInput!) { actualizarOrdenProduccion(input: $input) { id } }`;
export const ELIMINAR_ORDEN   = gql`mutation EliminarOrdenProduccion($id: Int!) { eliminarOrdenProduccion(id: $id) }`;

export const REGISTRAR_ENTREGA = gql`
  mutation RegistrarEntregaOrden($input: EntregaOrdenInput!) {
    registrarEntregaOrden(input: $input) {
      id cantidadEntregada valorEntregado fechaEntrega
      entregas { id numeroRemision numeroJoyero fecha cantidad cantidadJoyero valorEntregado estadoConciliacion notaConciliacion nota usu_creacion version }
    }
  }
`;

export const CONCILIAR_ENTREGA = gql`
  mutation ConciliarEntrega($input: ConciliarEntregaInput!) {
    conciliarEntrega(input: $input) { id estadoConciliacion notaConciliacion version }
  }
`;

export const AGREGAR_DETALLE      = gql`mutation AgregarDetalleOrden($input: DetalleOrdenInput!) { agregarDetalleOrden(input: $input) { ${DETALLE_FIELDS} } }`;
export const REGISTRAR_DEVOLUCION = gql`mutation RegistrarDevolucion($input: DetalleDevolucionInput!) { registrarDevolucion(input: $input) { ${DETALLE_FIELDS} } }`;
export const ELIMINAR_DETALLE     = gql`mutation EliminarDetalleOrden($id: Int!) { eliminarDetalleOrden(id: $id) }`;
