export default /* GraphQL */ `
  type CotizacionItem {
    id: Int!
    cotizacionId: Int!
    productoId: Int!
    precioUnitario: Float!
    cantidad: Int!
    subtotal: Float!
    # ── NUEVO (ronda 39) — desglose de IVA congelado al crear esta línea
    # (informativo, ver "deber ser" — precioUnitario ya incluye IVA).
    porcentajeIva: Float!
    baseGravable: Float!
    valorIva: Float!
    nota: String
    version: Int!
    producto: Producto
    # ── FIX — faltaba este campo. venta.resolvers.js ya incluye
    # cotizacionItem.cotizacion vía Prisma (para origenLabel), pero sin
    # esto en el schema, GraphQL rechazaba la consulta antes de llegar al
    # resolver: "Cannot query field 'cotizacion' on type 'CotizacionItem'".
    cotizacion: Cotizacion
  }
  type Cotizacion {
    id: Int!
    empresaId: Int!
    numero: String!
    clienteId: Int
    conversacionId: Int
    vendedoraId: Int
    fecha: String!
    validezDias: Int!
    estadoId: Int!
    nota: String
    version: Int!
    total: Float!
    cliente: Tercero
    conversacion: Conversacion
    vendedora: Usuario
    estado: Grupo
    items: [CotizacionItem!]!
  }
  type CotizacionEdge {
    node: Cotizacion!
    cursor: ID!
  }
  type CotizacionConnection {
    edges: [CotizacionEdge!]!
    pageInfo: PageInfo!
  }

  input CotizacionInput {
    empresaId: Int!
    numero: String!
    clienteId: Int
    conversacionId: Int
    vendedoraId: Int
    fecha: String!
    validezDias: Int
    estadoId: Int!
    nota: String
    version: Int!
  }
  input CotizacionUpdateInput {
    id: Int!
    empresaId: Int!
    numero: String!
    clienteId: Int
    conversacionId: Int
    vendedoraId: Int
    fecha: String!
    validezDias: Int
    estadoId: Int!
    nota: String
    version: Int!
  }
  input CotizacionItemInput {
    cotizacionId: Int!
    productoId: Int!
    precioUnitario: Float!
    cantidad: Int
    nota: String
  }
  input CotizacionItemUpdateInput {
    id: Int!
    precioUnitario: Float!
    cantidad: Int
    nota: String
    version: Int!
  }
  input ConvertirVentaInput {
    cotizacionId: Int!
    medioPagoId: Int!
    fecha: String
  }

  extend type Query {
    cotizacionesFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): CotizacionConnection!
    siguienteNumeroCotizacion(empresaId: Int!): String!
  }
  extend type Mutation {
    crearCotizacion(input: CotizacionInput!): Cotizacion!
    actualizarCotizacion(input: CotizacionUpdateInput!): Cotizacion!
    eliminarCotizacion(id: Int!): Boolean!
    agregarItemCotizacion(input: CotizacionItemInput!): CotizacionItem!
    actualizarItemCotizacion(input: CotizacionItemUpdateInput!): CotizacionItem!
    eliminarItemCotizacion(id: Int!): Boolean!
    # ── CAMBIO — ya no exige "1 solo producto por cotización". Convierte
    # TODAS las líneas de la cotización, una Venta por línea, y devuelve la
    # lista completa (antes devolvía una sola Venta).
    convertirEnVenta(input: ConvertirVentaInput!): [Venta!]!
  }
`;
