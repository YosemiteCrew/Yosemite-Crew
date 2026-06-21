import type { PdfContext } from '../PdfContext.js';
import { renderBulletList } from './BulletList.js';
import { renderParagraph } from './Text.js';

const BLOCK_BREAK_TAGS = new Set(['br', 'p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const OPENING_BREAK_TAGS = new Set(['ul', 'ol']);
const OPENING_STRIP_TAGS = new Set(['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const ENTITY_MAP = new Map([
  ['&nbsp;', ' '],
  ['&amp;', '&'],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
]);

const isAsciiLetter = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
};

const isTagNameChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return isAsciiLetter(char) || (code >= 48 && code <= 57);
};

const readHtmlTag = (
  value: string,
  startIndex: number
): { closing: boolean; name: string; endIndex: number } | null => {
  if (value[startIndex] !== '<') {
    return null;
  }

  let index = startIndex + 1;
  if (index >= value.length) {
    return null;
  }

  let closing = false;
  if (value[index] === '/') {
    closing = true;
    index += 1;
  }

  while (index < value.length && value[index] === ' ') {
    index += 1;
  }

  const nameStart = index;
  while (index < value.length && isTagNameChar(value[index])) {
    index += 1;
  }

  if (index === nameStart) {
    return null;
  }

  const name = value.slice(nameStart, index).toLowerCase();

  while (index < value.length && value[index] !== '>') {
    index += 1;
  }

  if (index >= value.length) {
    return null;
  }

  return { closing, name, endIndex: index };
};

const decodeEntities = (value: string): string => {
  let output = '';

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '&') {
      output += value[index];
      continue;
    }

    let matched = '';
    for (const entity of ENTITY_MAP.keys()) {
      if (value.startsWith(entity, index)) {
        matched = entity;
        break;
      }
    }

    if (!matched) {
      output += value[index];
      continue;
    }

    output += ENTITY_MAP.get(matched) ?? '';
    index += matched.length - 1;
  }

  return output;
};

const collapseBlankLines = (value: string): string => {
  let output = '';
  let newlineRunLength = 0;

  for (const char of value) {
    if (char !== '\n') {
      output += char;
      newlineRunLength = 0;
      continue;
    }

    newlineRunLength += 1;
    if (newlineRunLength > 2) {
      continue;
    }

    output += '\n';
  }

  return output;
};

const humanizeLabel = (value: string): string =>
  value
    .split(/[\s._/-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const htmlToPlainText = (value: string): string => {
  let output = '';

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '<') {
      output += value[index];
      continue;
    }

    const tag = readHtmlTag(value, index);
    if (!tag) {
      output += value[index];
      continue;
    }

    const tagName = tag.name;

    if (!tag.closing && BLOCK_BREAK_TAGS.has(tagName)) {
      output += '\n';
    } else if (tag.closing && BLOCK_BREAK_TAGS.has(tagName)) {
      output += '\n';
    } else if (!tag.closing && OPENING_BREAK_TAGS.has(tagName)) {
      output += '\n';
    } else if (!tag.closing && OPENING_STRIP_TAGS.has(tagName)) {
      // Opening block tags are removed but their contents are preserved.
    }

    index = tag.endIndex;
  }

  output = decodeEntities(output);

  let sanitized = '';
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== '<') {
      sanitized += output[index];
      continue;
    }

    let lookahead = index + 1;
    while (lookahead < output.length && output[lookahead] === ' ') {
      lookahead += 1;
    }

    if (
      lookahead < output.length &&
      (output[lookahead] === '/' ||
        output[lookahead] === '!' ||
        output[lookahead] === '?' ||
        isAsciiLetter(output[lookahead]))
    ) {
      continue;
    }

    sanitized += '<';
  }

  return collapseBlankLines(sanitized).trim();
};

const toStringValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toStringValue(item))
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferredKeys = ['html', 'text', 'value', 'content', 'body', 'richText'];

    for (const key of preferredKeys) {
      const nested = record[key];
      if (nested !== undefined && nested !== null) {
        const nestedValue = toStringValue(nested);
        if (nestedValue.trim()) {
          return nestedValue;
        }
      }
    }

    const entries = Object.entries(record);
    if (!entries.length) {
      return '';
    }

    return entries
      .map(([key, item]) => {
        const nested = toStringValue(item);
        if (!nested) {
          return '';
        }

        return `${humanizeLabel(key)}: ${nested}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
};

export const renderRichText = (ctx: PdfContext, value: unknown): void => {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'runs' in (value as Record<string, unknown>) &&
    (value as { runs?: unknown }).runs !== undefined
  ) {
    const runsValue = (value as { runs: unknown }).runs;
    if (typeof runsValue === 'string') {
      renderParagraph(ctx, runsValue, { fontSize: ctx.theme.fontSizes.body });
      return;
    }

    if (Array.isArray(runsValue)) {
      const runs = runsValue as Array<{ text: string; bold?: boolean }>;
      renderParagraph(ctx, runs.map((run) => run.text).join(''), {
        fontSize: ctx.theme.fontSizes.body,
      });
      return;
    }
    return;
  }

  const raw = toStringValue(value).trim();

  if (!raw) {
    renderParagraph(ctx, '—', { fontSize: ctx.theme.fontSizes.body });
    return;
  }

  if (Array.isArray(value)) {
    renderBulletList(
      ctx,
      value.map((item) => toStringValue(item)).filter((item) => item.trim().length > 0)
    );
    return;
  }

  const plainText = raw.includes('<') ? htmlToPlainText(raw) : raw;

  if (!plainText) {
    renderParagraph(ctx, '—', { fontSize: ctx.theme.fontSizes.body });
    return;
  }

  renderParagraph(ctx, plainText, {
    fontSize: ctx.theme.fontSizes.body,
  });
};
