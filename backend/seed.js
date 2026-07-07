import { prisma } from './src/helpers/dbActions.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Iniciando seed JoyeriaApp con Tercero...');

  const empresa = await prisma.empresa.upsert({
    where: { codigo: 'RIORAYO' },
    update: {},
    create: { codigo: 'RIORAYO', nombre: 'Río Rayo' },
  });

  // ── CATÁLOGO GENERAL ─────────────────────────────────────────
  const catGral = await prisma.catalogo.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: 'GRAL' } },
    update: {}, create: { empresaId: empresa.id, codigo: 'GRAL', nombre: 'General' },
  });

  const subEst = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catGral.id, codigo: 'EST' } },
    update: {}, create: { catalogoId: catGral.id, codigo: 'EST', nombre: 'Estados' },
  });
  const subRol = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catGral.id, codigo: 'ROL' } },
    update: {}, create: { catalogoId: catGral.id, codigo: 'ROL', nombre: 'Roles' },
  });
  // Tipos de Tercero — el discriminador de la tabla Tercero
  const subTTRC = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catGral.id, codigo: 'TTRC' } },
    update: {}, create: { catalogoId: catGral.id, codigo: 'TTRC', nombre: 'Tipos de Tercero' },
  });
  // Tipos de Documento — opcional, para cuando necesiten factura
  const subTDOC = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catGral.id, codigo: 'TDOC' } },
    update: {}, create: { catalogoId: catGral.id, codigo: 'TDOC', nombre: 'Tipos de Documento' },
  });

  const estActivo = await prisma.grupo.upsert({
    where: { subcatalogoId_codigo: { subcatalogoId: subEst.id, codigo: 'ACT' } },
    update: {}, create: { subcatalogoId: subEst.id, codigo: 'ACT', nombre: 'Activo' },
  });
  const rolAdm = await prisma.grupo.upsert({
    where: { subcatalogoId_codigo: { subcatalogoId: subRol.id, codigo: 'ADM' } },
    update: {}, create: { subcatalogoId: subRol.id, codigo: 'ADM', nombre: 'Administradora' },
  });
  await prisma.grupo.upsert({
    where: { subcatalogoId_codigo: { subcatalogoId: subRol.id, codigo: 'VEN' } },
    update: {}, create: { subcatalogoId: subRol.id, codigo: 'VEN', nombre: 'Vendedora' },
  });

  // Tipos de tercero
  const tiposMap = {};
  for (const [codigo, nombre] of [
    ['CLIENTE','Cliente'],['PROVEEDOR','Proveedor'],
    ['JOYERO','Joyero'],['SOCIO','Socio'],
  ]) {
    tiposMap[codigo] = await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subTTRC.id, codigo } },
      update: {}, create: { subcatalogoId: subTTRC.id, codigo, nombre },
    });
  }

  // Tipos de documento (opcionales)
  for (const [codigo, nombre] of [
    ['CC','Cédula de Ciudadanía'],['NIT','NIT'],
    ['CE','Cédula de Extranjería'],['PAS','Pasaporte'],['TI','Tarjeta de Identidad'],
  ]) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subTDOC.id, codigo } },
      update: {}, create: { subcatalogoId: subTDOC.id, codigo, nombre },
    });
  }

  // ── CATÁLOGO PRODUCCIÓN ───────────────────────────────────────
  const catProd = await prisma.catalogo.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: 'PRODU' } },
    update: {}, create: { empresaId: empresa.id, codigo: 'PRODU', nombre: 'Producción' },
  });

  const subEOrd = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catProd.id, codigo: 'EORD' } }, update: {}, create: { catalogoId: catProd.id, codigo: 'EORD', nombre: 'Estados de Orden' } });
  const subCatP = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catProd.id, codigo: 'CATP' } }, update: {}, create: { catalogoId: catProd.id, codigo: 'CATP', nombre: 'Categoría Producto' } });
  const subTPie = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catProd.id, codigo: 'TPIE' } }, update: {}, create: { catalogoId: catProd.id, codigo: 'TPIE', nombre: 'Tipo Piedra' } });
  const subEspe = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catProd.id, codigo: 'ESPE' } }, update: {}, create: { catalogoId: catProd.id, codigo: 'ESPE', nombre: 'Especialidades Joyero' } });
  const subTipo = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catProd.id, codigo: 'TIPO' } }, update: {}, create: { catalogoId: catProd.id, codigo: 'TIPO', nombre: 'Tipos de Insumo' } });

  for (const [s, datos] of [
    [subEOrd,[['PEND','Pendiente'],['PROC','En proceso'],['ENTR','Entregada'],['CANC','Cancelada']]],
    [subCatP,[['ANI','Anillo'],['CAD','Cadena'],['ARE','Aretes'],['PUL','Pulsera'],['DIJ','Dije']]],
    [subTPie,[['DIAM','Diamante'],['ZAFI','Zafiro'],['CIRC','Circón'],['ESME','Esmeralda']]],
    [subEspe,[['VACI','Vaciado'],['ENGA','Engaste'],['PULI','Pulido'],['CADE','Cadenas'],['FILI','Filigrana'],['SOLD','Soldadura'],['BANO','Baño / Rodio'],['GRAB','Grabado']]],
    [subTipo,[['ORO','Oro'],['DIAM','Diamante'],['ESME','Esmeralda'],['ZAFI','Zafiro'],['RUBI','Rubí'],['CIRC','Circón'],['OTRO','Otros']]],
  ]) {
    for (const [codigo, nombre] of datos) {
      await prisma.grupo.upsert({ where: { subcatalogoId_codigo: { subcatalogoId: s.id, codigo } }, update: {}, create: { subcatalogoId: s.id, codigo, nombre } });
    }
  }

  // ── CATÁLOGO VENTAS ───────────────────────────────────────────
  const catVent = await prisma.catalogo.upsert({ where: { empresaId_codigo: { empresaId: empresa.id, codigo: 'VENT' } }, update: {}, create: { empresaId: empresa.id, codigo: 'VENT', nombre: 'Ventas' } });
  const subMPag = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catVent.id, codigo: 'MPAG' } }, update: {}, create: { catalogoId: catVent.id, codigo: 'MPAG', nombre: 'Medio de Pago' } });
  const subEVen = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catVent.id, codigo: 'ESTV' } }, update: {}, create: { catalogoId: catVent.id, codigo: 'ESTV', nombre: 'Estado Venta' } });
  for (const [s,datos] of [[subMPag,[['EFEC','Efectivo'],['TARJ','Tarjeta']]],[subEVen,[['CONF','Confirmada'],['ENPR','En proceso'],['ENTR','Entregada'],['ANUL','Anulada']]]]) {
    for (const [codigo, nombre] of datos) {
      await prisma.grupo.upsert({ where: { subcatalogoId_codigo: { subcatalogoId: s.id, codigo } }, update: {}, create: { subcatalogoId: s.id, codigo, nombre } });
    }
  }

  // ── CATÁLOGO CRM ──────────────────────────────────────────────
  const catCRM = await prisma.catalogo.upsert({ where: { empresaId_codigo: { empresaId: empresa.id, codigo: 'CRM' } }, update: {}, create: { empresaId: empresa.id, codigo: 'CRM', nombre: 'CRM' } });
  const subTier = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catCRM.id, codigo: 'TIER' } }, update: {}, create: { catalogoId: catCRM.id, codigo: 'TIER', nombre: 'Tier Clienta' } });
  const subCana = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catCRM.id, codigo: 'CANA' } }, update: {}, create: { catalogoId: catCRM.id, codigo: 'CANA', nombre: 'Canal' } });
  const subMoti = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catCRM.id, codigo: 'MOTI' } }, update: {}, create: { catalogoId: catCRM.id, codigo: 'MOTI', nombre: 'Motivo Pérdida' } });
  for (const [s,datos] of [[subTier,[['NUEV','Nueva'],['RECU','Recurrente'],['VIP','VIP']]],[subCana,[['INST','Instagram'],['WHAT','WhatsApp'],['REFE','Referido']]],[subMoti,[['SILE','Silencio'],['PREC','Precio'],['STOC','Sin stock']]]]) {
    for (const [codigo, nombre] of datos) {
      await prisma.grupo.upsert({ where: { subcatalogoId_codigo: { subcatalogoId: s.id, codigo } }, update: {}, create: { subcatalogoId: s.id, codigo, nombre } });
    }
  }

  // ── CATÁLOGO INVENTARIO ───────────────────────────────────────
  const catInv = await prisma.catalogo.upsert({ where: { empresaId_codigo: { empresaId: empresa.id, codigo: 'INV' } }, update: {}, create: { empresaId: empresa.id, codigo: 'INV', nombre: 'Inventarios' } });
  const subUnid = await prisma.subCatalogo.upsert({ where: { catalogoId_codigo: { catalogoId: catInv.id, codigo: 'UNID' } }, update: {}, create: { catalogoId: catInv.id, codigo: 'UNID', nombre: 'Unidades de Medida' } });
  for (const [codigo, nombre] of [['GR','Gramos'],['KG','Kilogramos'],['CT','Quilates'],['UND','Unidades'],['ML','Mililitros']]) {
    await prisma.grupo.upsert({ where: { subcatalogoId_codigo: { subcatalogoId: subUnid.id, codigo } }, update: {}, create: { subcatalogoId: subUnid.id, codigo, nombre } });
  }

  // ── USUARIO ADMIN ─────────────────────────────────────────────
  const hash = await bcrypt.hash('123456', 10);
  const admin = await prisma.usuario.upsert({
    where: { codigo: 'ADMIN' },
    update: {},
    create: { codigo: 'ADMIN', nombre: 'Administradora Río Rayo', password: hash, estadoId: estActivo.id },
  });
  await prisma.usuarioEmpresa.upsert({
    where: { empresaId_usuarioId: { empresaId: empresa.id, usuarioId: admin.id } },
    update: {},
    create: { empresaId: empresa.id, usuarioId: admin.id, rolId: rolAdm.id, comisionEfectivo: 20, comisionTarjeta: 13 },
  });

  // ── TERCEROS INICIALES ────────────────────────────────────────
  // Socias (tipo SOCIO)
  for (const [nombre, pct] of [['Laura', 50], ['Naty', 50]]) {
    const existe = await prisma.tercero.findFirst({ where: { empresaId: empresa.id, tipoId: tiposMap['SOCIO'].id, nombre, deletedAt: null } });
    if (!existe) await prisma.tercero.create({ data: { empresaId: empresa.id, tipoId: tiposMap['SOCIO'].id, nombre, porcentajeDefecto: pct } });
  }

  console.log('✅ Seed completado.');
  console.log('   ADMIN / 123456');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
