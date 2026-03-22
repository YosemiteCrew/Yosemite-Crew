import {
  getMerckSubtopicPillStyle,
  sanitizeMerckHtml,
} from '@/app/features/integrations/constants/merck';

describe('getMerckSubtopicPillStyle', () => {
  it('returns preset style for known labels', () => {
    const style = getMerckSubtopicPillStyle('Etiology');

    expect(style).toEqual({
      backgroundColor: '#747283',
      color: '#F7F7F7',
      borderColor: '#747283',
    });
  });

  it('returns a non-white fallback style for unknown labels', () => {
    const style = getMerckSubtopicPillStyle('Pathogenesis');

    expect(style).toBeDefined();
    expect(style.backgroundColor).not.toBe('#FFFFFF');
    expect(style.backgroundColor).not.toBe('#fff');
  });

  it('returns deterministic fallback style for the same label', () => {
    const first = getMerckSubtopicPillStyle('Atypical Finding');
    const second = getMerckSubtopicPillStyle('Atypical Finding');

    expect(first).toEqual(second);
  });
});

describe('sanitizeMerckHtml', () => {
  it('keeps allowed inline tags and strips disallowed tags', () => {
    const html = '<strong>Bold</strong> and <a href="/x">link</a>';

    expect(sanitizeMerckHtml(html)).toBe('<strong>Bold</strong> and link');
  });

  it('handles malformed tag input without hanging', () => {
    const html = `<${'a'.repeat(10000)}`;

    expect(sanitizeMerckHtml(html)).toBe(html);
  });
});
