import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GOLD = [184, 134, 11];
const DARK = [44, 44, 42];
const GRAY = [245, 245, 240];
const WHITE = [255, 255, 255];

const fmt = (n) =>
  `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`;

const fmtF = (s) => {
  if (!s) return "";
  const d = new Date(s);
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
};

export function generarPdfCotizacion(cotizacion) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const mL = 20,
    mR = 20;
  let y = 0;

  // ── Encabezado dorado ─────────────────────────────────
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 40, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Rio Rayo", mL, 17);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Joyeria artesanal · Oro trazable · Medellin", mL, 25);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(cotizacion.numero, W - mR, 16, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("COTIZACION", W - mR, 22, { align: "right" });

  y = 50;

  // ── Para ─────────────────────────────────────────────
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PARA:", mL, y);
  doc.setFont("helvetica", "normal");

  const nombre = cotizacion.cliente?.nombre ?? "Sin nombre";
  const tel = cotizacion.cliente?.telefono ?? "";
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(nombre, mL + 14, y);
  y += 6;
  if (tel) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Tel: ${tel}`, mL + 14, y);
    doc.setTextColor(...DARK);
    y += 5;
  }

  // Fechas derecha
  const fechaEmision = fmtF(cotizacion.fecha);
  const fechaVence = (() => {
    const d = new Date(cotizacion.fecha);
    d.setDate(d.getDate() + (cotizacion.validezDias ?? 15));
    return fmtF(d.toISOString());
  })();

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text(`Fecha de emision:  ${fechaEmision}`, W - mR, 50, {
    align: "right",
  });
  doc.text(`Valida hasta:      ${fechaVence}`, W - mR, 57, { align: "right" });
  if (cotizacion.vendedora?.nombre) {
    doc.text(`Atendida por:      ${cotizacion.vendedora.nombre}`, W - mR, 64, {
      align: "right",
    });
  }

  y = Math.max(y, 72) + 4;

  // ── Línea dorada ─────────────────────────────────────
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(mL, y, W - mR, y);
  y += 8;

  // ── Tabla de productos ────────────────────────────────
  const items = cotizacion.items || [];
  const rows = items.map((i) => [
    i.producto?.referencia ?? "",
    i.producto?.nombre ?? "",
    String(i.cantidad),
    fmt(i.precioUnitario),
    fmt(i.subtotal),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Ref.", "Producto", "Cant.", "Precio unitario", "Subtotal"]],
    body: rows,
    theme: "grid",
    margin: { left: mL, right: mR },
    headStyles: {
      fillColor: GOLD,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 34, halign: "right" },
      4: { cellWidth: 34, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: GRAY },
    bodyStyles: { textColor: DARK, fontSize: 9 },
  });

  y = doc.lastAutoTable.finalY + 4;

  // ── Total ─────────────────────────────────────────────
  const total = items.reduce((s, i) => s + Number(i.subtotal), 0);
  const bW = 75,
    bH = 10;

  doc.setFillColor(...DARK);
  doc.rect(W - mR - bW, y, bW, bH, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL", W - mR - bW + 12, y + 6.5);
  doc.text(fmt(total), W - mR - 3, y + 6.5, { align: "right" });

  y += 18;

  // ── Nota ──────────────────────────────────────────────
  if (cotizacion.nota) {
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(`Nota: ${cotizacion.nota}`, mL, y);
    y += 8;
  }

  // ── Condiciones ───────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(130, 130, 130);
  [
    `· Precios en pesos colombianos (COP). Valida por ${cotizacion.validezDias ?? 15} dias a partir de la fecha de emision.`,
    "· Incluye empaque especial Rio Rayo.",
    "· Sujeto a disponibilidad de stock al momento de la confirmacion.",
  ].forEach((c) => {
    doc.text(c, mL, y);
    y += 4.5;
  });

  // ── Pie dorado ────────────────────────────────────────
  doc.setFillColor(...GOLD);
  doc.rect(0, H - 16, W, 16, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Rio Rayo · Joyeria artesanal · Medellin", W / 2, H - 6, {
    align: "center",
  });

  doc.save(`${cotizacion.numero}.pdf`);
}
