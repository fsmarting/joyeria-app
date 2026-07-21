import { gql } from '@apollo/client';

const CONV_FIELDS = `
  id empresaId fecha version
  telefono nombreContacto clienteId
  canalId tierEstimadoId usuarioId
  cotizo cerro motivoPerdidaId tiempoRespuesta usoProtocolo nota
  cliente      { id nombre telefono }
  canal        { id codigo nombre }
  tierEstimado { id codigo nombre }
  motivoPerdida{ id codigo nombre }
  usuario      { id nombre }
  piezas {
    id productoId version
    producto { id referencia nombre precioVenta foto }
  }
`;

export const GET_CONVERSACIONES_CURSOR = gql`
  query ConversacionesFiltradosCursor(
    $first: Int $after: String $orden: [String] $direccion: [String] $busqueda: String
  ) {
    conversacionesFiltradosCursor(
      first: $first after: $after orden: $orden direccion: $direccion busqueda: $busqueda
    ) {
      edges { node { ${CONV_FIELDS} } cursor }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const BUSCAR_CONTACTO = gql`
  query BuscarContactoPorCelular($telefono: String!, $empresaId: Int!) {
    buscarContactoPorCelular(telefono: $telefono, empresaId: $empresaId) {
      clienteId nombre telefono esCliente
    }
  }
`;

export const CREAR_CONVERSACION      = gql`mutation CrearConversacion($input: ConversacionInput!) { crearConversacion(input: $input) { id } }`;
export const ACTUALIZAR_CONVERSACION = gql`mutation ActualizarConversacion($input: ConversacionUpdateInput!) { actualizarConversacion(input: $input) { id } }`;
export const ELIMINAR_CONVERSACION   = gql`mutation EliminarConversacion($id: Int!) { eliminarConversacion(id: $id) }`;
