import {spacing, borderRadius, shadows} from '@/theme/spacing';

describe('spacing scale', () => {
  it('exposes the base spacing steps', () => {
    expect(spacing['0']).toBe(0);
    expect(spacing['4']).toBe(16);
    expect(spacing['5']).toBe(20);
  });
});

describe('borderRadius', () => {
  it('keeps the numeric t-shirt scale stable', () => {
    expect(borderRadius.none).toBe(0);
    expect(borderRadius.base).toBe(16);
    expect(borderRadius.full).toBe(9999);
  });

  it('adds warm-bone semantic radii', () => {
    expect(borderRadius.field).toBe(16);
    expect(borderRadius.cardSmall).toBe(18);
    expect(borderRadius.card).toBe(20);
    expect(borderRadius.button).toBe(18);
    expect(borderRadius.sheet).toBe(28);
    expect(borderRadius.screen).toBe(28);
    expect(borderRadius.pill).toBe(9999);
    expect(borderRadius.chip).toBe(9999);
  });
});

describe('shadows', () => {
  it('adds warm-bone semantic elevation as boxShadow strings', () => {
    expect(shadows.card.boxShadow).toContain('rgba(29,28,27,0.05)');
    expect(shadows.screen.boxShadow).toContain('rgba(29,28,27,0.10)');
    expect(shadows.cta.boxShadow).toContain('rgba(29,28,27,0.16)');
    expect(shadows.companion.boxShadow).toContain('rgba(244,121,190,0.12)');
  });

  it('keeps the legacy elevation steps', () => {
    expect(shadows.none.boxShadow).toBe('none');
    expect(shadows.md.boxShadow).toContain('rgba(0,0,0,0.15)');
  });
});
