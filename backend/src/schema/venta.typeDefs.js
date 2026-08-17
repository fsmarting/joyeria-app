export default /* GraphQL */ `
  type RepartoUtilidad {
    id: Int!
    ventaId: Int!
    socioId: Int!
    porcentaje: Float!
    valor: Float!
    socio: Tercero
  }
  # ── CAMBIO (ronda 34) — Venta (cabeza) + VentaDetalle (línea), mismo
  # patrón que Compra/CompraInsumo: antes cada Venta era un solo producto;
  # ahora la cabeza agrupa la transacción (cliente, vendedora, medio de
  # pago, comisión) y el detalle tiene línea por línea qué se vendió.
  type Venta {
    id: Int!
    empresaId: Int!
    numero: String!
    clienteId: Int!
    vendedoraId: Int
    canalId: Int
    medioPagoId: Int!
    fecha: String!
    porcentajeComision: Float!
    estadoId: Int!
    version: Int!
    # ── NUEVO (ronda 40) — fecha en que se marcó como Entregada. Null
    # mientras no se haya entregado.
    fechaEntrega: String
    cliente: Tercero
    vendedora: Usuario
    canal: Grupo
    medioPago: Grupo
    estado: Grupo
    repartos: [RepartoUtilidad!]!
    items: [VentaDetalle!]!
    # Calculados a partir de las líneas — mismo criterio que
    # Compra.totalItems/valorTotal, no se guardan.
    totalItems: Int!
    valorTotal: Float!
    valorComision: Float!
    origenLabel: String
    # ── NUEVO (ronda 42) — utilidad real a repartir entre las socias:
    # suma de (baseGravable − costoUnitario) por línea, menos la comisión
    # de la vendedora. Reemplaza el cálculo anterior (que usaba el valor
    # bruto de la venta, con IVA incluido y sin descontar el costo).
    utilidadReparto: Float!
  }
  type VentaDetalle {
    id: Int!
    ventaId: Int!
    productoId: Int!
    muestrarioItemId: Int
    cotizacionItemId: Int
    cantidad: Int!
    precioVenta: Float!
    subtotal: Float!
    version: Int!
    # ── NUEVO (ronda 39) — desglose de IVA congelado al momento en que
    # esta línea se creó (venta directa, desde muestrario, o conversión
    # de cotización). precioVenta ya incluye IVA; baseGravable + valorIva
    # == precioVenta (por unidad, antes de multiplicar por cantidad).
    porcentajeIva: Float!
    baseGravable: Float!
    valorIva: Float!
    # ── NUEVO (ronda 42) — costo de producción de esta pieza, congelado
    # al momento en que se creó la línea (ver schema.prisma). margen es
    # el valor calculado (baseGravable − costoUnitario) × cantidad,
    # informativo por línea.
    costoUnitario: Float!
    margen: Float!
    producto: Producto
    venta: Venta
    cotizacionItem: CotizacionItem
    origenLabel: String
  }
  type VentaEdge {
    node: Venta!
    cursor: ID!
  }
  type VentaConnection {
    edges: [VentaEdge!]!
    pageInfo: PageInfo!
  }

  # ── CAMBIO (ronda 34) — solo campos de cabeza. numero lo genera el
  # servidor (igual que Muestrario), no se digita. productoId/cantidad/
  # precioVenta ahora se agregan con agregarItemVenta después de crear la
  # cabeza, igual que agregarItemCompra.
  input VentaInput {
    empresaId: Int!
    clienteId: Int!
    vendedoraId: Int
    canalId: Int
    fecha: String!
    medioPagoId: Int!
    version: Int!
  }
  input VentaUpdateInput {
    id: Int!
    clienteId: Int!
    vendedoraId: Int
    canalId: Int
    fecha: String!
    medioPagoId: Int!
    version: Int!
  }
  input VentaItemInput {
    ventaId: Int!
    productoId: Int!
    cantidad: Int!
    precioVenta: Float!
  }
  input VentaItemUpdateInput {
    id: Int!
    cantidad: Int!
    precioVenta: Float!
    version: Int!
  }
  # ── FIX (este arreglo) — RepartoInput traía "ventaId: Int!" como campo
  # OBLIGATORIO, pero guardarReparto ya recibe ventaId aparte (como
  # argumento de la mutación, ver abajo) y el resolver nunca lee
  # r.ventaId de cada item — es decir, el campo estaba de más. El
  # formulario del frontend nunca lo mandaba (con toda razón, porque no
  # hacía falta), así que GraphQL rechazaba la mutación completa con
  # "Field ventaId of required type Int! was not provided" en CADA
  # intento de guardar un reparto. Se quita el campo redundante.
  input RepartoInput {
    socioId: Int!
    porcentaje: Float!
  }

  extend type Query {
    ventasFiltradosCursor(
      first: Int
      after: String
      orden: [String]
      direccion: [String]
      busqueda: String
    ): VentaConnection!
    obtenerSocios: [Tercero!]!
  }
  extend type Mutation {
    crearVenta(input: VentaInput!): Venta
    actualizarVenta(input: VentaUpdateInput!): Venta!
    eliminarVenta(id: Int!): Boolean!
    # ── NUEVO (ronda 34) — agregar/editar/quitar líneas de una venta,
    # mismo patrón que agregarItemCompra/actualizarItemCompra/
    # eliminarItemCompra. Cada una valida y ajusta producto.enStock.
    agregarItemVenta(input: VentaItemInput!): VentaDetalle!
    actualizarItemVenta(input: VentaItemUpdateInput!): VentaDetalle!
    eliminarItemVenta(id: Int!): Boolean!
    guardarReparto(
      ventaId: Int!
      repartos: [RepartoInput!]!
    ): [RepartoUtilidad!]!
    # ── NUEVO — anular con motivo obligatorio, restaura enStock automáticamente.
    anularVenta(id: Int!, version: Int!, motivo: String!): Venta!
    # ── MOVIDO (ronda 40) — antes vivía en muestrario.typeDefs.js, solo
    # tenía botón desde Muestrario. Pasa la venta de "En proceso" (pago
    # sin confirmar) a "Confirmada" (pago ya verificado).
    confirmarVentaEfectivo(ventaId: Int!): Venta!
    # ── NUEVO (ronda 40) — cierra la venta: pasa de "Confirmada" a
    # "Entregada" (el cliente ya tiene la pieza). Solo válido desde CONF.
    entregarVenta(id: Int!, version: Int!): Venta!
  }
`;
