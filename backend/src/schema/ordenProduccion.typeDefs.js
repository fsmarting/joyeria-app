export default /* GraphQL */ `
  type EntregaOrden {
    id: Int!
    ordenProduccionId: Int!
    numeroRemision: String
    numeroJoyero: String
    fecha: String!
    cantidad: Int!
    cantidadJoyero: Int
    valorEntregado: Float!
    estadoConciliacion: String!
    notaConciliacion: String
    nota: String
    usu_creacion: String
    version: Int!
  }
  type DetalleOrdenProduccion {
    id: Int!
    ordenProduccionId: Int!
    compraInsumoId: Int!
    piedraId: Int!
    cantidad: Float!
    costoUnitario: Float!
    costoTotal: Float!
    desperdicio: Float!
    cantidadEnviada: Float!
    valorEnviado: Float!
    cantidadDevuelta: Float!
    valorDevuelto: Float!
    version: Int!
    compraInsumo: CompraInsumo
    piedra: Piedra
    merma: Float
  }
  type OrdenProduccion {
    id: Int!
    empresaId: Int!
    numero: String!
    descripcion: String
    productoId: Int!
    joyeroId: Int!
    estadoId: Int!
    cantidadProgramada: Int!
    costoUnitarioEstandard: Float!
    costoTotalEstandard: Float!
    cantidadEntregada: Int!
    valorEntregado: Float!
    fechaEnvio: String!
    fechaEstimada: String
    fechaEntrega: String
    nota: String
    version: Int!
    producto: Producto
    joyero: Tercero
    estado: Grupo
    detalles: [DetalleOrdenProduccion!]!
    entregas: [EntregaOrden!]!
  }
  type OrdenProduccionEdge {
    node: OrdenProduccion!
    cursor: ID!
  }
  type OrdenProduccionConnection {
    edges: [OrdenProduccionEdge!]!
    pageInfo: PageInfo!
  }

  input OrdenProduccionInput {
    empresaId: Int!
    numero: String!
    descripcion: String
    productoId: Int!
    joyeroId: Int!
    estadoId: Int!
    cantidadProgramada: Int!
    fechaEnvio: String!
    fechaEstimada: String
    nota: String
    version: Int!
  }
  input OrdenProduccionUpdateInput {
    id: Int!
    numero: String!
    descripcion: String
    productoId: Int!
    joyeroId: Int!
    estadoId: Int!
    cantidadProgramada: Int!
    fechaEnvio: String!
    fechaEstimada: String
    fechaEntrega: String
    nota: String
    version: Int!
  }
  input EntregaOrdenInput {
    ordenProduccionId: Int!
    cantidad: Int!
    cantidadJoyero: Int
    numeroJoyero: String
    nota: String
  }
  input ConciliarEntregaInput {
    id: Int!
    estadoConciliacion: String!
    notaConciliacion: String
    version: Int!
  }
  input DetalleOrdenInput {
    ordenProduccionId: Int!
    compraInsumoId: Int!
    piedraId: Int!
    cantidad: Float!
    costoUnitario: Float!
    costoTotal: Float!
    desperdicio: Float
    cantidadEnviada: Float!
    valorEnviado: Float!
  }
  input DetalleDevolucionInput {
    id: Int!
    cantidadDevuelta: Float!
    valorDevuelto: Float!
    version: Int!
  }

  extend type Query {
    ordenesFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): OrdenProduccionConnection!
  }
  extend type Mutation {
    crearOrdenProduccion(input: OrdenProduccionInput!): OrdenProduccion
    actualizarOrdenProduccion(
      input: OrdenProduccionUpdateInput!
    ): OrdenProduccion!
    eliminarOrdenProduccion(id: Int!): Boolean!
    registrarEntregaOrden(input: EntregaOrdenInput!): OrdenProduccion!
    conciliarEntrega(input: ConciliarEntregaInput!): EntregaOrden!
    agregarDetalleOrden(input: DetalleOrdenInput!): DetalleOrdenProduccion!
    registrarDevolucion(input: DetalleDevolucionInput!): DetalleOrdenProduccion!
    eliminarDetalleOrden(id: Int!): Boolean!
  }
`;
