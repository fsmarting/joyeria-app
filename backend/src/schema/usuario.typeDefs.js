export default /* GraphQL */ `
  type Usuario {
    id: Int!
    codigo: String!
    nombre: String!
    correo: String
  }

  extend type Query {
    yo: Usuario
  }
`;
