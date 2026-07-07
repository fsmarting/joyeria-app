import { gql } from '@apollo/client';

export const GET_DASHBOARD_VENTAS = gql`
  query DashboardVentas($mes: Int, $anio: Int) {
    dashboardVentas(mes: $mes, anio: $anio) {
      totalVentas ingresosTotales comisionesTotales utilidadNeta
      ticketPromedio ventasEfectivo ventasTarjeta metaMensual pctMeta
    }
  }
`;

export const GET_TOP_PRODUCTOS = gql`
  query TopProductos($mes: Int, $anio: Int, $limit: Int) {
    topProductos(mes: $mes, anio: $anio, limit: $limit) {
      productoId referencia nombre totalVendido ingresos
    }
  }
`;

export const GET_ALERTAS_STOCK = gql`
  query AlertasStock($umbralPct: Float) {
    alertasStock(umbralPct: $umbralPct) {
      id codigo nombre cantidadDisponible unidad
    }
  }
`;

export const GET_ORDENES_ABIERTAS = gql`
  query OrdenesAbiertas {
    ordenesAbiertas {
      id numero producto joyero cantidadProgramada cantidadEntregada fechaEstimada estado
    }
  }
`;

export const GET_KPIS_CONV = gql`
  query KpisConv($mes: Int, $anio: Int) {
    kpisConversaciones(mes: $mes, anio: $anio) {
      total cerraron tasaCierre usaronProtocolo pctProtocolo
      perdidaSilencio perdidaPrecio
    }
  }
`;
