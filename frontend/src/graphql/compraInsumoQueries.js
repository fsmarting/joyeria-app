import { gql } from "@apollo/client";

const PIEDRA_FRAGMENT = `
  piedra { id codigo nombre
    tipo   { id nombre }
    unidad { id nombre }
  }
`;

export const GET_COMPRAS_CURSOR = gql`
  query ComprasFiltradosCursor(
    $first: Int
    $after: String
    $orden: [String]
    $direccion: [String]
    $busqueda: String
  ) {
    comprasFiltradosCursor(
      first: $first
      after: $after
      orden: $orden
      direccion: $direccion
      busqueda: $busqueda
    ) {
      edges {
        node {
          id
          numero
          fecha
          cantidad
          costoUnitario
          costoTotal
          cantidadDisponible
          nota
          version
          proveedor {
            id
            nombre
          }
          piedra {
            id
            codigo
            nombre
            tipo {
              id
              nombre
            }
            unidad {
              id
              nombre
            }
          }
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

export const CREAR_COMPRA = gql`
  mutation CrearCompraInsumo($input: CompraInsumoInput!) {
    crearCompraInsumo(input: $input) {
      id
    }
  }
`;

export const ACTUALIZAR_COMPRA = gql`
  mutation ActualizarCompraInsumo($input: CompraInsumoUpdateInput!) {
    actualizarCompraInsumo(input: $input) {
      id
    }
  }
`;

export const ELIMINAR_COMPRA = gql`
  mutation EliminarCompraInsumo($id: Int!) {
    eliminarCompraInsumo(id: $id)
  }
`;

export const GET_COMPRAS_POR_PIEDRA = gql`
  query ComprasPorPiedra($piedraId: Int!) {
    comprasPorPiedra(piedraId: $piedraId) {
      id
      numero
      fecha
      costoUnitario
      cantidadDisponible
      piedra {
        id
        nombre
        unidad {
          nombre
        }
      }
    }
  }
`;
