import DOMPurify from 'dompurify';

/** Tags allowed in stored rich-text HTML (B/I/U, lists, paragraphs, line breaks). */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li'];
const ALLOWED_ATTR = ['class'];

/** DOMPurify needs a real DOM; expose the check so the SSR fallback is testable. */
export const hasDom = (): boolean => globalThis.window !== undefined;

/** Sanitize editor HTML before storing/sending to the backend. */
export const sanitizeRichText = (html: string = ''): string => {
  // On the server (no DOM) fall back to stripping all tags so no unsanitized
  // markup is ever emitted during SSR.
  if (!hasDom()) return replaceNbsp(stripHtmlTags(html));
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
};

const stripHtmlTags = (html: string): string => {
  let result = '';
  let inTag = false;

  for (const char of html) {
    if (char === '<') {
      inTag = true;
      continue;
    }
    if (char === '>') {
      inTag = false;
      continue;
    }
    if (!inTag) {
      result += char;
    }
  }

  return result;
};

const replaceNbsp = (value: string): string => {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '&' && value.slice(index, index + 6) === '&nbsp;') {
      result += ' ';
      index += 5;
      continue;
    }
    result += value[index];
  }

  return result;
};

/** Strip tags to test whether a rich-text value carries any visible content. */
export const isRichTextEmpty = (html: string | undefined): boolean => {
  if (!html) return true;
  const text = replaceNbsp(stripHtmlTags(html)).trim();
  return text.length === 0;
};
