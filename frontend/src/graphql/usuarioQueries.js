import { gql } from "@apollo/client";

// Usado por ModalGenericoAvanzado para validar unicidad de usuario
// En JoyeriaApp no se crean empresas desde UI, pero el import es requerido
export const VALIDAR_CODIGO_USUARIO = gql`
  query ValidarCodigoUsuario($codigo: String!) {
    validarCodigoUsuario(codigo: $codigo)
  }
`;
