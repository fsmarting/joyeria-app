import { gql } from "@apollo/client";

// ── Empresa ──────────────────────────────────────────────────────
export const GET_EMPRESAS_CURSOR = gql`
  query Empresas {
    empresas {
      id
      codigo
      nombre
      version
    }
  }
`;
export const OBTENER_EMPRESAS = gql`
  query ObtenerEmpresas {
    obtenerEmpresas {
      id
      codigo
      nombre
    }
  }
`;
export const CREAR_EMPRESA = gql`
  mutation CrearEmpresa($input: EmpresaInput!) {
    crearEmpresa(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_EMPRESA = gql`
  mutation ActualizarEmpresa($input: EmpresaUpdateInput!) {
    actualizarEmpresa(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_EMPRESA = gql`
  mutation EliminarEmpresa($id: Int!) {
    eliminarEmpresa(id: $id)
  }
`;

// ── Usuario ──────────────────────────────────────────────────────
export const GET_USUARIOS_CURSOR = gql`
  query UsuariosFiltradosCursor(
    $first: Int
    $after: String
    $orden: [String]
    $direccion: [String]
    $busqueda: String
  ) {
    usuariosFiltradosCursor(
      first: $first
      after: $after
      orden: $orden
      direccion: $direccion
      busqueda: $busqueda
    ) {
      edges {
        node {
          id
          codigo
          nombre
          foto
          estadoId
          version
          estado {
            id
            nombre
          }
        }
        cursor
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;
export const OBTENER_USUARIOS_GLOBALES = gql`
  query ObtenerUsuariosGlobales {
    obtenerUsuariosGlobales {
      id
      codigo
      nombre
    }
  }
`;
export const CREAR_USUARIO = gql`
  mutation CrearUsuario($input: CrearUsuarioInput!) {
    crearUsuario(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_USUARIO = gql`
  mutation ActualizarUsuario($input: ActualizarUsuarioInput!) {
    actualizarUsuario(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_USUARIO = gql`
  mutation EliminarUsuario($id: Int!) {
    eliminarUsuario(id: $id)
  }
`;

// ── UsuarioEmpresa ───────────────────────────────────────────────
export const GET_USUARIOEMPRESA_CURSOR = gql`
  query UsuarioEmpresasFiltradosCursor(
    $first: Int
    $after: String
    $orden: [String]
    $direccion: [String]
    $busqueda: String
  ) {
    usuarioEmpresasFiltradosCursor(
      first: $first
      after: $after
      orden: $orden
      direccion: $direccion
      busqueda: $busqueda
    ) {
      edges {
        node {
          id
          empresaId
          usuarioId
          rolId
          costoHora
          comisionEfectivo
          comisionTarjeta
          metaMensual
          version
          empresa {
            id
            nombre
          }
          usuario {
            id
            nombre
            codigo
          }
          rol {
            id
            nombre
          }
        }
        cursor
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;
export const CREAR_UE = gql`
  mutation CrearUsuarioEmpresa($input: UsuarioEmpresaInput!) {
    crearUsuarioEmpresa(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_UE = gql`
  mutation ActualizarUsuarioEmpresa($input: ActualizarUsuarioEmpresaInput!) {
    actualizarUsuarioEmpresa(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_UE = gql`
  mutation EliminarUsuarioEmpresa($id: Int!) {
    eliminarUsuarioEmpresa(id: $id)
  }
`;

// ── Catálogo ─────────────────────────────────────────────────────
export const GET_CATALOGOS_CURSOR = gql`
  query CatalogosFiltradosCursor(
    $first: Int
    $after: String
    $orden: [String]
    $direccion: [String]
    $busqueda: String
  ) {
    catalogosFiltradosCursor(
      first: $first
      after: $after
      orden: $orden
      direccion: $direccion
      busqueda: $busqueda
    ) {
      edges {
        node {
          id
          empresaId
          codigo
          nombre
          version
        }
        cursor
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;
export const OBTENER_CATALOGOS = gql`
  query ObtenerCatalogos {
    obtenerCatalogos {
      id
      codigo
      nombre
    }
  }
`;
export const CREAR_CATALOGO = gql`
  mutation CrearCatalogo($input: CatalogoInput!) {
    crearCatalogo(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_CATALOGO = gql`
  mutation ActualizarCatalogo($input: CatalogoUpdateInput!) {
    actualizarCatalogo(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_CATALOGO = gql`
  mutation EliminarCatalogo($id: Int!) {
    eliminarCatalogo(id: $id)
  }
`;

// ── SubCatálogo ──────────────────────────────────────────────────
export const GET_SUBCATALOGOS_CURSOR = gql`
  query SubcatalogosFiltradosCursor(
    $first: Int
    $after: String
    $orden: [String]
    $direccion: [String]
    $busqueda: String
  ) {
    subcatalogosFiltradosCursor(
      first: $first
      after: $after
      orden: $orden
      direccion: $direccion
      busqueda: $busqueda
    ) {
      edges {
        node {
          id
          catalogoId
          codigo
          nombre
          version
          catalogo {
            id
            codigo
            nombre
          }
        }
        cursor
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;
export const OBTENER_SUBCATALOGOS_POR_CATALOGO = gql`
  query ObtenerSubCatalogosPorCatalogo($catalogoId: Int!) {
    obtenerSubCatalogosPorCatalogo(catalogoId: $catalogoId) {
      id
      codigo
      nombre
    }
  }
`;
export const CREAR_SUBCATALOGO = gql`
  mutation CrearSubCatalogo($input: SubCatalogoInput!) {
    crearSubCatalogo(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_SUBCATALOGO = gql`
  mutation ActualizarSubCatalogo($input: SubCatalogoUpdateInput!) {
    actualizarSubCatalogo(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_SUBCATALOGO = gql`
  mutation EliminarSubCatalogo($id: Int!) {
    eliminarSubCatalogo(id: $id)
  }
`;

// ── Grupo ────────────────────────────────────────────────────────
export const GET_GRUPOS_CURSOR = gql`
  query GruposFiltradosCursor(
    $first: Int
    $after: String
    $orden: [String]
    $direccion: [String]
    $busqueda: String
  ) {
    gruposFiltradosCursor(
      first: $first
      after: $after
      orden: $orden
      direccion: $direccion
      busqueda: $busqueda
    ) {
      edges {
        node {
          id
          subcatalogoId
          codigo
          nombre
          version
          subcatalogo {
            id
            codigo
            nombre
            catalogo {
              codigo
              nombre
            }
          }
        }
        cursor
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;
export const CREAR_GRUPO = gql`
  mutation CrearGrupo($input: GrupoInput!) {
    crearGrupo(input: $input) {
      id
    }
  }
`;
export const ACTUALIZAR_GRUPO = gql`
  mutation ActualizarGrupo($input: GrupoUpdateInput!) {
    actualizarGrupo(input: $input) {
      id
    }
  }
`;
export const ELIMINAR_GRUPO = gql`
  mutation EliminarGrupo($id: Int!) {
    eliminarGrupo(id: $id)
  }
`;
