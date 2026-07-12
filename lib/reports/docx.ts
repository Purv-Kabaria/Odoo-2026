import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { ReportColumn } from "@/lib/reports/csv";

function headerCell(text: string): TableCell {
  return new TableCell({
    shading: { fill: "F1F0FB" },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
  });
}

function dataCell(value: unknown): TableCell {
  const text = value === null || value === undefined ? "" : String(value);
  return new TableCell({ children: [new Paragraph(text)] });
}

export async function rowsToDocx(
  title: string,
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map((col) => headerCell(col.label)),
  });
  const dataRows = rows.map(
    (row) => new TableRow({ children: columns.map((col) => dataCell(row[col.key])) }),
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Generated ${new Date().toLocaleDateString()} — ${rows.length} rows`,
                color: "6B6680",
                size: 18,
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
