export default /* GraphQL */ `
  type DashboardVentas {
    totalVentas: Int! ingresosTotales: Float! comisionesTotales: Float!
    utilidadNeta: Float! ticketPromedio: Float!
    ventasEfectivo: Int! ventasTarjeta: Int! ventasTransferencia: Int!
    metaMensual: Float! pctMeta: Float!
  }
  type TopProducto {
    productoId: Int! referencia: String! nombre: String!
    totalVendido: Int! ingresos: Float!
  }
  type AlertaStock {
    id: Int! codigo: String! nombre: String!
    cantidadDisponible: Float! unidad: String
  }
  type ResumenOrden {
    id: Int! numero: String! producto: String! joyero: String!
    cantidadProgramada: Int! cantidadEntregada: Int!
    fechaEstimada: String estado: String!
  }
  type KpiTasaCierre {
    totalConversaciones:   Int!
    conversacionesCerradas:Int!
    tasaCierre:            Float!
    metaTasaCierre:        Float!
    lineaBase:             Float!
    cumplePct:             Float!
  }
  type KpiTicketPromedio {
    ticketPromedio: Float!
    metaTicket:     Float!
    lineaBase:      Float!
    cumplePct:      Float!
    totalVentas:    Int!
  }
  type KpiRecurrencia {
    totalClientas:       Int!
    clientasRecurrentes: Int!
    tasaRecurrencia:     Float!
    metaRecurrencia:     Float!
    lineaBase:           Float!
    cumplePct:           Float!
  }
  type DashboardKpis {
    tasaCierre:     KpiTasaCierre!
    ticketPromedio: KpiTicketPromedio!
    recurrencia:    KpiRecurrencia!
    mes:            Int!
    anio:           Int!
    nombreMes:      String!
  }
  extend type Query {
    dashboardVentas(mes: Int, anio: Int): DashboardVentas!
    topProductos(mes: Int, anio: Int, limit: Int): [TopProducto!]!
    alertasStock(umbralPct: Float): [AlertaStock!]!
    ordenesAbiertas: [ResumenOrden!]!
    dashboardKpis(mes: Int, anio: Int): DashboardKpis!
  }
`;
