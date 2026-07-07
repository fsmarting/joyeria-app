import { useMemo } from 'react';
import EntidadGenerica from '../../components/EntidadGenerica.jsx';
import { camposCompraInsumo } from '../../data/camposCompraInsumo.jsx';
import {
  GET_COMPRAS_CURSOR,
  CREAR_COMPRA,
  ACTUALIZAR_COMPRA,
  ELIMINAR_COMPRA,
} from '../../graphql/compraInsumoQueries.js';

export default function CompraInsumo() {
  const empresaActual = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('empresa') || '{}'); }
    catch { return {}; }
  }, []);

  const valoresFijos = useMemo(() => ({
    empresaId: empresaActual.id,
    // fecha por defecto = hoy
    fecha: new Date().toISOString().split('T')[0],
  }), [empresaActual]);

  return (
    <EntidadGenerica
      tipoEntidad="comprainsumo"
      campos={camposCompraInsumo}
      titulo="Compras de Insumos"
      descripcion="Registro de cada lote comprado — oro, piedras y otros materiales. La cantidad disponible se actualiza automáticamente con cada orden de producción."
      textoBoton="Compra"
      queries={{
        GET:        GET_COMPRAS_CURSOR,
        CREAR:      CREAR_COMPRA,
        ACTUALIZAR: ACTUALIZAR_COMPRA,
        ELIMINAR:   ELIMINAR_COMPRA,
      }}
      fixedValues={valoresFijos}
    />
  );
}
