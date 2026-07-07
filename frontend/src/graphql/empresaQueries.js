import { gql } from '@apollo/client';

// Usado por ModalGenericoAvanzado para validar unicidad de empresa
// En JoyeriaApp no se crean empresas desde UI, pero el import es requerido
export const VALIDAR_CODIGO_EMPRESA = gql`
  query ValidarCodigoEmpresa($codigo: String!) {
    validarCodigoEmpresa(codigo: $codigo)
  }
`;
