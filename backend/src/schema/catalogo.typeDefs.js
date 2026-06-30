export default /* GraphQL */ `
  type Catalogo {
    id: Int!
    codigo: String!
    nombre: String!
  }

  extend type Query {
    catalogos(empresaId: Int!): [Catalogo!]!
  }
`;
