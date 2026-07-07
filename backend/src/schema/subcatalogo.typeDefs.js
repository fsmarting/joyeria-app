export default /* GraphQL */ `
  type SubCatalogo {
    id: Int! catalogoId: Int! codigo: String! nombre: String! version: Int!
    catalogo: Catalogo
  }
  type SubCatalogoEdge { node: SubCatalogo! cursor: ID! }
  type SubCatalogoConnection { edges: [SubCatalogoEdge!]! pageInfo: PageInfo! }

  input SubCatalogoInput { catalogoId: Int! codigo: String! nombre: String! version: Int! }
  input SubCatalogoUpdateInput { id: Int! codigo: String! nombre: String! version: Int! }

  extend type Query {
    subCatalogos(catalogoId: Int!): [SubCatalogo!]!
    obtenerSubCatalogosPorCatalogo(catalogoId: Int!): [SubCatalogo!]!
    subcatalogosFiltradosCursor(first: Int after: String orden: [String] direccion: [String] busqueda: String): SubCatalogoConnection!
  }
  extend type Mutation {
    crearSubCatalogo(input: SubCatalogoInput!): SubCatalogo
    actualizarSubCatalogo(input: SubCatalogoUpdateInput!): SubCatalogo!
    eliminarSubCatalogo(id: Int!): Boolean!
  }
`;
