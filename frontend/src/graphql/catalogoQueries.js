import { gql } from "@apollo/client";

export const VALIDAR_CODIGO_CATALOGO = gql`
  query ValidarCodigoCatalogo($empresaId: Int!, $codigo: String!) {
    validarCodigoCatalogo(empresaId: $empresaId, codigo: $codigo)
  }
`;
