// `pdfmake` doesn't ship its own types, and the `@types/pdfmake` community
// package (last published for an older/browser API shape) doesn't match
// this repo's installed version — its singleton export with
// `setFonts`/`createPdf(...).getBuffer()` is verified directly from
// `node_modules/pdfmake/js/index.js` and `OutputDocument.js`, not the
// community types. Declared here instead, covering only what `lib/reports/pdf.ts`
// actually uses rather than the full document-definition schema.
declare module "pdfmake" {
  export interface PdfMakeFontDescriptor {
    normal: string;
    bold: string;
    italics: string;
    bolditalics: string;
  }

  export interface PdfMakeTableCell {
    text: string;
    style?: string;
  }

  export interface PdfMakeTableLayout {
    fillColor?: (rowIndex: number) => string | null;
    hLineWidth?: (i: number) => number;
    vLineWidth?: (i: number) => number;
    hLineColor?: (i: number) => string;
  }

  export interface PdfMakeContentItem {
    text?: string | PdfMakeTableCell[];
    style?: string;
    table?: {
      headerRows?: number;
      widths?: (string | number)[];
      body: (string | PdfMakeTableCell)[][];
    };
    layout?: PdfMakeTableLayout;
  }

  export interface PdfMakeDocDefinition {
    pageOrientation?: "portrait" | "landscape";
    pageMargins?: [number, number, number, number];
    defaultStyle?: { font?: string; fontSize?: number };
    content: PdfMakeContentItem[];
    styles?: Record<string, { fontSize?: number; bold?: boolean; color?: string; margin?: [number, number, number, number] }>;
  }

  export interface PdfMakeDocument {
    getBuffer(): Promise<Buffer>;
  }

  export interface PdfMake {
    setFonts(fonts: Record<string, PdfMakeFontDescriptor>): void;
    addFonts(fonts: Record<string, PdfMakeFontDescriptor>): void;
    createPdf(docDefinition: PdfMakeDocDefinition): PdfMakeDocument;
  }

  const pdfMake: PdfMake;
  export default pdfMake;
}
