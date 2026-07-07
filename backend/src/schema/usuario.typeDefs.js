export default /* GraphQL */ `
  type Usuario {
    id: Int! codigo: String! nombre: String! correo: String
    foto: String estadoId: Int ultimo_login: String version: Int!
    estado: Grupo
  }
  type UsuarioEdge { node: Usuario! cursor: ID! }
  type UsuarioConnection { edges: [UsuarioEdge!]! pageInfo: PageInfo! }

  input CrearUsuarioInput {
    codigo: String! nombre: String! password: String!
    foto: String estadoId: Int version: Int!
  }
  input ActualizarUsuarioInput {
    id: Int! nombre: String! password: String
    foto: String estadoId: Int version: Int!
  }

  extend type Query {
    yo: Usuario
    obtenerUsuarios: [Usuario!]!
    obtenerUsuariosGlobales: [Usuario!]!
    usuariosFiltradosCursor(first: Int after: String orden: [String] direccion: [String] busqueda: String): UsuarioConnection!
    validarCodigoUsuario(codigo: String!): Boolean!
  }
  extend type Mutation {
    crearUsuario(input: CrearUsuarioInput!): Usuario
    actualizarUsuario(input: ActualizarUsuarioInput!): Usuario!
    eliminarUsuario(id: Int!): Boolean!
  }
`;
