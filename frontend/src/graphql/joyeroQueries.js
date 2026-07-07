import { gql } from '@apollo/client';

const ESPECIALIDADES_FRAGMENT = `
  especialidades {
    id especialidadId nivel esPrincipal
    especialidad { id nombre }
  }
`;

export const GET_JOYEROS_CURSOR = gql`
  query JoyerosFiltradosCursor(
    $first: Int $after: String $orden: [String] $direccion: [String] $busqueda: String
  ) {
    joyerosFiltradosCursor(
      first: $first after: $after orden: $orden direccion: $direccion busqueda: $busqueda
    ) {
      edges {
        node {
          id nombre telefono activo version
          especialidades {
            id especialidadId nivel esPrincipal
            especialidad { id nombre }
          }
        }
        cursor
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const CREAR_JOYERO = gql`
  mutation CrearJoyero($input: JoyeroInput!) {
    crearJoyero(input: $input) { id }
  }
`;

export const ACTUALIZAR_JOYERO = gql`
  mutation ActualizarJoyero($input: JoyeroUpdateInput!) {
    actualizarJoyero(input: $input) { id }
  }
`;

export const ELIMINAR_JOYERO = gql`
  mutation EliminarJoyero($id: Int!) {
    eliminarJoyero(id: $id)
  }
`;

export const AGREGAR_ESPECIALIDAD = gql`
  mutation AgregarEspecialidadJoyero($input: JoyeroEspecialidadInput!) {
    agregarEspecialidadJoyero(input: $input) {
      id nivel esPrincipal
      especialidad { id nombre }
    }
  }
`;

export const REMOVER_ESPECIALIDAD = gql`
  mutation RemoverEspecialidadJoyero($joyeroId: Int!, $especialidadId: Int!) {
    removerEspecialidadJoyero(joyeroId: $joyeroId, especialidadId: $especialidadId)
  }
`;

export const ACTUALIZAR_NIVEL = gql`
  mutation ActualizarNivelEspecialidad($joyeroId: Int!, $especialidadId: Int!, $nivel: String, $esPrincipal: Boolean) {
    actualizarNivelEspecialidad(joyeroId: $joyeroId, especialidadId: $especialidadId, nivel: $nivel, esPrincipal: $esPrincipal) {
      id nivel esPrincipal
      especialidad { id nombre }
    }
  }
`;
