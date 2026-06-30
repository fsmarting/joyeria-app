import { prisma } from './src/helpers/dbActions.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Iniciando sembrado de datos (Seed) — JoyeriaApp...');

  // ===============================================================
  // 1. EMPRESA
  // ===============================================================
  console.log('🏢 Creando Empresa...');
  const empresa = await prisma.empresa.upsert({
    where: { codigo: 'RIORAYO' },
    update: {},
    create: { codigo: 'RIORAYO', nombre: 'Río Rayo' },
  });

  // ===============================================================
  // 2. CATÁLOGO GENERAL — Estados y Roles
  // ===============================================================
  console.log('📚 Creando Catálogo General...');
  const catGeneral = await prisma.catalogo.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: 'GRAL' } },
    update: {},
    create: { empresaId: empresa.id, codigo: 'GRAL', nombre: 'General' },
  });

  const subEst = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catGeneral.id, codigo: 'EST' } },
    update: {},
    create: { catalogoId: catGeneral.id, codigo: 'EST', nombre: 'Estados Generales' },
  });

  const subRol = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catGeneral.id, codigo: 'ROL' } },
    update: {},
    create: { catalogoId: catGeneral.id, codigo: 'ROL', nombre: 'Roles' },
  });

  const estActivo = await prisma.grupo.upsert({
    where: { subcatalogoId_codigo: { subcatalogoId: subEst.id, codigo: 'ACT' } },
    update: {},
    create: { subcatalogoId: subEst.id, codigo: 'ACT', nombre: 'Activo' },
  });

  const rolAdm = await prisma.grupo.upsert({
    where: { subcatalogoId_codigo: { subcatalogoId: subRol.id, codigo: 'ADM' } },
    update: {},
    create: { subcatalogoId: subRol.id, codigo: 'ADM', nombre: 'Administradora' },
  });

  await prisma.grupo.upsert({
    where: { subcatalogoId_codigo: { subcatalogoId: subRol.id, codigo: 'VEN' } },
    update: {},
    create: { subcatalogoId: subRol.id, codigo: 'VEN', nombre: 'Vendedora' },
  });

  // ===============================================================
  // 3. CATÁLOGO PRODUCCIÓN
  // ===============================================================
  console.log('💍 Creando Catálogo de Producción...');
  const catProduccion = await prisma.catalogo.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: 'PRODU' } },
    update: {},
    create: { empresaId: empresa.id, codigo: 'PRODU', nombre: 'Producción' },
  });

  const subEstOrden = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catProduccion.id, codigo: 'EORD' } },
    update: {},
    create: { catalogoId: catProduccion.id, codigo: 'EORD', nombre: 'Estados de Orden de Producción' },
  });

  const subEtapaNombre = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catProduccion.id, codigo: 'ETAP' } },
    update: {},
    create: { catalogoId: catProduccion.id, codigo: 'ETAP', nombre: 'Nombres de Etapa' },
  });

  const subEstEtapa = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catProduccion.id, codigo: 'EETA' } },
    update: {},
    create: { catalogoId: catProduccion.id, codigo: 'EETA', nombre: 'Estados de Etapa' },
  });

  const subCategoriaProd = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catProduccion.id, codigo: 'CATP' } },
    update: {},
    create: { catalogoId: catProduccion.id, codigo: 'CATP', nombre: 'Categoría de Producto' },
  });

  const subTipoPiedra = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catProduccion.id, codigo: 'TPIE' } },
    update: {},
    create: { catalogoId: catProduccion.id, codigo: 'TPIE', nombre: 'Tipo de Piedra' },
  });

  for (const [codigo, nombre] of [
    ['PEND','Pendiente de envío'], ['PROC','En proceso con joyero'],
    ['ENTR','Entregada'],          ['CANC','Cancelada'],
  ]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subEstOrden.id, codigo } },
      update: {}, create: { subcatalogoId: subEstOrden.id, codigo, nombre },
    });
  }

  for (const [codigo, nombre] of [
    ['PURI','Purificar'], ['VACI','Vaciado'],
    ['ENGA','Engaste'],   ['PULI','Pulido'],
  ]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subEtapaNombre.id, codigo } },
      update: {}, create: { subcatalogoId: subEtapaNombre.id, codigo, nombre },
    });
  }

  for (const [codigo, nombre] of [
    ['PEND','Pendiente'], ['PROC','En proceso'], ['COMP','Completada'],
  ]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subEstEtapa.id, codigo } },
      update: {}, create: { subcatalogoId: subEstEtapa.id, codigo, nombre },
    });
  }

  for (const [codigo, nombre] of [
    ['ANI','Anillo'], ['CAD','Cadena'], ['ARE','Aretes'],
    ['PUL','Pulsera'], ['DIJ','Dije'],
  ]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subCategoriaProd.id, codigo } },
      update: {}, create: { subcatalogoId: subCategoriaProd.id, codigo, nombre },
    });
  }

  for (const [codigo, nombre] of [
    ['DIAM','Diamante'], ['ZAFI','Zafiro'],
    ['CIRC','Circón'],   ['ESME','Esmeralda'],
  ]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subTipoPiedra.id, codigo } },
      update: {}, create: { subcatalogoId: subTipoPiedra.id, codigo, nombre },
    });
  }

  // ===============================================================
  // 4. CATÁLOGO VENTAS
  // ===============================================================
  console.log('💰 Creando Catálogo de Ventas...');
  const catVentas = await prisma.catalogo.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: 'VENT' } },
    update: {},
    create: { empresaId: empresa.id, codigo: 'VENT', nombre: 'Ventas' },
  });

  const subMedioPago = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catVentas.id, codigo: 'MPAG' } },
    update: {},
    create: { catalogoId: catVentas.id, codigo: 'MPAG', nombre: 'Medio de Pago' },
  });

  const subEstVenta = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catVentas.id, codigo: 'ESTV' } },
    update: {},
    create: { catalogoId: catVentas.id, codigo: 'ESTV', nombre: 'Estado de Venta' },
  });

  for (const [codigo, nombre] of [['EFEC','Efectivo'], ['TARJ','Tarjeta']]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subMedioPago.id, codigo } },
      update: {}, create: { subcatalogoId: subMedioPago.id, codigo, nombre },
    });
  }

  for (const [codigo, nombre] of [['CONF','Confirmada'], ['ANUL','Anulada']]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subEstVenta.id, codigo } },
      update: {}, create: { subcatalogoId: subEstVenta.id, codigo, nombre },
    });
  }

  // ===============================================================
  // 5. CATÁLOGO CRM
  // ===============================================================
  console.log('💬 Creando Catálogo de CRM...');
  const catCRM = await prisma.catalogo.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: 'CRM' } },
    update: {},
    create: { empresaId: empresa.id, codigo: 'CRM', nombre: 'CRM' },
  });

  const subTier = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catCRM.id, codigo: 'TIER' } },
    update: {},
    create: { catalogoId: catCRM.id, codigo: 'TIER', nombre: 'Tier de Clienta' },
  });

  const subCanal = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catCRM.id, codigo: 'CANA' } },
    update: {},
    create: { catalogoId: catCRM.id, codigo: 'CANA', nombre: 'Canal de Llegada' },
  });

  const subMotivo = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catCRM.id, codigo: 'MOTI' } },
    update: {},
    create: { catalogoId: catCRM.id, codigo: 'MOTI', nombre: 'Motivo de Pérdida' },
  });

  for (const [codigo, nombre] of [
    ['NUEV','Nueva'], ['RECU','Recurrente'], ['VIP','VIP'],
  ]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subTier.id, codigo } },
      update: {}, create: { subcatalogoId: subTier.id, codigo, nombre },
    });
  }

  for (const [codigo, nombre] of [
    ['INST','Instagram'], ['WHAT','WhatsApp'], ['REFE','Referido'],
  ]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subCanal.id, codigo } },
      update: {}, create: { subcatalogoId: subCanal.id, codigo, nombre },
    });
  }

  for (const [codigo, nombre] of [
    ['SILE','Silencio'], ['PREC','Precio'], ['STOC','Sin stock'],
  ]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subMotivo.id, codigo } },
      update: {}, create: { subcatalogoId: subMotivo.id, codigo, nombre },
    });
  }

  // ===============================================================
  // 6. USUARIO — código único global, sin empresaId directo
  // ===============================================================
  console.log('👤 Creando Usuario administrador...');
  const passwordHash = await bcrypt.hash('123456', 10);

  const adminUser = await prisma.usuario.upsert({
    where:  { codigo: 'ADMIN' },
    update: {},
    create: {
      codigo:       'ADMIN',
      nombre:       'Administradora Río Rayo',
      password:     passwordHash,
      foto:         '',
      estadoId:     estActivo.id,
      ultimo_login: new Date(),
    },
  });

  // ===============================================================
  // 7. USUARIOEMPRESA — asigna ADMIN a Río Rayo con rol ADM
  // comisionEfectivo: 20%, comisionTarjeta: 13% (valores reales de Río Rayo)
  // ===============================================================
  console.log('🔗 Asignando usuario a empresa...');
  await prisma.usuarioEmpresa.upsert({
    where: { empresaId_usuarioId: { empresaId: empresa.id, usuarioId: adminUser.id } },
    update: {},
    create: {
      empresaId:         empresa.id,
      usuarioId:         adminUser.id,
      rolId:             rolAdm.id,
      comisionEfectivo:  20,
      comisionTarjeta:   13,
      metaMensual:       0,
    },
  });

  console.log('✅ Seed completado con éxito.');
  console.log('   Usuario: ADMIN / Password: 123456 (cambiar en el primer login)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
