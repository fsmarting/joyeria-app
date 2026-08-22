import { gql } from "@apollo/client";

// ── CAMBIO (ronda 46) — "tipoId"/"tipo { ... }" se retiran (un tercero ya
// no tiene un tipo único); se agrega "roles" (uno o varios por tercero).
const TERCERO_FIELDS = `
  id empresaId tipoDocumentoId numeroDocumento
  nombre telefono ciudad correo nota activo
  tierId canalId porcentajeDefecto version
  tipoDocumento { id nombre }
  tier { id nombre }
  canal { id nombre }
  especialidades { id especialidadId nivel esPrincipal especialidad { id nombre } }
  roles { id rolId rol { id codigo nombre } }
`;

export const GET_TERCEROS_CURSOR = gql`
  query TercerosFiltradosCursor(
    $first: Int $after: String $orden: [String] $direccion: [String]
    $busqueda: String $tipoCodigo: String
  ) {
    tercerosFiltradosCursor(
      first: $first after: $after orden: $orden direccion: $direccion
      busqueda: $busqueda tipoCodigo: $tipoCodigo
    ) {
      edges { node { ${TERCERO_FIELDS} } cursor }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const OBTENER_TERCEROS_POR_TIPO = gql`
  query ObtenerTercerosPorTipo($tipoCodigo: String!) {
    obtenerTercerosPorTipo(tipoCodigo: $tipoCodigo) {
      id
      nombre
      telefono
      porcentajeDefecto
      especialidades {
        especialidad {
          nombre
        }
        nivel
        esPrincipal
      }
      roles {
        rolId
        rol {
          codigo
          nombre
        }
      }
    }
  }
`;

export const CREAR_TERCERO = gql`
  mutation CrearTercero($input: TerceroInput!) {
    crearTercero(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_TERCERO = gql`
  mutation ActualizarTercero($input: TerceroUpdateInput!) {
    actualizarTercero(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_TERCERO = gql`
  mutation EliminarTercero($id: Int!) {
    eliminarTercero(id: $id)
  }
`;

export const AGREGAR_ESPECIALIDAD_TERCERO = gql`
  mutation AgregarEspecialidadTercero($input: TerceroEspecialidadInput!) {
    agregarEspecialidadTercero(input: $input) {
      id
      nivel
      esPrincipal
      especialidad {
        id
        nombre
      }
    }
  }
`;
export const REMOVER_ESPECIALIDAD_TERCERO = gql`
  mutation RemoverEspecialidadTercero($terceroId: Int!, $especialidadId: Int!) {
    removerEspecialidadTercero(
      terceroId: $terceroId
      especialidadId: $especialidadId
    )
  }
`;
export const ACTUALIZAR_NIVEL_ESP_TERCERO = gql`
  mutation ActualizarNivelEspecialidadTercero(
    $terceroId: Int!
    $especialidadId: Int!
    $nivel: String
    $esPrincipal: Boolean
  ) {
    actualizarNivelEspecialidadTercero(
      terceroId: $terceroId
      especialidadId: $especialidadId
      nivel: $nivel
      esPrincipal: $esPrincipal
    ) {
      id
      nivel
      esPrincipal
      especialidad {
        id
        nombre
      }
    }
  }
`;

// ── NUEVO (ronda 46) — agregar/quitar un rol adicional a un tercero que
// ya existe (ej: un Joyero que también empieza a comprar como Cliente).
export const AGREGAR_ROL_TERCERO = gql`
  mutation AgregarRolTercero($input: TerceroRolInput!) {
    agregarRolTercero(input: $input) {
      id
      rolId
      rol {
        id
        nombre
      }
    }
  }
`;
export const REMOVER_ROL_TERCERO = gql`
  mutation RemoverRolTercero($terceroId: Int!, $rolId: Int!) {
    removerRolTercero(terceroId: $terceroId, rolId: $rolId)
  }
`;
