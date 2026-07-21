import { requireAuth } from "../utils/authHelpers.js";

export default {
  Query: {
    perfilClienta: async (_, { clienteId, empresaId }, { prisma, user }) => {
      requireAuth(user);

      const cliente = await prisma.tercero.findUnique({
        where: { id: Number(clienteId) },
      });
      if (!cliente) throw new Error("Clienta no existe");

      // ── Auto-enlazar conversaciones huérfanas por celular ──────
      // Si la conversación se registró antes de crear la clienta,
      // clienteId quedó null pero el teléfono coincide.
      // Al ver el perfil, las enlazamos permanentemente.
      if (cliente.telefono) {
        const telefonoLimpio = cliente.telefono.trim().replace(/\s/g, "");
        await prisma.conversacion.updateMany({
          where: {
            empresaId: Number(empresaId),
            deletedAt: null,
            clienteId: null,
            telefono: { contains: telefonoLimpio },
          },
          data: { clienteId: Number(clienteId) },
        });
      }

      // ── Ventas confirmadas ─────────────────────────────────────
      const ventas = await prisma.venta.findMany({
        where: {
          clienteId: Number(clienteId),
          empresaId: Number(empresaId),
          deletedAt: null,
        },
        include: { producto: true, medioPago: true, estado: true },
        orderBy: { fecha: "desc" },
      });
      const ventasActivas = ventas.filter((v) => v.estado?.codigo !== "ANUL");

      // ── Conversaciones — por clienteId O por teléfono ──────────
      const whereConv = {
        empresaId: Number(empresaId),
        deletedAt: null,
        OR: [
          { clienteId: Number(clienteId) },
          ...(cliente.telefono
            ? [
                {
                  telefono: {
                    contains: cliente.telefono.trim().replace(/\s/g, ""),
                  },
                },
              ]
            : []),
        ],
      };
      const conversaciones = await prisma.conversacion.findMany({
        where: whereConv,
        include: { canal: true },
        orderBy: { fecha: "desc" },
      });

      // ── Cotizaciones ───────────────────────────────────────────
      const cotizaciones = await prisma.cotizacion.findMany({
        where: {
          clienteId: Number(clienteId),
          empresaId: Number(empresaId),
          deletedAt: null,
        },
        include: { estado: true, items: { where: { deletedAt: null } } },
        orderBy: { fecha: "desc" },
      });

      const totalComprado = ventasActivas.reduce(
        (s, v) => s + Number(v.precioVenta),
        0,
      );
      const totalVentas = ventasActivas.length;
      const ticketPromedio =
        totalVentas > 0 ? Math.round(totalComprado / totalVentas) : 0;
      const ultimaCompra = ventasActivas[0]?.fecha
        ? new Date(ventasActivas[0].fecha).toISOString()
        : null;

      return {
        clienteId: Number(clienteId),
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        totalComprado,
        totalVentas,
        ticketPromedio,
        ultimaCompra,
        ventas: ventasActivas.map((v) => ({
          id: v.id,
          fecha: new Date(v.fecha).toISOString(),
          precioVenta: Number(v.precioVenta),
          producto: v.producto,
          medioPago: v.medioPago,
          estado: v.estado,
        })),
        conversaciones: conversaciones.map((c) => ({
          id: c.id,
          fecha: new Date(c.fecha).toISOString(),
          telefono: c.telefono,
          nombreContacto: c.nombreContacto,
          cotizo: c.cotizo,
          cerro: c.cerro,
          canal: c.canal,
        })),
        cotizaciones: cotizaciones.map((c) => ({
          id: c.id,
          numero: c.numero,
          fecha: new Date(c.fecha).toISOString(),
          total: c.items.reduce((s, i) => s + Number(i.subtotal), 0),
          estado: c.estado,
        })),
      };
    },
  },
};
