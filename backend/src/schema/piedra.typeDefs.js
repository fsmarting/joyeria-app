export default /* GraphQL */ `
  type Piedra {
    id: Int!
    empresaId: Int!
    codigo: String!
    nombre: String!
    foto: String
    activo: Boolean!
    costoEstandardPorUnidad: Float!
    version: Int!
    tipo: Grupo
    unidad: Grupo
    # ── NUEVO — visibilidad de inventario de insumos ────────────────
    # Suma de cantidadDisponible de todas las compras (CompraInsumo)
    # vigentes de este insumo — es el equivalente de Producto.enStock,
    # solo que aquí no hay una columna guardada: Piedra no tiene un
    # "stock" propio, su verdad hoy es la suma de sus lotes de compra.
    # Se calcula, no se guarda (mismo motivo que costoPiedras/costoTotal
    # en Producto: siempre refleja el dato vivo, no un snapshot viejo).
    stockDisponible: Float!
  }
  type PiedraEdge {
    node: Piedra!
    cursor: ID!
  }
  type PiedraConnection {
    edges: [PiedraEdge!]!
    pageInfo: PageInfo!
  }

  # ── NUEVO — visibilidad de inventario de insumos (Kardex) ───────────
  # Una fila unificada de movimiento del "saldo total" de un insumo, sin
  # importar su origen (compra nueva, envío a una orden, o devolución de
  # una orden) — mismo patrón que MovimientoInventario en producto.typeDefs.js,
  # pensado para que el frontend arme el Kardex mensual de insumos sin
  # combinar varias consultas.
  type MovimientoInventarioInsumo {
    fecha: String!
    tipo: String!
    referencia: String!
    cantidad: Float!
    entradaStock: Float!
    salidaStock: Float!
    # ── Cuánto de este movimiento sigue hoy en poder de un joyero —
    # mismo concepto que ya existe en DetalleOrdenProduccion.merma
    # (cantidadEnviada − cantidadDevuelta), aquí expresado por movimiento
    # individual para que el frontend pueda sumarlo por orden/joyero.
    # Positivo en envíos (INICIAL/ADICIONAL), negativo en devoluciones.
    variacionCustodia: Float!
    # Solo viene lleno en envíos/devoluciones hacia una orden de
    # producción; null en compras — ahí no aplica.
    joyero: String
  }

  input PiedraInput {
    empresaId: Int!
    codigo: String!
    nombre: String!
    tipoId: Int
    unidadId: Int
    foto: String
    costoEstandardPorUnidad: Float!
    activo: Boolean
    version: Int!
  }
  input PiedraUpdateInput {
    id: Int!
    empresaId: Int!
    codigo: String!
    nombre: String!
    tipoId: Int
    unidadId: Int
    foto: String
    costoEstandardPorUnidad: Float!
    activo: Boolean
    version: Int!
  }

  extend type Query {
    piedrasFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): PiedraConnection!
    obtenerPiedras: [Piedra!]!
    validarCodigoPiedra(empresaId: Int!, codigo: String!): Boolean!
    # ── NUEVO — visibilidad de inventario de insumos (Kardex) ─────────
    movimientosInventarioPiedra(piedraId: Int!): [MovimientoInventarioInsumo!]!
  }
  extend type Mutation {
    crearPiedra(input: PiedraInput!): Piedra
    actualizarPiedra(input: PiedraUpdateInput!): Piedra!
    eliminarPiedra(id: Int!): Boolean!
  }
`;
