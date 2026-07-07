export default /* GraphQL */ `
  type Catalogo {
    id: Int! empresaId: Int! codigo: String! nombre: String! version: Int!
  }
  type CatalogoEdge { node: Catalogo! cursor: ID! }
  type CatalogoConnection { edges: [CatalogoEdge!]! pageInfo: PageInfo! }

  input CatalogoInput { empresaId: Int! codigo: String! nombre: String! version: Int! }
  input CatalogoUpdateInput { id: Int! codigo: String! nombre: String! version: Int! }

  extend type Query {
    catalogos(empresaId: Int!): [Catalogo!]!
    obtenerCatalogos: [Catalogo!]!
    catalogosFiltradosCursor(first: Int after: String orden: [String] direccion: [String] busqueda: String): CatalogoConnection!
  }
  extend type Mutation {
    crearCatalogo(input: CatalogoInput!): Catalogo
    actualizarCatalogo(input: CatalogoUpdateInput!): Catalogo!
    eliminarCatalogo(id: Int!): Boolean!
  }
`;
