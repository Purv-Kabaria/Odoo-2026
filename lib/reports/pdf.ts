import pdfMake from "pdfmake";
import type { PdfMakeContentItem } from "pdfmake";

import type { ReportColumn } from "@/lib/reports/csv";

// pdfmake needs a font descriptor even for PDFKit's built-in standard-14
// fonts — passing the standard font names as the "file path" is the
// documented way to use them without bundling any .ttf/.afm files.
pdfMake.setFonts({
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
});

export async function rowsToPdf(
  title: string,
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const body: (string | { text: string; style?: string })[][] = [
    columns.map((col) => ({ text: col.label, style: "tableHeader" })),
  ];
  for (const row of rows) {
    body.push(columns.map((col) => stringifyCell(row[col.key])));
  }

  const content: PdfMakeContentItem[] = [
    { text: title, style: "title" },
    { text: `Generated ${new Date().toLocaleDateString()} — ${rows.length} rows`, style: "subtitle" },
    {
      table: {
        headerRows: 1,
        widths: columns.map(() => "*"),
        body,
      },
      layout: {
        fillColor: (rowIndex) => (rowIndex === 0 ? "#f1f0fb" : rowIndex % 2 === 0 ? "#fafafc" : null),
        hLineWidth: () => 0.5,
        vLineWidth: () => 0,
        hLineColor: () => "#e7e5f0",
      },
    },
  ];

  const pdfDoc = pdfMake.createPdf({
    pageOrientation: columns.length > 4 ? "landscape" : "portrait",
    pageMargins: [32, 48, 32, 32],
    defaultStyle: { font: "Helvetica", fontSize: 9 },
    content,
    styles: {
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 2] },
      subtitle: { fontSize: 9, color: "#6b6680", margin: [0, 0, 0, 12] },
      tableHeader: { fontSize: 9, bold: true },
    },
  });

  return pdfDoc.getBuffer();
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}
