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
    # ── NUEVO — remisión de envío de insumos (solo en INICIAL/ADICIONAL,
    # nula en DEVOLUCION). Ver Manual v5 §6.x.
    numeroRemision: String
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
    # ── NUEVO — ya no es obligatorio ni lo usa el resolver: el estado
    # inicial SIEMPRE se fuerza a "Pendiente" en el backend (ver
    # crearOrdenProduccion). Se deja el campo solo para no romper el
    # payload que arma buildInput.js — su valor se ignora.
    estadoId: Int
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
    # ── NUEVO — igual que en OrdenProduccionInput: el ciclo de vida del
    # estado ahora lo maneja el sistema (o cancelarOrdenProduccion), ya
    # no se acepta desde el formulario genérico de edición. Se ignora
    # en el resolver aunque venga con un valor.
    estadoId: Int
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
  # Confirmar varios insumos del BOM de una sola vez (checkboxes en
  # "Insumos del BOM pendientes de enviar") — si físicamente se
  # entregan juntos al joyero en un solo paquete, deben quedar bajo
  # UNA sola remisión de envío, no una por insumo. Cada elemento de
  # "detalles" NO repite ordenProduccionId (va una sola vez arriba).
  input DetalleOrdenLoteItemInput {
    compraInsumoId: Int!
    piedraId: Int!
    cantidad: Float!
    costoUnitario: Float!
    costoTotal: Float!
    desperdicio: Float
    cantidadEnviada: Float!
    valorEnviado: Float!
  }
  input AgregarDetallesLoteInput {
    ordenProduccionId: Int!
    detalles: [DetalleOrdenLoteItemInput!]!
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
    # ── NUEVO ─────────────────────────────────────────────────────
    # Reemplaza el cambio manual de estadoId a "Cancelada" desde el
    # formulario. Valida que la orden no tenga piezas ya entregadas
    # (cantidadEntregada = 0) y, si tenía insumos enviados al joyero sin
    # producir, los devuelve automáticamente al lote de compra (queda
    # registrado como un movimiento DEVOLUCION más, no se reescribe el
    # historial). motivo es obligatorio — queda en la nota de la orden
    # y en la nota de cada devolución automática.
    cancelarOrdenProduccion(id: Int!, version: Int!, motivo: String!): OrdenProduccion!
    registrarEntregaOrden(input: EntregaOrdenInput!): OrdenProduccion!
    conciliarEntrega(input: ConciliarEntregaInput!): EntregaOrden!
    agregarDetalleOrden(input: DetalleOrdenInput!): DetalleOrdenProduccion!
    # ── NUEVO — confirma varios insumos del BOM en un solo envío físico,
    # bajo UNA sola remisión (ver AgregarDetallesLoteInput arriba).
    agregarDetallesOrdenLote(input: AgregarDetallesLoteInput!): [DetalleOrdenProduccion!]!
    registrarMovimientoInsumo(
      input: MovimientoInsumoInput!
    ): DetalleOrdenProduccion!
    eliminarDetalleOrden(id: Int!): Boolean!
  }
`;
