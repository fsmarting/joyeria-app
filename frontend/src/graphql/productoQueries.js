import { gql } from "@apollo/client";

const BOM_FIELDS = `
  piedras {
    id piedraId productoId tipoId descripcion
    cantidad costoEstandardUnitario costoEstandardTotal desperdicio version
    piedra     { id codigo nombre unidad { nombre } tipo { id codigo nombre } }
    tipoPiedra { id codigo nombre }
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
          id referencia nombre descripcion foto empresaId
          costoManoObra costoOtros
          multiplicador precioVenta enStock activo version
          categoria { id nombre }
          costoPiedras costoOro costoTotal
          precioSugerido pvpConIva margen
          ivaValor conTarjeta comisionMax
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
export const VALIDAR_CODIGO_PRODUCTO = gql`
  query ValidarCodigoProducto($empresaId: Int!, $referencia: String!) {
    validarCodigoProducto(empresaId: $empresaId, referencia: $referencia)
  }
`;

// ── NUEVO — visibilidad de inventario (Kardex) ─────────────────────
export const GET_MOVIMIENTOS_INVENTARIO_PRODUCTO = gql`
  query MovimientosInventarioProducto($productoId: Int!) {
    movimientosInventarioProducto(productoId: $productoId) {
      fecha
      tipo
      referencia
      cantidad
      entradaStock
      salidaStock
      variacionMuestrario
    }
  }
`;
export const CREAR_AJUSTE_INVENTARIO = gql`
  mutation CrearAjusteInventario($input: AjusteInventarioInput!) {
    crearAjusteInventario(input: $input) {
      id
      numero
      tipoMovimiento
      cantidad
      motivo
      fecha
    }
  }
`;
