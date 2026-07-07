export default /* GraphQL */ `
  type Empresa {
    id: Int! codigo: String! nombre: String! version: Int!
  }
  input EmpresaInput { codigo: String! nombre: String! version: Int! }
  input EmpresaUpdateInput { id: Int! codigo: String! nombre: String! version: Int! }

  extend type Query {
    empresas: [Empresa!]!
    empresa(id: Int!): Empresa
    obtenerEmpresas: [Empresa!]!
    validarCodigoEmpresa(codigo: String!): Boolean!
  }
  extend type Mutation {
    crearEmpresa(input: EmpresaInput!): Empresa
    actualizarEmpresa(input: EmpresaUpdateInput!): Empresa!
    eliminarEmpresa(id: Int!): Boolean!
  }
`;
