import { hasDom, isRichTextEmpty, sanitizeRichText } from '@/app/lib/richText';

describe('richText lib', () => {
  it('keeps allowed formatting tags', () => {
    const html = '<p><strong>bold</strong> <em>it</em> <u>u</u></p><ul><li>one</li></ul>';
    expect(sanitizeRichText(html)).toContain('<strong>');
    expect(sanitizeRichText(html)).toContain('<li>');
  });

  it('strips disallowed tags and attributes', () => {
    const dirty = '<p onclick="x()">hi</p><script>alert(1)</script><img src="x">';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('<img');
    expect(clean).toContain('hi');
  });

  it('handles empty input', () => {
    expect(sanitizeRichText('')).toBe('');
  });

  it('reports a DOM is available in the jsdom test environment', () => {
    expect(hasDom()).toBe(true);
  });

  it('detects empty rich text', () => {
    expect(isRichTextEmpty(undefined)).toBe(true);
    expect(isRichTextEmpty('<p></p>')).toBe(true);
    expect(isRichTextEmpty('<p>&nbsp;</p>')).toBe(true);
    expect(isRichTextEmpty('<p>text</p>')).toBe(false);
  });
});
