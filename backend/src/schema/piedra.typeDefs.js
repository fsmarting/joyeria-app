export default /* GraphQL */ `
  type Piedra {
    id: Int!
    empresaId: Int!
    codigo: String!
    nombre: String!
    foto: String
    activo: Boolean!
    costoEstandardPorUnidad: Float!
    version: Int!
    tipo: Grupo
    unidad: Grupo
  }
  type PiedraEdge {
    node: Piedra!
    cursor: ID!
  }
  type PiedraConnection {
    edges: [PiedraEdge!]!
    pageInfo: PageInfo!
  }

  input PiedraInput {
    empresaId: Int!
    codigo: String!
    nombre: String!
    tipoId: Int
    unidadId: Int
    foto: String
    costoEstandardPorUnidad: Float!
    activo: Boolean
    version: Int!
  }
  input PiedraUpdateInput {
    id: Int!
    empresaId: Int!
    codigo: String!
    nombre: String!
    tipoId: Int
    unidadId: Int
    foto: String
    costoEstandardPorUnidad: Float!
    activo: Boolean
    version: Int!
  }

  extend type Query {
    piedrasFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): PiedraConnection!
    obtenerPiedras: [Piedra!]!
  }
  extend type Mutation {
    crearPiedra(input: PiedraInput!): Piedra
    actualizarPiedra(input: PiedraUpdateInput!): Piedra!
    eliminarPiedra(id: Int!): Boolean!
  }
`;
