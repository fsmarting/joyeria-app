export default /* GraphQL */ `
  type MuestrarioItem {
    id: Int!
    muestrarioId: Int!
    productoId: Int!
    cantidadEntregada: Int!
    cantidadDevuelta: Int!
    cantidadVendida: Int!
    cantidadDisponible: Int!
    version: Int!
    producto: Producto
    ventas: [Venta!]!
  }
  type Muestrario {
    id: Int!
    empresaId: Int!
    # ── NUEVO — número correlativo generado por el servidor.
    numero: String!
    vendedoraId: Int!
    fechaSalida: String!
    fechaCierre: String
    estado: String!
    nota: String
    version: Int!
    vendedora: Usuario
    items: [MuestrarioItem!]!
    totalPiezas: Int!
    totalVendidas: Int!
    totalEfectivoPendiente: Float!
  }
  type MuestrarioEdge {
    node: Muestrario!
    cursor: ID!
  }
  type MuestrarioConnection {
    edges: [MuestrarioEdge!]!
    pageInfo: PageInfo!
  }

  input MuestrarioInput {
    empresaId: Int!
    vendedoraId: Int!
    fechaSalida: String!
    nota: String
    version: Int!
  }
  input MuestrarioUpdateInput {
    id: Int!
    nota: String
    version: Int!
  }
  input MuestrarioItemInput {
    muestrarioId: Int!
    productoId: Int!
    cantidadEntregada: Int!
  }
  input VentaMuestrarioInput {
    muestrarioItemId: Int!
    clienteId: Int!
    precioVenta: Float!
    medioPagoId: Int!
    vendedoraId: Int!
    empresaId: Int!
    # ── NUEVO — antes cada venta desde muestrario era siempre 1 unidad.
    cantidad: Int
  }
  input DevolucionItemInput {
    itemId: Int!
    cantidadDevuelta: Int!
  }
  input LiquidarMuestrarioInput {
    muestrarioId: Int!
    devoluciones: [DevolucionItemInput!]!
    version: Int!
    # ── NUEVO — obligatorio solo si queda algún item con piezas sin
    # contabilizar (ni vendidas ni devueltas). El sistema no bloquea el
    # cierre, pero exige que quede una nota explicando qué pasó, igual que
    # "Cerrar orden (entrega parcial)" en Órdenes de Producción.
    motivo: String
  }

  extend type Query {
    muestrariosFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): MuestrarioConnection!
  }
  extend type Mutation {
    crearMuestrario(input: MuestrarioInput!): Muestrario!
    actualizarMuestrario(input: MuestrarioUpdateInput!): Muestrario!
    eliminarMuestrario(id: Int!): Boolean!
    agregarItemMuestrario(input: MuestrarioItemInput!): MuestrarioItem!
    eliminarItemMuestrario(id: Int!): Boolean!
    registrarVentaMuestrario(input: VentaMuestrarioInput!): Venta!
    confirmarVentaEfectivo(ventaId: Int!): Venta!
    liquidarMuestrario(input: LiquidarMuestrarioInput!): Muestrario!
  }
`;
