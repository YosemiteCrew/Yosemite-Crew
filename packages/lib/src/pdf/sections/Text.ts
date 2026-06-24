import type { PdfContext } from '../PdfContext.js';
import { ensureSpace } from '../Pagination.js';
import { PDF_COLORS, PDF_FONT_SIZES, PDF_SPACING } from '../layout.js';

export type ParagraphOptions = {
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineGap?: number;
  font?: 'regular' | 'bold' | 'italic';
};

type WrapResult = {
  lines: string[];
  lineHeight: number;
};

const normalizeText = (value: string): string => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

export const wrapText = (
  ctx: PdfContext,
  value: string,
  width: number,
  fontSize = ctx.theme.fontSizes.body
): string[] => {
  const document = ctx.document;
  document.fontSize(fontSize);

  const lines: string[] = [];
  const paragraphs = normalizeText(value).split('\n');

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }

    const words = trimmed.split(/\s+/u);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (document.widthOfString(candidate) <= width) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
      }

      if (document.widthOfString(word) <= width) {
        current = word;
        continue;
      }

      const chars = word.split('');
      let chunk = '';
      for (const char of chars) {
        const nextChunk = `${chunk}${char}`;
        if (document.widthOfString(nextChunk) <= width) {
          chunk = nextChunk;
        } else {
          if (chunk) {
            lines.push(chunk);
          }
          chunk = char;
        }
      }
      current = chunk;
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines.length ? lines : [''];
};

export const measureWrappedText = (
  ctx: PdfContext,
  value: string,
  width = ctx.contentWidth,
  options: Pick<ParagraphOptions, 'fontSize' | 'lineGap'> = {}
): WrapResult => {
  const fontSize = options.fontSize ?? ctx.theme.fontSizes.body;
  const lineGap = options.lineGap ?? 2;
  const lines = wrapText(ctx, value, width, fontSize);
  const lineHeight = Math.ceil(fontSize * 1.35 + lineGap);
  return { lines, lineHeight };
};

export const drawWrappedLines = (
  ctx: PdfContext,
  lines: string[],
  x: number,
  width: number,
  options: ParagraphOptions = {}
): number => {
  const document = ctx.document;
  const fontSize = options.fontSize ?? ctx.theme.fontSizes.body;
  const lineGap = options.lineGap ?? 2;
  const lineHeight = Math.ceil(fontSize * 1.35 + lineGap);
  const color = options.color ?? PDF_COLORS.text;
  const font = options.font ?? 'regular';
  let y = ctx.cursorY;

  document.save();
  document.font(ctx.theme.fonts[font]).fontSize(fontSize).fillColor(color);

  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    y = ctx.cursorY;
    document.text(line, x, y, {
      width,
      align: options.align ?? 'left',
      lineGap,
    });
    ctx.moveDown(lineHeight);
  }

  document.restore();
  return y + lines.length * lineHeight;
};

export const renderDocumentTitle = (ctx: PdfContext, title: string): void => {
  const fontSize = PDF_FONT_SIZES.title;
  const height = Math.ceil(fontSize * 1.35 + 2);
  ensureSpace(ctx, height);

  ctx.document
    .save()
    .font(ctx.theme.fonts.bold)
    .fontSize(fontSize)
    .fillColor(PDF_COLORS.text)
    .text(title, ctx.contentLeft, ctx.cursorY, {
      width: ctx.contentWidth,
      align: 'center',
    })
    .restore();

  ctx.moveDown(height + PDF_SPACING.itemGap);
};

export const renderSectionTitle = (ctx: PdfContext, title: string): void => {
  const fontSize = PDF_FONT_SIZES.sectionTitle;
  const height = Math.ceil(fontSize * 1.35 + 2);
  // Leading gap so each section heading has consistent breathing room above it,
  // regardless of whether the previous block was text, bullets or a table.
  ctx.moveDown(PDF_SPACING.paragraphGap);
  ensureSpace(ctx, height + 12);

  ctx.document
    .save()
    .font(ctx.theme.fonts.bold)
    .fontSize(fontSize)
    .fillColor(PDF_COLORS.text)
    .text(title, ctx.contentLeft, ctx.cursorY, {
      width: ctx.contentWidth,
    });

  const lineY = ctx.cursorY + height + 3;
  ctx.document
    .moveTo(ctx.contentLeft, lineY)
    .lineTo(ctx.contentRight, lineY)
    .lineWidth(0.75)
    .strokeColor(PDF_COLORS.border)
    .stroke();

  ctx.document.restore();
  ctx.moveDown(height + 12);
};

export const renderSubTitle = (ctx: PdfContext, title: string): void => {
  const fontSize = ctx.theme.fontSizes.small;
  const height = Math.ceil(fontSize * 1.25 + 2);
  ensureSpace(ctx, height);

  ctx.document
    .save()
    .font(ctx.theme.fonts.italic)
    .fontSize(fontSize)
    .fillColor(PDF_COLORS.muted)
    .text(title, ctx.contentLeft, ctx.cursorY, {
      width: ctx.contentWidth,
    })
    .restore();

  ctx.moveDown(height);
};

export const renderParagraph = (
  ctx: PdfContext,
  text: string,
  options: ParagraphOptions = {}
): void => {
  const width = ctx.contentWidth;
  const fontSize = options.fontSize ?? ctx.theme.fontSizes.body;
  const { lines, lineHeight } = measureWrappedText(ctx, text, width, {
    fontSize,
    lineGap: options.lineGap,
  });

  ctx.document
    .save()
    .font(ctx.theme.fonts[options.font ?? 'regular'])
    .fontSize(fontSize)
    .fillColor(options.color ?? PDF_COLORS.text);

  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    ctx.document.text(line, ctx.contentLeft, ctx.cursorY, {
      width,
      align: options.align ?? 'left',
      lineGap: options.lineGap ?? 2,
    });
    ctx.moveDown(lineHeight);
  }

  ctx.document.restore();
};

export const renderSpacer = (ctx: PdfContext, height: number): void => {
  if (height <= 0) {
    return;
  }

  ensureSpace(ctx, height);
  ctx.moveDown(height);
};

export const renderDivider = (ctx: PdfContext, marginY = 0): void => {
  const y = ctx.cursorY + marginY;
  ensureSpace(ctx, marginY + 4);

  ctx.document
    .save()
    .moveTo(ctx.contentLeft, y)
    .lineTo(ctx.contentRight, y)
    .lineWidth(0.75)
    .strokeColor(PDF_COLORS.border)
    .stroke()
    .restore();

  ctx.moveDown(marginY + 6);
};
