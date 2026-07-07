export default /* GraphQL */ `
  type Conversacion {
    id: Int! empresaId: Int! clienteId: Int usuarioId: Int canalId: Int
    productoId: Int fecha: String! cotizo: Boolean! cerro: Boolean!
    motivoPerdidaId: Int usoProtocolo: Boolean! nota: String version: Int!
    cliente: Tercero usuario: Usuario canal: Grupo
    motivoPerdida: Grupo producto: Producto
  }
  type ConversacionEdge { node: Conversacion! cursor: ID! }
  type ConversacionConnection { edges: [ConversacionEdge!]! pageInfo: PageInfo! }
  type ConversacionKPIs {
    total: Int! cotizaron: Int! cerraron: Int! tasaCierre: Float!
    usaronProtocolo: Int! pctProtocolo: Float!
    perdidaSilencio: Int! perdidaPrecio: Int! perdidaStock: Int!
  }
  input ConversacionInput {
    empresaId: Int! clienteId: Int usuarioId: Int canalId: Int
    productoId: Int fecha: String! cotizo: Boolean! cerro: Boolean!
    motivoPerdidaId: Int usoProtocolo: Boolean! nota: String version: Int!
  }
  input ConversacionUpdateInput {
    id: Int! clienteId: Int usuarioId: Int canalId: Int
    productoId: Int fecha: String! cotizo: Boolean! cerro: Boolean!
    motivoPerdidaId: Int usoProtocolo: Boolean! nota: String version: Int!
  }
  extend type Query {
    conversacionesFiltradosCursor(
      first: Int after: String orden: [String] direccion: [String] busqueda: String
    ): ConversacionConnection!
    kpisConversaciones(mes: Int, anio: Int): ConversacionKPIs!
  }
  extend type Mutation {
    crearConversacion(input: ConversacionInput!): Conversacion
    actualizarConversacion(input: ConversacionUpdateInput!): Conversacion!
    eliminarConversacion(id: Int!): Boolean!
  }
`;
