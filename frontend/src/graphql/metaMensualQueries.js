import { gql } from '@apollo/client';

export const GET_METAS_CURSOR = gql`
  query MetasMensualesCursor(
    $first: Int $after: String $orden: [String] $direccion: [String]
  ) {
    metasMensualesCursor(
      first: $first after: $after orden: $orden direccion: $direccion
    ) {
      edges {
        node { id empresaId anio mes nombreMes metaIngresos metaVentas observaciones version }
        cursor
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const CREAR_META      = gql`mutation CrearMetaMensual($input: MetaMensualInput!) { crearMetaMensual(input: $input) { id } }`;
export const ACTUALIZAR_META = gql`mutation ActualizarMetaMensual($input: MetaMensualUpdateInput!) { actualizarMetaMensual(input: $input) { id } }`;
export const ELIMINAR_META   = gql`mutation EliminarMetaMensual($id: Int!) { eliminarMetaMensual(id: $id) }`;
