export default /* GraphQL */ `
  type Empresa {
    id: Int!
    codigo: String!
    nombre: String!
  }

  extend type Query {
    empresas: [Empresa!]!
    empresa(id: Int!): Empresa
  }
`;
