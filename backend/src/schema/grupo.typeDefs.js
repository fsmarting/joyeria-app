export default /* GraphQL */ `
  type Grupo {
    id: Int! subcatalogoId: Int! codigo: String! nombre: String! version: Int!
    subcatalogo: SubCatalogo
  }
  type GrupoEdge { node: Grupo! cursor: ID! }
  type GrupoConnection { edges: [GrupoEdge!]! pageInfo: PageInfo! }

  input GrupoInput { subcatalogoId: Int! codigo: String! nombre: String! version: Int! }
  input GrupoUpdateInput { id: Int! codigo: String! nombre: String! version: Int! }

  extend type Query {
    grupos(subcatalogoId: Int!): [Grupo!]!
    gruposPorCodigos(catalogoCodigo: String!, subcatalogoCodigo: String!): [Grupo!]!
    gruposFiltradosCursor(first: Int after: String orden: [String] direccion: [String] busqueda: String): GrupoConnection!
  }
  extend type Mutation {
    crearGrupo(input: GrupoInput!): Grupo
    actualizarGrupo(input: GrupoUpdateInput!): Grupo!
    eliminarGrupo(id: Int!): Boolean!
  }
`;
