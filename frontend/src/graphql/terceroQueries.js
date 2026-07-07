import { gql } from '@apollo/client';

const TERCERO_FIELDS = `
  id empresaId tipoId tipoDocumentoId numeroDocumento
  nombre telefono ciudad correo nota activo
  tierId canalId porcentajeDefecto version
  tipo { id codigo nombre }
  tipoDocumento { id nombre }
  tier { id nombre }
  canal { id nombre }
  especialidades { id especialidadId nivel esPrincipal especialidad { id nombre } }
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
    obtenerTercerosPorTipo(tipoCodigo: $tipoCodigo) { id nombre telefono porcentajeDefecto especialidades { especialidad { nombre } nivel esPrincipal } }
  }
`;

export const CREAR_TERCERO      = gql`mutation CrearTercero($input: TerceroInput!) { crearTercero(input: $input) { id } }`;
export const ACTUALIZAR_TERCERO = gql`mutation ActualizarTercero($input: TerceroUpdateInput!) { actualizarTercero(input: $input) { id } }`;
export const ELIMINAR_TERCERO   = gql`mutation EliminarTercero($id: Int!) { eliminarTercero(id: $id) }`;

export const AGREGAR_ESPECIALIDAD_TERCERO    = gql`mutation AgregarEspecialidadTercero($input: TerceroEspecialidadInput!) { agregarEspecialidadTercero(input: $input) { id nivel esPrincipal especialidad { id nombre } } }`;
export const REMOVER_ESPECIALIDAD_TERCERO    = gql`mutation RemoverEspecialidadTercero($terceroId: Int!, $especialidadId: Int!) { removerEspecialidadTercero(terceroId: $terceroId, especialidadId: $especialidadId) }`;
export const ACTUALIZAR_NIVEL_ESP_TERCERO    = gql`mutation ActualizarNivelEspecialidadTercero($terceroId: Int!, $especialidadId: Int!, $nivel: String, $esPrincipal: Boolean) { actualizarNivelEspecialidadTercero(terceroId: $terceroId, especialidadId: $especialidadId, nivel: $nivel, esPrincipal: $esPrincipal) { id nivel esPrincipal especialidad { id nombre } } }`;
