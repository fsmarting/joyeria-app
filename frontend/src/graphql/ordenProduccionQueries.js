import { gql } from '@apollo/client';

// ── CAMBIO — CompraInsumo ya no trae numero/fecha propios: ahora viven
// en su cabeza Compra (ver conversación "deber ser" sobre separar
// cabeza/detalle en Compras de Insumos). Se piden anidados bajo `compra`.
const MOVIMIENTO_FIELDS = `
  id detalleOrdenProduccionId compraInsumoId tipoMovimiento
  cantidad valor fecha nota usu_creacion version numeroRemision
  compraInsumo { id costoUnitario compra { numero fecha } }
`;

const DETALLE_FIELDS = `
  id ordenProduccionId compraInsumoId piedraId
  cantidad costoUnitario costoTotal desperdicio
  cantidadEnviada valorEnviado cantidadDevuelta valorDevuelto merma version
  consumoTeorico enviadoNeto diferenciaVsTeorico
  piedra       { id codigo nombre unidad { nombre } tipo { id codigo nombre } }
  compraInsumo { id costoUnitario cantidadDisponible compra { numero fecha }
    piedra { id codigo nombre unidad { nombre } }
  }
  movimientos { ${MOVIMIENTO_FIELDS} }
`;

// BOM del producto — se usa para sugerir automáticamente los insumos
// (incluido el oro) que hacen falta al armar el detalle de la orden:
// cantidadNecesaria = bomLine.cantidad × orden.cantidadProgramada,
// desperdicioSugerido = cantidadNecesaria × bomLine.desperdicio / 100.
const PRODUCTO_BOM_FIELDS = `
  piedras {
    id piedraId tipoId descripcion cantidad desperdicio costoEstandardUnitario
    piedra { id codigo nombre unidad { nombre } tipo { id codigo nombre } }
    tipoPiedra { id codigo nombre }
  }
`;

const ORDEN_FIELDS = `
  id numero descripcion empresaId productoId joyeroId estadoId
  cantidadProgramada costoUnitarioEstandard costoTotalEstandard
  cantidadEntregada valorEntregado
  fechaEnvio fechaEstimada fechaEntrega nota version
  producto { id referencia nombre enStock ${PRODUCTO_BOM_FIELDS} }
  joyero   { id nombre }
  estado   { id nombre codigo }
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

// ── NUEVO — histórico de costo por producto ───────────────────────
// Query liviana a propósito: NO pide producto/detalles/entregas (el
// resolver tampoco los incluye — ver comentario en el .resolvers.js).
// Se usa en Producto.jsx (BomPanel) para mostrar cómo se ha movido el
// costo unitario de las últimas órdenes de este producto.
export const GET_HISTORICO_COSTO_ORDENES = gql`
  query HistoricoCostoOrdenes($productoId: Int!, $limit: Int) {
    historicoCostoOrdenes(productoId: $productoId, limit: $limit) {
      id numero fechaEnvio cantidadProgramada cantidadEntregada
      costoUnitarioEstandard costoTotalEstandard
    }
  }
`;

export const CREAR_ORDEN      = gql`mutation CrearOrdenProduccion($input: OrdenProduccionInput!) { crearOrdenProduccion(input: $input) { id } }`;
export const ACTUALIZAR_ORDEN = gql`mutation ActualizarOrdenProduccion($input: OrdenProduccionUpdateInput!) { actualizarOrdenProduccion(input: $input) { id } }`;
export const ELIMINAR_ORDEN   = gql`mutation EliminarOrdenProduccion($id: Int!) { eliminarOrdenProduccion(id: $id) }`;

// ── NUEVO — cancelar orden (reemplaza el cambio manual de estadoId a
// "Cancelada" desde el formulario genérico). Ver ordenProduccion.resolvers.js.
export const CANCELAR_ORDEN = gql`
  mutation CancelarOrdenProduccion($id: Int!, $version: Int!, $motivo: String!) {
    cancelarOrdenProduccion(id: $id, version: $version, motivo: $motivo) { ${ORDEN_FIELDS} }
  }
`;

// ── NUEVO — cerrar orden con entrega parcial (piezas restantes no van
// a llegar, ej. problema de calidad del material). No toca
// cantidadProgramada/cantidadEntregada, solo cierra el estado.
export const CERRAR_ORDEN = gql`
  mutation CerrarOrdenProduccion($id: Int!, $version: Int!, $motivo: String!) {
    cerrarOrdenProduccion(id: $id, version: $version, motivo: $motivo) { ${ORDEN_FIELDS} }
  }
`;

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

export const AGREGAR_DETALLE = gql`mutation AgregarDetalleOrden($input: DetalleOrdenInput!) { agregarDetalleOrden(input: $input) { ${DETALLE_FIELDS} } }`;

// ── NUEVO — confirma varios insumos de una vez bajo UNA sola remisión
// de envío (ver comentario en ordenProduccion.resolvers.js).
export const AGREGAR_DETALLES_LOTE = gql`
  mutation AgregarDetallesOrdenLote($input: AgregarDetallesLoteInput!) {
    agregarDetallesOrdenLote(input: $input) { ${DETALLE_FIELDS} }
  }
`;

// ── NUEVO — reemplaza a REGISTRAR_DEVOLUCION ──────────────────────
// Un solo mutation para envío adicional (tipoMovimiento: "ADICIONAL")
// y devolución (tipoMovimiento: "DEVOLUCION").
export const REGISTRAR_MOVIMIENTO_INSUMO = gql`mutation RegistrarMovimientoInsumo($input: MovimientoInsumoInput!) { registrarMovimientoInsumo(input: $input) { ${DETALLE_FIELDS} } }`;

export const ELIMINAR_DETALLE = gql`mutation EliminarDetalleOrden($id: Int!) { eliminarDetalleOrden(id: $id) }`;
