export default /* GraphQL */ `
  type RepartoUtilidad {
    id: Int! ventaId: Int! socioId: Int! porcentaje: Float! valor: Float!
    socio: Tercero
  }
  type Venta {
    id: Int! empresaId: Int! clienteId: Int! productoId: Int!
    vendedoraId: Int canalId: Int cotizacionItemId: Int
    cantidad: Int!
    fecha: String! precioVenta: Float!
    medioPagoId: Int! porcentajeComision: Float! valorComision: Float!
    estadoId: Int! version: Int!
    cliente:        Tercero
    producto:       Producto
    vendedora:      Usuario
    canal:          Grupo
    medioPago:      Grupo
    estado:         Grupo
    cotizacionItem: CotizacionItem
    repartos:       [RepartoUtilidad!]!
    origenLabel:    String
  }
  type VentaEdge { node: Venta! cursor: ID! }
  type VentaConnection { edges: [VentaEdge!]! pageInfo: PageInfo! }

  # ── CAMBIO — cantidad reemplaza el supuesto implícito de "1 unidad por
  # fila". estadoId y cotizacionId salen de los inputs: el estado ahora lo
  # calcula el servidor (según medio de pago) o lo cambian confirmarVentaEfectivo
  # / anularVenta, y cotizacionItemId solo lo asigna convertirEnVenta.
  input VentaInput {
    empresaId: Int! clienteId: Int! productoId: Int!
    vendedoraId: Int canalId: Int
    cantidad: Int
    fecha: String! precioVenta: Float!
    medioPagoId: Int! version: Int!
  }
  input VentaUpdateInput {
    id: Int! clienteId: Int! productoId: Int!
    vendedoraId: Int canalId: Int
    cantidad: Int
    fecha: String! precioVenta: Float!
    medioPagoId: Int! version: Int!
  }
  input RepartoInput { ventaId: Int! socioId: Int! porcentaje: Float! }

  extend type Query {
    ventasFiltradosCursor(
      first: Int after: String orden: [String] direccion: [String] busqueda: String
    ): VentaConnection!
    obtenerSocios: [Tercero!]!
  }
  extend type Mutation {
    crearVenta(input: VentaInput!): Venta
    actualizarVenta(input: VentaUpdateInput!): Venta!
    eliminarVenta(id: Int!): Boolean!
    guardarReparto(ventaId: Int!, repartos: [RepartoInput!]!): [RepartoUtilidad!]!
    # ── NUEVO — anular con motivo obligatorio, restaura enStock automáticamente.
    anularVenta(id: Int!, version: Int!, motivo: String!): Venta!
  }
`;
