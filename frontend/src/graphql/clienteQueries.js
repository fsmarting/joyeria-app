import { gql } from '@apollo/client';
export const GET_CLIENTES_CURSOR = gql`
  query ClientesFiltradosCursor($first: Int $after: String $orden: [String] $direccion: [String] $busqueda: String) {
    clientesFiltradosCursor(first: $first after: $after orden: $orden direccion: $direccion busqueda: $busqueda) {
      edges { node { id nombre telefono nota version tier { id nombre } canal { id nombre } } cursor }
      pageInfo { endCursor hasNextPage }
    }
  }
`;
export const OBTENER_CLIENTES  = gql`query ObtenerClientes { obtenerClientes { id nombre telefono tier { nombre } canal { nombre } } }`;
export const CREAR_CLIENTE     = gql`mutation CrearCliente($input: ClienteInput!) { crearCliente(input: $input) { id } }`;
export const ACTUALIZAR_CLIENTE= gql`mutation ActualizarCliente($input: ClienteUpdateInput!) { actualizarCliente(input: $input) { id } }`;
export const ELIMINAR_CLIENTE  = gql`mutation EliminarCliente($id: Int!) { eliminarCliente(id: $id) }`;
