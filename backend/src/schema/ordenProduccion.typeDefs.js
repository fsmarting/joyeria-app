export default /* GraphQL */ `
  type EntregaOrden {
    id: Int!
    ordenProduccionId: Int!
    numeroRemision: String
    numeroJoyero: String
    fecha: String!
    cantidad: Int!
    cantidadJoyero: Int
    valorEntregado: Float!
    estadoConciliacion: String!
    notaConciliacion: String
    nota: String
    usu_creacion: String
    version: Int!
  }
  # ── NUEVO ─────────────────────────────────────────────────────
  # Historial de movimientos de un insumo dentro de una orden: el
  # envío inicial (se crea junto con el detalle), envíos adicionales
  # (al joyero le faltó material) y devoluciones (sobrante que regresa).
  type MovimientoInsumoOrden {
    id: Int!
    detalleOrdenProduccionId: Int!
    compraInsumoId: Int!
    tipoMovimiento: String! # INICIAL | ADICIONAL | DEVOLUCION
    cantidad: Float!
    valor: Float!
    fecha: String!
    nota: String
    usu_creacion: String
    version: Int!
    compraInsumo: CompraInsumo
  }
  type DetalleOrdenProduccion {
    id: Int!
    ordenProduccionId: Int!
    compraInsumoId: Int!
    piedraId: Int!
    cantidad: Float!
    costoUnitario: Float!
    costoTotal: Float!
    desperdicio: Float!
    cantidadEnviada: Float!
    valorEnviado: Float!
    cantidadDevuelta: Float!
    valorDevuelto: Float!
    version: Int!
    compraInsumo: CompraInsumo
    piedra: Piedra
    merma: Float
    movimientos: [MovimientoInsumoOrden!]!
    # ── NUEVO — conciliación teórica (solo lectura, Manual v5 §6.6) ─
    # Compara lo enviado (neto de devoluciones) contra lo que "debería"
    # consumirse según BOM del producto × piezas entregadas + %
    # desperdicio de esa línea. Nulo si la línea ya no tiene una línea
    # de BOM correspondiente (p. ej. se quitó del producto después).
    consumoTeorico: Float
    enviadoNeto: Float
    diferenciaVsTeorico: Float
  }
  type OrdenProduccion {
    id: Int!
    empresaId: Int!
    numero: String!
    descripcion: String
    productoId: Int!
    joyeroId: Int!
    estadoId: Int!
    cantidadProgramada: Int!
    costoUnitarioEstandard: Float!
    costoTotalEstandard: Float!
    cantidadEntregada: Int!
    valorEntregado: Float!
    fechaEnvio: String!
    fechaEstimada: String
    fechaEntrega: String
    nota: String
    version: Int!
    producto: Producto
    joyero: Tercero
    estado: Grupo
    detalles: [DetalleOrdenProduccion!]!
    entregas: [EntregaOrden!]!
  }
  type OrdenProduccionEdge {
    node: OrdenProduccion!
    cursor: ID!
  }
  type OrdenProduccionConnection {
    edges: [OrdenProduccionEdge!]!
    pageInfo: PageInfo!
  }

  input OrdenProduccionInput {
    empresaId: Int!
    numero: String!
    descripcion: String
    productoId: Int!
    joyeroId: Int!
    estadoId: Int!
    cantidadProgramada: Int!
    fechaEnvio: String!
    fechaEstimada: String
    nota: String
    version: Int!
  }
  input OrdenProduccionUpdateInput {
    id: Int!
    empresaId: Int!
    numero: String!
    descripcion: String
    productoId: Int!
    joyeroId: Int!
    estadoId: Int!
    cantidadProgramada: Int!
    cantidadEntregada: Int!
    fechaEnvio: String!
    fechaEstimada: String
    fechaEntrega: String
    nota: String
    version: Int!
  }
  input EntregaOrdenInput {
    ordenProduccionId: Int!
    cantidad: Int!
    cantidadJoyero: Int
    numeroJoyero: String
    nota: String
  }
  input ConciliarEntregaInput {
    id: Int!
    estadoConciliacion: String!
    notaConciliacion: String
    version: Int!
  }
  input DetalleOrdenInput {
    ordenProduccionId: Int!
    compraInsumoId: Int!
    piedraId: Int!
    cantidad: Float!
    costoUnitario: Float!
    costoTotal: Float!
    desperdicio: Float
    cantidadEnviada: Float!
    valorEnviado: Float!
  }
  # ── NUEVO ─────────────────────────────────────────────────────
  # Reemplaza a DetalleDevolucionInput / registrarDevolucion. Sirve
  # tanto para un envío adicional (al joyero le faltó insumo) como
  # para una devolución (sobrante que el joyero regresa).
  input MovimientoInsumoInput {
    detalleOrdenProduccionId: Int!
    compraInsumoId: Int!
    tipoMovimiento: String! # ADICIONAL | DEVOLUCION
    cantidad: Float!
    nota: String
  }

  extend type Query {
    ordenesFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): OrdenProduccionConnection!
    # ── NUEVO ─────────────────────────────────────────────────────
    # Historial LIVIANO (sin BOM/detalles/entregas) de las últimas
    # órdenes de producción de un producto, para que el usuario vea
    # cómo se ha movido el costo unitario en el tiempo (p. ej. por
    # variación del precio del oro) y tenga ese contexto a la hora de
    # decidir su precio de venta. No es costeo contable de inventario
    # (ver Manual v5 §6.x) — cada orden ya trae su propio
    # costoUnitarioEstandard congelado al momento de crearse; esto
    # solo las lista en el tiempo.
    # ⚠️ El resolver de este query NO incluye producto/detalles/entregas
    # (a propósito, para que sea liviano) — el query del frontend NO
    # debe pedir esos campos o revienta el mismo error de campo
    # no-nulo que tuvimos con Producto.piedras (ver comentario en
    # incluirOrden más abajo en el resolver).
    historicoCostoOrdenes(productoId: Int!, limit: Int): [OrdenProduccion!]!
  }
  extend type Mutation {
    crearOrdenProduccion(input: OrdenProduccionInput!): OrdenProduccion
    actualizarOrdenProduccion(
      input: OrdenProduccionUpdateInput!
    ): OrdenProduccion!
    eliminarOrdenProduccion(id: Int!): Boolean!
    registrarEntregaOrden(input: EntregaOrdenInput!): OrdenProduccion!
    conciliarEntrega(input: ConciliarEntregaInput!): EntregaOrden!
    agregarDetalleOrden(input: DetalleOrdenInput!): DetalleOrdenProduccion!
    registrarMovimientoInsumo(
      input: MovimientoInsumoInput!
    ): DetalleOrdenProduccion!
    eliminarDetalleOrden(id: Int!): Boolean!
  }
`;
