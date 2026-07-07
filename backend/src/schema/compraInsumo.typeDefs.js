export default /* GraphQL */ `
  type CompraInsumo {
    id: Int! empresaId: Int! numero: String! piedraId: Int!
    proveedorId: Int fecha: String! cantidad: Float!
    costoUnitario: Float! costoTotal: Float!
    cantidadDisponible: Float! nota: String version: Int!
    piedra:    Piedra
    proveedor: Tercero
  }

  type CompraInsumoEdge { node: CompraInsumo! cursor: ID! }
  type CompraInsumoConnection { edges: [CompraInsumoEdge!]! pageInfo: PageInfo! }

  input CompraInsumoInput {
    empresaId: Int! numero: String! piedraId: Int!
    proveedorId: Int fecha: String! cantidad: Float!
    costoUnitario: Float! costoTotal: Float! nota: String version: Int!
  }
  input CompraInsumoUpdateInput {
    id: Int! numero: String! piedraId: Int!
    proveedorId: Int fecha: String! cantidad: Float!
    costoUnitario: Float! costoTotal: Float! nota: String version: Int!
  }

  extend type Query {
    comprasFiltradosCursor(
      first: Int after: String orden: [String] direccion: [String] busqueda: String
    ): CompraInsumoConnection!
    obtenerCompras: [CompraInsumo!]!
    comprasPorPiedra(piedraId: Int!): [CompraInsumo!]!
  }
  extend type Mutation {
    crearCompraInsumo(input: CompraInsumoInput!): CompraInsumo
    actualizarCompraInsumo(input: CompraInsumoUpdateInput!): CompraInsumo!
    eliminarCompraInsumo(id: Int!): Boolean!
  }
`;
