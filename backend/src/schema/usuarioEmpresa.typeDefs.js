export default /* GraphQL */ `
  type UsuarioEmpresa {
    id: Int!
    empresaId: Int!
    usuarioId: Int!
    rolId: Int!
    costoHora: Float!
    comisionEfectivo: Float!
    comisionTarjeta: Float!
    metaMensual: Float!
    version: Int!
    empresa: Empresa!
    usuario: Usuario!
    rol: Grupo
  }
  type UsuarioEmpresaEdge {
    node: UsuarioEmpresa!
    cursor: ID!
  }
  type UsuarioEmpresaConnection {
    edges: [UsuarioEmpresaEdge!]!
    pageInfo: PageInfo!
  }

  input UsuarioEmpresaInput {
    empresaId: Int!
    usuarioId: Int!
    rolId: Int!
    costoHora: Float!
    comisionEfectivo: Float!
    comisionTarjeta: Float!
    metaMensual: Float!
    version: Int!
  }
  input ActualizarUsuarioEmpresaInput {
    id: Int!
    rolId: Int!
    costoHora: Float!
    comisionEfectivo: Float!
    comisionTarjeta: Float!
    metaMensual: Float!
    version: Int!
  }

  extend type Query {
    usuarioEmpresasFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): UsuarioEmpresaConnection!
    obtenerUsuarioEmpresas: [UsuarioEmpresa!]!
    validarCodigoUsuarioEmpresa(empresaId: Int!, usuarioId: Int!): Boolean!
  }
  extend type Mutation {
    crearUsuarioEmpresa(input: UsuarioEmpresaInput!): UsuarioEmpresa
    actualizarUsuarioEmpresa(
      input: ActualizarUsuarioEmpresaInput!
    ): UsuarioEmpresa!
    eliminarUsuarioEmpresa(id: Int!): Boolean!
  }
`;
