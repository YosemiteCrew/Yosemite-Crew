import fs from 'node:fs';
import path from 'node:path';
import type { PdfDocumentInstance } from './PdfContext.js';

export type PdfFontFamilies = {
  regular: string;
  bold: string;
  italic: string;
};

const SATOSHI_RELATIVE_CANDIDATES = [
  path.join('apps', 'frontend', 'public', 'fonts', 'satoshi-font'),
  path.join('packages', '..', 'apps', 'frontend', 'public', 'fonts', 'satoshi-font'),
];

const SATOSHI_FILES = {
  regular: 'Satoshi-Regular.ttf',
  bold: 'Satoshi-Bold.ttf',
  italic: 'Satoshi-Italic.ttf',
} as const;

const collectCandidateRoots = (): string[] => {
  const roots = new Set<string>();
  const cwd = process.cwd();
  let current = cwd;

  for (let index = 0; index < 6; index += 1) {
    roots.add(current);
    current = path.dirname(current);
  }

  return [...roots];
};

const resolveExistingFontPath = (fontFile: string): string | null => {
  const candidateRoots = collectCandidateRoots();

  for (const root of candidateRoots) {
    for (const relative of SATOSHI_RELATIVE_CANDIDATES) {
      const candidate = path.resolve(root, relative, fontFile);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

export const registerPdfFonts = (document: PdfDocumentInstance): PdfFontFamilies => {
  if (typeof (document as PDFDocumentWithRegisterFont).registerFont !== 'function') {
    return {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
      italic: 'Helvetica-Oblique',
    };
  }

  const regular = resolveExistingFontPath(SATOSHI_FILES.regular);
  const bold = resolveExistingFontPath(SATOSHI_FILES.bold);
  const italic = resolveExistingFontPath(SATOSHI_FILES.italic);

  if (regular) {
    document.registerFont('Satoshi-Regular', regular);
  }
  if (bold) {
    document.registerFont('Satoshi-Bold', bold);
  }
  if (italic) {
    document.registerFont('Satoshi-Italic', italic);
  }

  if (regular) {
    return {
      regular: 'Satoshi-Regular',
      bold: bold ? 'Satoshi-Bold' : 'Satoshi-Regular',
      italic: italic ? 'Satoshi-Italic' : 'Satoshi-Regular',
    };
  }

  return {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
  };
};

type PDFDocumentWithRegisterFont = PdfDocumentInstance & {
  registerFont: (name: string, src: string) => PdfDocumentInstance;
};
