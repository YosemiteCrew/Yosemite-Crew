import { buildDragPreview } from '@/app/lib/buildDragPreview';

describe('buildDragPreview', () => {
  let source: HTMLElement;

  beforeEach(() => {
    source = document.createElement('div');
    Object.defineProperty(source, 'offsetWidth', { value: 250, configurable: true });
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('clones source and appends to body', () => {
    const preview = buildDragPreview(source);
    expect(document.body.contains(preview)).toBe(true);
  });

  it('sets fixed positioning and offscreen placement', () => {
    const preview = buildDragPreview(source);
    expect(preview.style.position).toBe('fixed');
    expect(preview.style.top).toBe('-10000px');
    expect(preview.style.left).toBe('-10000px');
  });

  it('uses source offsetWidth for width and maxWidth', () => {
    const preview = buildDragPreview(source);
    expect(preview.style.width).toBe('250px');
    expect(preview.style.maxWidth).toBe('250px');
  });

  it('applies visual styles (borderRadius, overflow, background)', () => {
    const preview = buildDragPreview(source);
    expect(preview.style.borderRadius).toBe('16px');
    expect(preview.style.overflow).toBe('hidden');
    expect(preview.style.background).toBe('rgb(255, 255, 255)');
    expect(preview.style.boxShadow).toBe('none');
    expect(preview.style.opacity).toBe('1');
    expect(preview.style.zIndex).toBe('99999');
    expect(preview.style.pointerEvents).toBe('none');
  });

  it('defaults scale to 1 when no options are provided', () => {
    const preview = buildDragPreview(source);
    expect(preview.style.transform).toBe('scale(1)');
  });

  it('applies custom scale from options', () => {
    const preview = buildDragPreview(source, { scale: 0.8 });
    expect(preview.style.transform).toBe('scale(0.8)');
  });

  it('does not set transformOrigin when not provided', () => {
    const preview = buildDragPreview(source);
    expect(preview.style.transformOrigin).toBe('');
  });

  it('sets transformOrigin when provided in options', () => {
    const preview = buildDragPreview(source, { transformOrigin: 'top left' });
    expect(preview.style.transformOrigin).toBe('top left');
  });

  it('applies both scale and transformOrigin together', () => {
    const preview = buildDragPreview(source, { scale: 1.2, transformOrigin: 'center' });
    expect(preview.style.transform).toBe('scale(1.2)');
    expect(preview.style.transformOrigin).toBe('center');
  });

  it('returns an HTMLElement', () => {
    const preview = buildDragPreview(source);
    expect(preview).toBeInstanceOf(HTMLElement);
  });

  it('is a clone of the source (not the same node)', () => {
    const preview = buildDragPreview(source);
    expect(preview).not.toBe(source);
  });
});
