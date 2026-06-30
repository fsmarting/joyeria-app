export default /* GraphQL */ `
  type SubCatalogo {
    id: Int!
    codigo: String!
    nombre: String!
  }

  extend type Query {
    subCatalogos(catalogoId: Int!): [SubCatalogo!]!
  }
`;
