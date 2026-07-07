export default /* GraphQL */ `
  type MetaMensual {
    id: Int! empresaId: Int!
    anio: Int! mes: Int!
    metaIngresos: Float! metaVentas: Int
    observaciones: String version: Int!
    nombreMes: String
  }
  type MetaMensualEdge { node: MetaMensual! cursor: ID! }
  type MetaMensualConnection { edges: [MetaMensualEdge!]! pageInfo: PageInfo! }

  input MetaMensualInput {
    empresaId: Int! anio: Int! mes: Int!
    metaIngresos: Float! metaVentas: Int
    observaciones: String version: Int!
  }
  input MetaMensualUpdateInput {
    id: Int! anio: Int! mes: Int!
    metaIngresos: Float! metaVentas: Int
    observaciones: String version: Int!
  }

  extend type Query {
    metasMensualesCursor(
      first: Int after: String orden: [String] direccion: [String] busqueda: String
    ): MetaMensualConnection!
    metaDelMes(anio: Int!, mes: Int!): MetaMensual
  }
  extend type Mutation {
    crearMetaMensual(input: MetaMensualInput!): MetaMensual!
    actualizarMetaMensual(input: MetaMensualUpdateInput!): MetaMensual!
    eliminarMetaMensual(id: Int!): Boolean!
  }
`;
