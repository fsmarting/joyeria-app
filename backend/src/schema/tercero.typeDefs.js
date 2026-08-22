export default /* GraphQL */ `
  type TerceroEspecialidad {
    id: Int!
    terceroId: Int!
    especialidadId: Int!
    nivel: String
    esPrincipal: Boolean!
    version: Int!
    especialidad: Grupo
  }

  # ── NUEVO (ronda 46) — un tercero puede tener varios roles a la vez
  # (Cliente, Joyero, Proveedor, Socio). Reemplaza el antiguo campo único
  # "tipoId" — ver comentario en schema.prisma.
  type TerceroRol {
    id: Int!
    terceroId: Int!
    rolId: Int!
    version: Int!
    rol: Grupo
  }

  type Tercero {
    id: Int!
    empresaId: Int!
    tipoDocumentoId: Int
    numeroDocumento: String
    nombre: String!
    telefono: String
    ciudad: String
    correo: String
    nota: String
    activo: Boolean!
    tierId: Int
    canalId: Int
    porcentajeDefecto: Float
    version: Int!
    tipoDocumento: Grupo
    tier: Grupo
    canal: Grupo
    especialidades: [TerceroEspecialidad!]!
    roles: [TerceroRol!]!
  }

  type TerceroEdge {
    node: Tercero!
    cursor: ID!
  }
  type TerceroConnection {
    edges: [TerceroEdge!]!
    pageInfo: PageInfo!
  }

  input TerceroInput {
    empresaId: Int!
    # ── CAMBIO (ronda 46) — antes "tipoId" (rol único y obligatorio).
    # Ahora es el rol CON el que nace el tercero — se puede agregar más
    # roles después con agregarRolTercero, sin duplicar la ficha.
    rolId: Int!
    tipoDocumentoId: Int
    numeroDocumento: String
    nombre: String!
    telefono: String
    ciudad: String
    correo: String
    nota: String
    activo: Boolean
    tierId: Int
    canalId: Int
    porcentajeDefecto: Float
    version: Int!
  }
  input TerceroUpdateInput {
    id: Int!
    empresaId: Int!
    tipoDocumentoId: Int
    numeroDocumento: String
    nombre: String!
    telefono: String
    ciudad: String
    correo: String
    nota: String
    activo: Boolean
    tierId: Int
    canalId: Int
    porcentajeDefecto: Float
    version: Int!
  }
  input TerceroEspecialidadInput {
    terceroId: Int!
    especialidadId: Int!
    nivel: String
    esPrincipal: Boolean
  }
  # ── NUEVO (ronda 46)
  input TerceroRolInput {
    terceroId: Int!
    rolId: Int!
  }
  type VentaResumen {
    id: Int!
    fecha: String!
    precioVenta: Float!
    producto: Producto
    medioPago: Grupo
    estado: Grupo
  }
  type ConversacionResumen {
    id: Int!
    fecha: String!
    telefono: String
    nombreContacto: String
    cotizo: Boolean!
    cerro: Boolean!
    canal: Grupo
  }
  type CotizacionResumen {
    id: Int!
    numero: String!
    fecha: String!
    total: Float!
    estado: Grupo
  }
  type PerfilClienta {
    clienteId: Int!
    nombre: String!
    telefono: String
    totalComprado: Float!
    totalVentas: Int!
    ticketPromedio: Float!
    ultimaCompra: String
    ventas: [VentaResumen!]!
    conversaciones: [ConversacionResumen!]!
    cotizaciones: [CotizacionResumen!]!
  }

  extend type Query {
    tercerosFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
      tipoCodigo: String
    ): TerceroConnection!
    obtenerTercerosPorTipo(tipoCodigo: String!): [Tercero!]!
    perfilClienta(clienteId: Int!, empresaId: Int!): PerfilClienta
  }
  extend type Mutation {
    crearTercero(input: TerceroInput!): Tercero
    actualizarTercero(input: TerceroUpdateInput!): Tercero!
    eliminarTercero(id: Int!): Boolean!
    agregarEspecialidadTercero(
      input: TerceroEspecialidadInput!
    ): TerceroEspecialidad!
    removerEspecialidadTercero(terceroId: Int!, especialidadId: Int!): Boolean!
    actualizarNivelEspecialidadTercero(
      terceroId: Int!
      especialidadId: Int!
      nivel: String
      esPrincipal: Boolean
    ): TerceroEspecialidad!
    # ── NUEVO (ronda 46) — agregar/quitar un rol adicional a un tercero
    # que ya existe (ej: un Joyero que también empieza a comprar como
    # Cliente), sin crear una ficha duplicada.
    agregarRolTercero(input: TerceroRolInput!): TerceroRol!
    removerRolTercero(terceroId: Int!, rolId: Int!): Boolean!
  }
`;
