export default /* GraphQL */ `
  type CotizacionItem {
    id: Int!
    cotizacionId: Int!
    productoId: Int!
    precioUnitario: Float!
    cantidad: Int!
    subtotal: Float!
    nota: String
    version: Int!
    producto: Producto
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
    convertirEnVenta(input: ConvertirVentaInput!): Venta!
  }
`;
