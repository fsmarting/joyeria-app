export default /* GraphQL */ `
  type ProductoPiedra {
    id: Int!
    productoId: Int!
    piedraId: Int!
    tipoId: Int
    descripcion: String
    cantidad: Float!
    costoEstandardUnitario: Float!
    costoEstandardTotal: Float!
    desperdicio: Float!
    version: Int!
    piedra: Piedra
    tipoPiedra: Grupo
  }
  type Producto {
    id: Int!
    empresaId: Int!
    referencia: String!
    nombre: String!
    descripcion: String
    foto: String
    costoManoObra: Float!
    costoOtros: Float!
    multiplicador: Float!
    # ── NUEVO (ronda 39) — % de IVA vigente de este producto (Colombia:
    # no todos son 19% — algunos 5%, otros 0%). Ver "deber ser" — es la
    # tarifa viva que se usa para congelar el desglose de cada línea de
    # Cotización/Venta en el momento en que se crea.
    porcentajeIva: Float!
    precioVenta: Float!
    activo: Boolean!
    enStock: Int!
    version: Int!
    categoria: Grupo
    costoPiedras: Float
    costoOro: Float
    costoTotal: Float
    precioSugerido: Float
    pvpConIva: Float
    margen: Float
    ivaValor: Float
    conTarjeta: Float
    comisionMax: Float
    piedras: [ProductoPiedra!]!
  }
  type ProductoEdge {
    node: Producto!
    cursor: ID!
  }
  type ProductoConnection {
    edges: [ProductoEdge!]!
    pageInfo: PageInfo!
  }

  # ── NUEVO — visibilidad de inventario (Kardex) ──────────────────────
  type AjusteInventario {
    id: Int!
    empresaId: Int!
    productoId: Int!
    numero: String!
    tipoMovimiento: String!
    cantidad: Int!
    motivo: String!
    fecha: String!
    version: Int!
  }
  # Una fila unificada de movimiento de stock de un producto, sin importar
  # su origen (producción, venta, muestrario o ajuste manual) — pensada
  # para que el frontend arme el Kardex mensual sin tener que combinar
  # varias consultas distintas.
  type MovimientoInventario {
    fecha: String!
    tipo: String!
    referencia: String!
    cantidad: Int!
    entradaStock: Int!
    salidaStock: Int!
    variacionMuestrario: Int!
    # ── NUEVO — quién tiene la pieza hoy. Solo viene lleno en movimientos
    # de muestrario (Salida/Devolución); null en producción, ventas y
    # ajustes — ahí no aplica.
    vendedora: String
  }

  input ProductoInput {
    empresaId: Int!
    referencia: String!
    nombre: String!
    categoriaId: Int
    descripcion: String
    foto: String
    costoManoObra: Float!
    costoOtros: Float!
    multiplicador: Float
    porcentajeIva: Float
    precioVenta: Float!
    version: Int!
  }
  input ProductoUpdateInput {
    id: Int!
    empresaId: Int!
    referencia: String!
    nombre: String!
    categoriaId: Int
    descripcion: String
    foto: String
    costoManoObra: Float!
    costoOtros: Float!
    multiplicador: Float
    porcentajeIva: Float
    precioVenta: Float!
    version: Int!
  }
  input ProductoPiedraInput {
    productoId: Int!
    piedraId: Int!
    tipoId: Int!
    descripcion: String
    cantidad: Float!
    costoEstandardUnitario: Float!
    desperdicio: Float
  }
  input ProductoPiedraUpdateInput {
    id: Int!
    tipoId: Int
    descripcion: String
    cantidad: Float!
    costoEstandardUnitario: Float!
    desperdicio: Float
    version: Int!
  }
  input AjusteInventarioInput {
    empresaId: Int!
    productoId: Int!
    tipoMovimiento: String!
    cantidad: Int!
    motivo: String!
  }

  extend type Query {
    productosFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): ProductoConnection!
    obtenerProductos: [Producto!]!
    validarCodigoProducto(empresaId: Int!, referencia: String!): Boolean!
    movimientosInventarioProducto(productoId: Int!): [MovimientoInventario!]!
  }
  extend type Mutation {
    crearProducto(input: ProductoInput!): Producto
    actualizarProducto(input: ProductoUpdateInput!): Producto!
    eliminarProducto(id: Int!): Boolean!
    agregarInsumoProducto(input: ProductoPiedraInput!): ProductoPiedra!
    actualizarInsumoProducto(input: ProductoPiedraUpdateInput!): ProductoPiedra!
    eliminarInsumoProducto(id: Int!): Boolean!
    crearAjusteInventario(input: AjusteInventarioInput!): AjusteInventario!
  }
`;
