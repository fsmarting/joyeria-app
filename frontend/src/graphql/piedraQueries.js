import { gql } from "@apollo/client";

export const GET_PIEDRAS_CURSOR = gql`
  query PiedrasFiltradosCursor(
    $first: Int
    $after: String
    $orden: [String]
    $direccion: [String]
    $busqueda: String
  ) {
    piedrasFiltradosCursor(
      first: $first
      after: $after
      orden: $orden
      direccion: $direccion
      busqueda: $busqueda
    ) {
      edges {
        node {
          id
          empresaId
          codigo
          nombre
          costoEstandardPorUnidad
          activo
          version
          tipo {
            id
            nombre
          }
          unidad {
            id
            nombre
          }
          stockDisponible
          valorStockDisponible
        }
        cursor
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const CREAR_PIEDRA = gql`
  mutation CrearPiedra($input: PiedraInput!) {
    crearPiedra(input: $input) {
      id
    }
  }
`;

export const ACTUALIZAR_PIEDRA = gql`
  mutation ActualizarPiedra($input: PiedraUpdateInput!) {
    actualizarPiedra(input: $input) {
      id
    }
  }
`;

export const ELIMINAR_PIEDRA = gql`
  mutation EliminarPiedra($id: Int!) {
    eliminarPiedra(id: $id)
  }
`;
export const VALIDAR_CODIGO_PIEDRA = gql`
  query ValidarCodigoPiedra($empresaId: Int!, $codigo: String!) {
    validarCodigoPiedra(empresaId: $empresaId, codigo: $codigo)
  }
`;

// ── NUEVO — visibilidad de inventario de insumos (Kardex) ───────────
export const GET_MOVIMIENTOS_INVENTARIO_PIEDRA = gql`
  query MovimientosInventarioPiedra($piedraId: Int!) {
    movimientosInventarioPiedra(piedraId: $piedraId) {
      fecha
      tipo
      referencia
      cantidad
      entradaStock
      salidaStock
      variacionCustodia
      joyero
      entradaValor
      salidaValor
      variacionCustodiaValor
    }
  }
`;

// ── NUEVO (ronda 36) — Ajustes de Inventario de Insumos (Mecanismo 2),
// mismo patrón que CREAR_AJUSTE_INVENTARIO en productoQueries.js.
export const CREAR_AJUSTE_INSUMO = gql`
  mutation CrearAjusteInsumo($input: AjusteInsumoInput!) {
    crearAjusteInsumo(input: $input) {
      id
      numero
      tipoMovimiento
      cantidad
      motivo
      fecha
    }
  }
`;
