import { gql } from "@apollo/client";

const BOM_FIELDS = `
  piedras {
    id piedraId cantidad costoEstandardUnitario costoEstandardTotal desperdicio version
    piedra { id codigo nombre unidad { nombre } tipo { nombre } }
  }
`;

export const GET_PRODUCTOS_CURSOR = gql`
  query ProductosFiltradosCursor(
    $first: Int $after: String $orden: [String] $direccion: [String] $busqueda: String
  ) {
    productosFiltradosCursor(
      first: $first after: $after orden: $orden direccion: $direccion busqueda: $busqueda
    ) {
      edges {
        node {
          id 
          referencia 
          nombre 
          descripcion 
          gramosOro 
          costoGramoOroUsado
          costoManoObra 
          costoOtros 
          costoTotal
          precioVenta 
          margen 
          enStock
          activo
          version
          categoria { id nombre }
          ${BOM_FIELDS}
        }
        cursor
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const CREAR_PRODUCTO = gql`
  mutation CrearProducto($input: ProductoInput!) {
    crearProducto(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_PRODUCTO = gql`
  mutation ActualizarProducto($input: ProductoUpdateInput!) {
    actualizarProducto(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_PRODUCTO = gql`
  mutation EliminarProducto($id: Int!) {
    eliminarProducto(id: $id)
  }
`;

export const AGREGAR_INSUMO_PRODUCTO = gql`
  mutation AgregarInsumoProducto($input: ProductoPiedraInput!) {
    agregarInsumoProducto(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_INSUMO_PRODUCTO = gql`
  mutation ActualizarInsumoProducto($input: ProductoPiedraUpdateInput!) {
    actualizarInsumoProducto(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_INSUMO_PRODUCTO = gql`
  mutation EliminarInsumoProducto($id: Int!) {
    eliminarInsumoProducto(id: $id)
  }
`;
