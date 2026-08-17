export default /* GraphQL */ `
  # ── NUEVO — cabeza de una compra de insumos. Antes numero/fecha/
  # proveedor/nota vivían en la misma fila que el insumo comprado
  # (CompraInsumo), lo que obligaba a una piedra por compra. Ahora Compra
  # es la cabeza y CompraInsumo el detalle — mismo patrón que
  # Muestrario/MuestrarioItem y OrdenProduccion/DetalleOrdenProduccion.
  type Compra {
    id: Int!
    empresaId: Int!
    numero: String!
    proveedorId: Int
    fecha: String!
    nota: String
    version: Int!
    proveedor: Tercero
    items: [CompraInsumo!]!
    totalItems: Int!
    valorTotal: Float!
  }
  type CompraEdge {
    node: Compra!
    cursor: ID!
  }
  type CompraConnection {
    edges: [CompraEdge!]!
    pageInfo: PageInfo!
  }

  # ── CAMBIO — ahora es el detalle de una Compra (perdió numero/fecha/
  # proveedorId/nota, que subieron a la cabeza). Sigue siendo el "lote"
  # individual de un insumo — DetalleOrdenProduccion.compraInsumoId y
  # MovimientoInsumoOrden.compraInsumoId lo siguen usando exactamente
  # igual que antes.
  type CompraInsumo {
    id: Int!
    compraId: Int!
    piedraId: Int!
    cantidad: Float!
    costoUnitario: Float!
    costoTotal: Float!
    cantidadDisponible: Float!
    version: Int!
    compra: Compra
    piedra: Piedra
  }

  input CompraInput {
    empresaId: Int!
    numero: String!
    proveedorId: Int
    fecha: String!
    nota: String
    version: Int!
  }
  input CompraUpdateInput {
    id: Int!
    empresaId: Int!
    numero: String!
    proveedorId: Int
    fecha: String!
    nota: String
    version: Int!
  }
  input CompraInsumoItemInput {
    compraId: Int!
    piedraId: Int!
    cantidad: Float!
    costoUnitario: Float!
  }
  input CompraInsumoItemUpdateInput {
    id: Int!
    cantidad: Float!
    costoUnitario: Float!
    version: Int!
  }

  extend type Query {
    comprasFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): CompraConnection!
    obtenerCompras: [Compra!]!
    # Sigue a nivel de detalle (los lotes con stock de un insumo) — no
    # cambia lo que ya usa OrdenProduccion para elegir de dónde enviar.
    # ── NUEVO (ronda 38) — soloDisponibles (default true, no rompe a
    # quien ya llama esta query sin el argumento): el selector de lote
    # para "Ajustes de Insumo → Hallazgo" (Piedra.jsx) necesita poder
    # elegir un lote con cantidadDisponible = 0 — es justo el caso más
    # típico de un hallazgo (se creía agotado y apareció material
    # sobrante). Pérdida y los demás usos (OrdenProduccion) siguen
    # pidiendo solo lotes con stock, como siempre.
    comprasPorPiedra(piedraId: Int!, soloDisponibles: Boolean): [CompraInsumo!]!
  }
  extend type Mutation {
    crearCompra(input: CompraInput!): Compra
    actualizarCompra(input: CompraUpdateInput!): Compra!
    eliminarCompra(id: Int!): Boolean!
    agregarItemCompra(input: CompraInsumoItemInput!): CompraInsumo!
    actualizarItemCompra(input: CompraInsumoItemUpdateInput!): CompraInsumo!
    eliminarItemCompra(id: Int!): Boolean!
  }
`;
