import { useMemo } from 'react';
import EntidadGenerica from '../../components/EntidadGenerica.jsx';
import { camposMetaMensual } from '../../data/camposMetaMensual.jsx';
import { GET_METAS_CURSOR, CREAR_META, ACTUALIZAR_META, ELIMINAR_META } from '../../graphql/metaMensualQueries.js';

export default function MetaMensual() {
  const empresaActual = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('empresa') || '{}'); } catch { return {}; }
  }, []);

  return (
    <EntidadGenerica
      tipoEntidad="metamensual"
      campos={camposMetaMensual}
      titulo="Metas Mensuales"
      descripcion="Defina las metas de ingresos y ventas por mes — el Dashboard las usa para calcular el % de cumplimiento"
      textoBoton="Meta"
      queries={{ GET: GET_METAS_CURSOR, CREAR: CREAR_META, ACTUALIZAR: ACTUALIZAR_META, ELIMINAR: ELIMINAR_META }}
      fixedValues={{ empresaId: empresaActual.id }}
    />
  );
}
