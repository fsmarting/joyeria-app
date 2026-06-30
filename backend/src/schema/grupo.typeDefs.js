export default /* GraphQL */ `
  type Grupo {
    id: Int!
    codigo: String!
    nombre: String!
  }

  extend type Query {
    grupos(subcatalogoId: Int!): [Grupo!]!
  }
`;
