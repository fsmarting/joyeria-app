import { gql } from "@apollo/client";

export const VALIDAR_CODIGO_USUARIO_EMPRESA = gql`
  query ValidarCodigoUsuarioEmpresa($empresaId: Int!, $usuarioId: Int!) {
    validarCodigoUsuarioEmpresa(empresaId: $empresaId, usuarioId: $usuarioId)
  }
`;
