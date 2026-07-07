import { gql } from '@apollo/client';

const CONV_FIELDS = `
  id empresaId clienteId usuarioId canalId fecha
  cotizo cerro motivoPerdidaId usoProtocolo nota version
  cliente       { id nombre }
  usuario       { id nombre }
  canal         { id nombre }
  motivoPerdida { id nombre }
`;

export const GET_CONVERSACIONES_CURSOR = gql`
  query ConversacionesFiltradosCursor($first: Int $after: String $orden: [String] $direccion: [String] $busqueda: String) {
    conversacionesFiltradosCursor(first: $first after: $after orden: $orden direccion: $direccion busqueda: $busqueda) {
      edges { node { ${CONV_FIELDS} } cursor }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const CREAR_CONVERSACION     = gql`mutation CrearConversacion($input: ConversacionInput!) { crearConversacion(input: $input) { id } }`;
export const ACTUALIZAR_CONVERSACION= gql`mutation ActualizarConversacion($input: ConversacionUpdateInput!) { actualizarConversacion(input: $input) { id } }`;
export const ELIMINAR_CONVERSACION  = gql`mutation EliminarConversacion($id: Int!) { eliminarConversacion(id: $id) }`;

export const GET_KPIS_CONVERSACIONES = gql`
  query KpisConversaciones($mes: Int, $anio: Int) {
    kpisConversaciones(mes: $mes, anio: $anio) {
      total cotizaron cerraron tasaCierre
      usaronProtocolo pctProtocolo
      perdidaSilencio perdidaPrecio perdidaStock
    }
  }
`;
