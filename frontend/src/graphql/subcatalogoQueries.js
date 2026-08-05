import { gql } from "@apollo/client";

export const VALIDAR_CODIGO_SUBCATALOGO = gql`
  query ValidarCodigoSubCatalogo($catalogoId: Int!, $codigo: String!) {
    validarCodigoSubCatalogo(catalogoId: $catalogoId, codigo: $codigo)
  }
`;
