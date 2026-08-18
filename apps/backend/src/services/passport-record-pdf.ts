import { PDFDocument, StandardFonts } from "pdf-lib";

// Renders an attested passport clinical record to a single-page PDF so it can be
// e-signed through the existing Documenso flow. Kept deliberately simple and
// kind-agnostic: the caller supplies the title + the label/value fields.
export type RecordPdfField = { label: string; value: string };

// The standard-14 fonts are encoded with WinAnsi (CP1252). pdf-lib throws
// `WinAnsi cannot encode "ā" (0x0101)` for anything outside it, and the values
// drawn here are free-text clinical data - pet names, manufacturers, lab names -
// so a single "ā", "ł", Cyrillic or emoji character would 500 the whole
// e-signature request and leave the record permanently un-attestable.
const WIN_ANSI_SPECIALS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/**
 * Latin letters that carry a stroke or bar rather than a combining accent.
 *
 * Unicode gives these no canonical decomposition, so NFD leaves them intact and
 * they would degrade to "?" despite having an obvious Latin base letter. Common
 * across Polish, Nordic, Croatian and Maltese pet, clinic and lab names.
 */
const LATIN_STROKE_FALLBACK: Record<string, string> = {
  Ł: "L",
  ł: "l",
  Đ: "D",
  đ: "d",
  Ħ: "H",
  ħ: "h",
  Ŧ: "T",
  ŧ: "t",
};

const isWinAnsiEncodable = (character: string): boolean => {
  const code = character.codePointAt(0) ?? 0;
  if (code >= 0x20 && code <= 0x7e) return true;
  if (code >= 0xa0 && code <= 0xff) return true;
  return WIN_ANSI_SPECIALS.has(character);
};

/**
 * Coerce a string into something the WinAnsi standard fonts can draw.
 *
 * Latin text with diacritics outside CP1252 is decomposed and stripped of its
 * combining marks, so "Bāsil" renders as "Basil" rather than throwing. Anything
 * with no Latin equivalent at all (Cyrillic, CJK, emoji) degrades to "?" - a
 * legible placeholder beats a 500 on a clinical signing request.
 *
 * Exported for unit testing.
 */
export const toWinAnsiSafe = (value: string): string => {
  let out = "";
  for (const character of value.normalize("NFC")) {
    if (character === "\n") {
      out += character;
      continue;
    }
    if (character === "\t" || character === "\r") {
      out += " ";
      continue;
    }
    if (isWinAnsiEncodable(character)) {
      out += character;
      continue;
    }
    const strokeFallback = LATIN_STROKE_FALLBACK[character];
    if (strokeFallback) {
      out += strokeFallback;
      continue;
    }
    const stripped = character.normalize("NFD").replace(/\p{M}/gu, "");
    // A character that is nothing but combining marks carries no base glyph,
    // so it is dropped rather than turned into a spurious "?".
    if (!stripped) continue;
    if ([...stripped].every(isWinAnsiEncodable)) {
      out += stripped;
      continue;
    }
    out += "?";
  }
  return out;
};

export const buildPassportRecordPdf = async (input: {
  title: string;
  subtitle?: string;
  fields: RecordPdfField[];
}): Promise<Buffer> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const left = 56;
  let y = 780;

  page.drawText(toWinAnsiSafe(input.title), {
    x: left,
    y,
    size: 18,
    font: bold,
  });
  y -= 24;
  if (input.subtitle) {
    page.drawText(toWinAnsiSafe(input.subtitle), {
      x: left,
      y,
      size: 11,
      font,
    });
    y -= 30;
  } else {
    y -= 14;
  }

  for (const field of input.fields) {
    if (y < 180) break;
    page.drawText(`${toWinAnsiSafe(field.label)}:`, {
      x: left,
      y,
      size: 11,
      font: bold,
    });
    page.drawText(toWinAnsiSafe(field.value), {
      x: left + 160,
      y,
      size: 11,
      font,
    });
    y -= 20;
  }

  page.drawText("Veterinarian signature:", {
    x: left,
    y: 140,
    size: 11,
    font: bold,
  });
  page.drawText(
    "Digital pet health record. Not a legal substitute for the official travel document.",
    { x: left, y: 56, size: 8, font },
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
};
