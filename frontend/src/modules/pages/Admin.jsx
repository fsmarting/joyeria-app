import { useMemo } from 'react';
import EntidadGenerica from '../../components/EntidadGenerica.jsx';
import {
  camposEmpresa, camposUsuario, camposUsuarioEmpresa,
  camposCatalogo, camposSubCatalogo, camposGrupo,
} from '../../data/camposAdmin.jsx';
import {
  GET_EMPRESAS_CURSOR,  CREAR_EMPRESA,  ACTUALIZAR_EMPRESA,  ELIMINAR_EMPRESA,
  GET_USUARIOS_CURSOR,  CREAR_USUARIO,  ACTUALIZAR_USUARIO,  ELIMINAR_USUARIO,
  GET_USUARIOEMPRESA_CURSOR, CREAR_UE,  ACTUALIZAR_UE,       ELIMINAR_UE,
  GET_CATALOGOS_CURSOR, CREAR_CATALOGO, ACTUALIZAR_CATALOGO, ELIMINAR_CATALOGO,
  GET_SUBCATALOGOS_CURSOR, CREAR_SUBCATALOGO, ACTUALIZAR_SUBCATALOGO, ELIMINAR_SUBCATALOGO,
  GET_GRUPOS_CURSOR,    CREAR_GRUPO,    ACTUALIZAR_GRUPO,    ELIMINAR_GRUPO,
} from '../../graphql/adminQueries.js';

// Thin wrapper genérico para módulos admin
function ModuloAdmin({ tipoEntidad, campos, titulo, descripcion, textoBoton, queries, fixedValues={} }) {
  return (
    <EntidadGenerica
      tipoEntidad={tipoEntidad} campos={campos}
      titulo={titulo} descripcion={descripcion} textoBoton={textoBoton}
      queries={queries} fixedValues={fixedValues}
    />
  );
}

export function Empresas() {
  return <ModuloAdmin
    tipoEntidad="empresa" campos={camposEmpresa}
    titulo="Empresas" descripcion="Gestión de empresas del sistema" textoBoton="Empresa"
    queries={{ GET: GET_EMPRESAS_CURSOR, CREAR: CREAR_EMPRESA, ACTUALIZAR: ACTUALIZAR_EMPRESA, ELIMINAR: ELIMINAR_EMPRESA }}
  />;
}

export function Usuarios() {
  return <ModuloAdmin
    tipoEntidad="usuario" campos={camposUsuario}
    titulo="Usuarios" descripcion="Gestión de usuarios del sistema" textoBoton="Usuario"
    queries={{ GET: GET_USUARIOS_CURSOR, CREAR: CREAR_USUARIO, ACTUALIZAR: ACTUALIZAR_USUARIO, ELIMINAR: ELIMINAR_USUARIO }}
  />;
}

export function UsuariosEmpresas() {
  return <ModuloAdmin
    tipoEntidad="usuarioempresa" campos={camposUsuarioEmpresa}
    titulo="Asignación de Usuarios" descripcion="Asignar usuarios a empresas con rol y comisiones" textoBoton="Asignación"
    queries={{ GET: GET_USUARIOEMPRESA_CURSOR, CREAR: CREAR_UE, ACTUALIZAR: ACTUALIZAR_UE, ELIMINAR: ELIMINAR_UE }}
  />;
}

export function Catalogos() {
  const empresaActual = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('empresa') || '{}'); } catch { return {}; }
  }, []);
  return <ModuloAdmin
    tipoEntidad="catalogo" campos={camposCatalogo}
    titulo="Catálogos" descripcion="Agrupaciones de configuración del sistema" textoBoton="Catálogo"
    queries={{ GET: GET_CATALOGOS_CURSOR, CREAR: CREAR_CATALOGO, ACTUALIZAR: ACTUALIZAR_CATALOGO, ELIMINAR: ELIMINAR_CATALOGO }}
    fixedValues={{ empresaId: empresaActual.id, empresa: { id: empresaActual.id, codigo: empresaActual.codigo, nombre: empresaActual.nombre } }}
  />;
}

export function SubCatalogos() {
  return <ModuloAdmin
    tipoEntidad="subcatalogo" campos={camposSubCatalogo}
    titulo="SubCatálogos" descripcion="Subcategorías dentro de cada catálogo" textoBoton="SubCatálogo"
    queries={{ GET: GET_SUBCATALOGOS_CURSOR, CREAR: CREAR_SUBCATALOGO, ACTUALIZAR: ACTUALIZAR_SUBCATALOGO, ELIMINAR: ELIMINAR_SUBCATALOGO }}
  />;
}

export function Grupos() {
  return <ModuloAdmin
    tipoEntidad="grupo" campos={camposGrupo}
    titulo="Grupos / Opciones" descripcion="Opciones dentro de cada subcatálogo — estados, tipos, roles, etc." textoBoton="Grupo"
    queries={{ GET: GET_GRUPOS_CURSOR, CREAR: CREAR_GRUPO, ACTUALIZAR: ACTUALIZAR_GRUPO, ELIMINAR: ELIMINAR_GRUPO }}
  />;
}
