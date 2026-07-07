import { gql } from '@apollo/client';

// Reutilizable para CUALQUIER selector del sistema
// categorías de producto: catalogoCodigo='PRODU', subcatalogoCodigo='CATP'
// tipos de piedra:        catalogoCodigo='PRODU', subcatalogoCodigo='TPIE'
// medio de pago:          catalogoCodigo='VENT',  subcatalogoCodigo='MPAG'
export const GET_GRUPOS_POR_CODIGOS = gql`
  query GruposPorCodigos($catalogoCodigo: String!, $subcatalogoCodigo: String!) {
    gruposPorCodigos(catalogoCodigo: $catalogoCodigo, subcatalogoCodigo: $subcatalogoCodigo) {
      id
      codigo
      nombre
    }
  }
`;
