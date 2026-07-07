export function validarEmpresa(empresaIdRecord, empresaActualId) {
  if (Number(empresaIdRecord) !== Number(empresaActualId)) {
    throw new Error('No autorizado: este registro pertenece a otra empresa');
  }
}
