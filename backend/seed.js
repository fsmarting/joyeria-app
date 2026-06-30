import { prisma } from "./src/helpers/dbActions.js";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Iniciando sembrado de datos (Seed) — JoyeriaApp...");

  // ===============================================================
  // 1. EMPRESA
  // ===============================================================
  console.log("🏢 Creando Empresa...");
  const empresa = await prisma.empresa.upsert({
    where: { codigo: "RIORAYO" },
    update: {},
    create: {
      codigo: "RIORAYO",
      nombre: "Río Rayo",
    },
  });

  // ===============================================================
  // 2. CATÁLOGO GENERAL — Estados y Roles
  // ===============================================================
  console.log("📚 Creando Catálogo General...");
  const catGeneral = await prisma.catalogo.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: "GRAL" } },
    update: {},
    create: { empresaId: empresa.id, codigo: "GRAL", nombre: "General" },
  });

  const subEst = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catGeneral.id, codigo: "EST" } },
    update: {},
    create: {
      catalogoId: catGeneral.id,
      codigo: "EST",
      nombre: "Estados Generales",
    },
  });

  const subRol = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catGeneral.id, codigo: "ROL" } },
    update: {},
    create: { catalogoId: catGeneral.id, codigo: "ROL", nombre: "Roles" },
  });

  const estActivo = await prisma.grupo.upsert({
    where: {
      subcatalogoId_codigo: { subcatalogoId: subEst.id, codigo: "ACT" },
    },
    update: {},
    create: { subcatalogoId: subEst.id, codigo: "ACT", nombre: "Activo" },
  });

  const rolAdm = await prisma.grupo.upsert({
    where: {
      subcatalogoId_codigo: { subcatalogoId: subRol.id, codigo: "ADM" },
    },
    update: {},
    create: {
      subcatalogoId: subRol.id,
      codigo: "ADM",
      nombre: "Administradora",
    },
  });

  const rolVend = await prisma.grupo.upsert({
    where: {
      subcatalogoId_codigo: { subcatalogoId: subRol.id, codigo: "VEN" },
    },
    update: {},
    create: { subcatalogoId: subRol.id, codigo: "VEN", nombre: "Vendedora" },
  });

  // ===============================================================
  // 3. CATÁLOGO PRODUCCIÓN — Estados de Orden y Etapas (joyero)
  // ===============================================================
  console.log("💍 Creando Catálogo de Producción...");
  const catProduccion = await prisma.catalogo.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: "PRODU" } },
    update: {},
    create: { empresaId: empresa.id, codigo: "PRODU", nombre: "Producción" },
  });

  const subEstOrden = await prisma.subCatalogo.upsert({
    where: {
      catalogoId_codigo: { catalogoId: catProduccion.id, codigo: "EORD" },
    },
    update: {},
    create: {
      catalogoId: catProduccion.id,
      codigo: "EORD",
      nombre: "Estados de Orden de Producción",
    },
  });

  const subEtapaNombre = await prisma.subCatalogo.upsert({
    where: {
      catalogoId_codigo: { catalogoId: catProduccion.id, codigo: "ETAP" },
    },
    update: {},
    create: {
      catalogoId: catProduccion.id,
      codigo: "ETAP",
      nombre: "Nombres de Etapa",
    },
  });

  const subEstEtapa = await prisma.subCatalogo.upsert({
    where: {
      catalogoId_codigo: { catalogoId: catProduccion.id, codigo: "EETA" },
    },
    update: {},
    create: {
      catalogoId: catProduccion.id,
      codigo: "EETA",
      nombre: "Estados de Etapa",
    },
  });

  const subCategoriaProd = await prisma.subCatalogo.upsert({
    where: {
      catalogoId_codigo: { catalogoId: catProduccion.id, codigo: "CATP" },
    },
    update: {},
    create: {
      catalogoId: catProduccion.id,
      codigo: "CATP",
      nombre: "Categoría de Producto",
    },
  });

  const subTipoPiedra = await prisma.subCatalogo.upsert({
    where: {
      catalogoId_codigo: { catalogoId: catProduccion.id, codigo: "TPIE" },
    },
    update: {},
    create: {
      catalogoId: catProduccion.id,
      codigo: "TPIE",
      nombre: "Tipo de Piedra",
    },
  });

  // Estados de OrdenProduccion
  const ordenEstados = [
    ["PEND", "Pendiente de envío"],
    ["PROC", "En proceso con joyero"],
    ["ENTR", "Entregada"],
    ["CANC", "Cancelada"],
  ];
  const gOrdenEstado = {};
  for (const [codigo, nombre] of ordenEstados) {
    gOrdenEstado[codigo] = await prisma.grupo.upsert({
      where: {
        subcatalogoId_codigo: { subcatalogoId: subEstOrden.id, codigo },
      },
      update: {},
      create: { subcatalogoId: subEstOrden.id, codigo, nombre },
    });
  }

  // Nombres de etapa (proceso típico visto en ORO CRISOBELA)
  const etapaNombres = [
    ["PURI", "Purificar"],
    ["VACI", "Vaciado"],
    ["ENGA", "Engaste"],
    ["PULI", "Pulido"],
  ];
  const gEtapaNombre = {};
  for (const [codigo, nombre] of etapaNombres) {
    gEtapaNombre[codigo] = await prisma.grupo.upsert({
      where: {
        subcatalogoId_codigo: { subcatalogoId: subEtapaNombre.id, codigo },
      },
      update: {},
      create: { subcatalogoId: subEtapaNombre.id, codigo, nombre },
    });
  }

  // Estados de etapa
  const etapaEstados = [
    ["PEND", "Pendiente"],
    ["PROC", "En proceso"],
    ["COMP", "Completada"],
  ];
  const gEtapaEstado = {};
  for (const [codigo, nombre] of etapaEstados) {
    gEtapaEstado[codigo] = await prisma.grupo.upsert({
      where: {
        subcatalogoId_codigo: { subcatalogoId: subEstEtapa.id, codigo },
      },
      update: {},
      create: { subcatalogoId: subEstEtapa.id, codigo, nombre },
    });
  }

  // Categorías de producto
  const categorias = [
    ["ANI", "Anillo"],
    ["CAD", "Cadena"],
    ["ARE", "Aretes"],
    ["PUL", "Pulsera"],
    ["DIJ", "Dije"],
  ];
  const gCategoria = {};
  for (const [codigo, nombre] of categorias) {
    gCategoria[codigo] = await prisma.grupo.upsert({
      where: {
        subcatalogoId_codigo: { subcatalogoId: subCategoriaProd.id, codigo },
      },
      update: {},
      create: { subcatalogoId: subCategoriaProd.id, codigo, nombre },
    });
  }

  // Tipos de piedra
  const tiposPiedra = [
    ["DIAM", "Diamante"],
    ["ZAFI", "Zafiro"],
    ["CIRC", "Circón"],
    ["ESME", "Esmeralda"],
  ];
  const gTipoPiedra = {};
  for (const [codigo, nombre] of tiposPiedra) {
    gTipoPiedra[codigo] = await prisma.grupo.upsert({
      where: {
        subcatalogoId_codigo: { subcatalogoId: subTipoPiedra.id, codigo },
      },
      update: {},
      create: { subcatalogoId: subTipoPiedra.id, codigo, nombre },
    });
  }

  // ===============================================================
  // 4. CATÁLOGO VENTAS — Medio de pago y Estado de Venta
  // ===============================================================
  console.log("💰 Creando Catálogo de Ventas...");
  const catVentas = await prisma.catalogo.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: "VENT" } },
    update: {},
    create: { empresaId: empresa.id, codigo: "VENT", nombre: "Ventas" },
  });

  const subMedioPago = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catVentas.id, codigo: "MPAG" } },
    update: {},
    create: {
      catalogoId: catVentas.id,
      codigo: "MPAG",
      nombre: "Medio de Pago",
    },
  });

  const subEstVenta = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catVentas.id, codigo: "ESTV" } },
    update: {},
    create: {
      catalogoId: catVentas.id,
      codigo: "ESTV",
      nombre: "Estado de Venta",
    },
  });

  // Medio de pago, con el % de comisión de referencia que usted describió
  // (20% efectivo, 13% tarjeta tras descontar el 7% del datafono)
  const gEfectivo = await prisma.grupo.upsert({
    where: {
      subcatalogoId_codigo: { subcatalogoId: subMedioPago.id, codigo: "EFEC" },
    },
    update: {},
    create: {
      subcatalogoId: subMedioPago.id,
      codigo: "EFEC",
      nombre: "Efectivo",
    },
  });

  const gTarjeta = await prisma.grupo.upsert({
    where: {
      subcatalogoId_codigo: { subcatalogoId: subMedioPago.id, codigo: "TARJ" },
    },
    update: {},
    create: {
      subcatalogoId: subMedioPago.id,
      codigo: "TARJ",
      nombre: "Tarjeta",
    },
  });

  const ventaEstados = [
    ["CONF", "Confirmada"],
    ["ANUL", "Anulada"],
  ];
  const gVentaEstado = {};
  for (const [codigo, nombre] of ventaEstados) {
    gVentaEstado[codigo] = await prisma.grupo.upsert({
      where: {
        subcatalogoId_codigo: { subcatalogoId: subEstVenta.id, codigo },
      },
      update: {},
      create: { subcatalogoId: subEstVenta.id, codigo, nombre },
    });
  }

  // ===============================================================
  // 5. CATÁLOGO CRM — Tier, Canal, Motivo de pérdida
  // ===============================================================
  console.log("💬 Creando Catálogo de CRM...");
  const catCRM = await prisma.catalogo.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: "CRM" } },
    update: {},
    create: { empresaId: empresa.id, codigo: "CRM", nombre: "CRM" },
  });

  const subTier = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catCRM.id, codigo: "TIER" } },
    update: {},
    create: {
      catalogoId: catCRM.id,
      codigo: "TIER",
      nombre: "Tier de Clienta",
    },
  });

  const subCanal = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catCRM.id, codigo: "CANA" } },
    update: {},
    create: {
      catalogoId: catCRM.id,
      codigo: "CANA",
      nombre: "Canal de Llegada",
    },
  });

  const subMotivo = await prisma.subCatalogo.upsert({
    where: { catalogoId_codigo: { catalogoId: catCRM.id, codigo: "MOTI" } },
    update: {},
    create: {
      catalogoId: catCRM.id,
      codigo: "MOTI",
      nombre: "Motivo de Pérdida",
    },
  });

  const tiers = [
    ["NUEV", "Nueva"],
    ["RECU", "Recurrente"],
    ["VIP", "VIP"],
  ];
  for (const [codigo, nombre] of tiers) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subTier.id, codigo } },
      update: {},
      create: { subcatalogoId: subTier.id, codigo, nombre },
    });
  }

  const canales = [
    ["INST", "Instagram"],
    ["WHAT", "WhatsApp"],
    ["REFE", "Referido"],
  ];
  for (const [codigo, nombre] of canales) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subCanal.id, codigo } },
      update: {},
      create: { subcatalogoId: subCanal.id, codigo, nombre },
    });
  }

  const motivos = [
    ["SILE", "Silencio"],
    ["PREC", "Precio"],
    ["STOC", "Sin stock"],
  ];
  for (const [codigo, nombre] of motivos) {
    await prisma.grupo.upsert({
      where: { subcatalogoId_codigo: { subcatalogoId: subMotivo.id, codigo } },
      update: {},
      create: { subcatalogoId: subMotivo.id, codigo, nombre },
    });
  }

  // ===============================================================
  // 6. USUARIO ADMINISTRADOR
  // ===============================================================
  console.log("👤 Creando Usuario administrador...");
  const passwordHash = await bcrypt.hash("123456", 10);

  await prisma.usuario.upsert({
    where: { empresaId_codigo: { empresaId: empresa.id, codigo: "ADMIN" } },
    update: {},
    create: {
      empresaId: empresa.id,
      codigo: "ADMIN",
      nombre: "Administradora Río Rayo",
      password: passwordHash,
      rolId: rolAdm.id,
      estadoId: estActivo.id,
    },
  });

  console.log("✅ Seed completado con éxito.");
  console.log(
    "   Usuario: ADMIN / Password: 123456 (cambiar en el primer login)",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
