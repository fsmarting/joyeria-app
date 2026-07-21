export default /* GraphQL */ `
  type ConversacionProducto {
    id: Int!
    conversacionId: Int!
    productoId: Int!
    version: Int!
    producto: Producto
  }
  type Conversacion {
    id: Int!
    empresaId: Int!
    telefono: String
    nombreContacto: String
    clienteId: Int
    canalId: Int
    tierEstimadoId: Int
    usuarioId: Int
    fecha: String!
    cotizo: Boolean!
    cerro: Boolean!
    motivoPerdidaId: Int
    tiempoRespuesta: String
    usoProtocolo: Boolean!
    nota: String
    version: Int!
    cliente: Tercero
    canal: Grupo
    tierEstimado: Grupo
    motivoPerdida: Grupo
    usuario: Usuario
    piezas: [ConversacionProducto!]!
  }
  type ConversacionEdge {
    node: Conversacion!
    cursor: ID!
  }
  type ConversacionConnection {
    edges: [ConversacionEdge!]!
    pageInfo: PageInfo!
  }
  type ConversacionKPIs {
    total: Int!
    cotizaron: Int!
    cerraron: Int!
    tasaCierre: Float!
    usaronProtocolo: Int!
    pctProtocolo: Float!
    perdidaSilencio: Int!
    perdidaPrecio: Int!
    perdidaStock: Int!
  }
  type ContactoBusqueda {
    clienteId: Int
    nombre: String
    telefono: String!
    esCliente: Boolean!
  }
  input ConversacionInput {
    empresaId: Int!
    telefono: String
    nombreContacto: String
    clienteId: Int
    canalId: Int
    tierEstimadoId: Int
    usuarioId: Int
    fecha: String!
    cotizo: Boolean!
    cerro: Boolean!
    motivoPerdidaId: Int
    tiempoRespuesta: String
    usoProtocolo: Boolean!
    nota: String
    version: Int!
    piezasIds: [Int!]
  }
  input ConversacionUpdateInput {
    id: Int!
    empresaId: Int
    telefono: String
    nombreContacto: String
    clienteId: Int
    canalId: Int
    tierEstimadoId: Int
    usuarioId: Int
    fecha: String!
    cotizo: Boolean!
    cerro: Boolean!
    motivoPerdidaId: Int
    tiempoRespuesta: String
    usoProtocolo: Boolean!
    nota: String
    version: Int!
    piezasIds: [Int!]
  }
  extend type Query {
    conversacionesFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): ConversacionConnection!
    kpisConversaciones(mes: Int, anio: Int): ConversacionKPIs!
    buscarContactoPorCelular(
      telefono: String!
      empresaId: Int!
    ): ContactoBusqueda
  }
  extend type Mutation {
    crearConversacion(input: ConversacionInput!): Conversacion
    actualizarConversacion(input: ConversacionUpdateInput!): Conversacion!
    eliminarConversacion(id: Int!): Boolean!
  }
`;
