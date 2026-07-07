import { useMemo } from 'react';
import EntidadGenerica from '../../components/EntidadGenerica.jsx';
import { camposPiedra } from '../../data/camposPiedra.jsx';
import {
  GET_PIEDRAS_CURSOR,
  CREAR_PIEDRA,
  ACTUALIZAR_PIEDRA,
  ELIMINAR_PIEDRA,
} from '../../graphql/piedraQueries.js';

export default function Piedra() {
  const empresaActual = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('empresa') || '{}'); }
    catch { return {}; }
  }, []);

  const valoresFijos = useMemo(() => ({
    empresaId: empresaActual.id,
  }), [empresaActual]);

  return (
    <EntidadGenerica
      tipoEntidad="piedra"
      campos={camposPiedra}
      titulo="Insumos"
      descripcion="Catálogo de insumos: oro, diamantes, piedras y otros materiales"
      textoBoton="Insumo"
      queries={{
        GET:        GET_PIEDRAS_CURSOR,
        CREAR:      CREAR_PIEDRA,
        ACTUALIZAR: ACTUALIZAR_PIEDRA,
        ELIMINAR:   ELIMINAR_PIEDRA,
      }}
      fixedValues={valoresFijos}
    />
  );
}
