export const buildDragPreview = (
  source: HTMLElement,
  options?: { scale?: number; transformOrigin?: string }
): HTMLElement => {
  const preview = source.cloneNode(true) as HTMLElement;
  preview.style.position = 'fixed';
  preview.style.top = '-10000px';
  preview.style.left = '-10000px';
  preview.style.width = `${source.offsetWidth}px`;
  preview.style.maxWidth = `${source.offsetWidth}px`;
  preview.style.pointerEvents = 'none';
  preview.style.borderRadius = '16px';
  preview.style.overflow = 'hidden';
  preview.style.boxShadow = 'none';
  preview.style.background = '#fff';
  preview.style.transform = `scale(${options?.scale ?? 1})`;
  if (options?.transformOrigin) {
    preview.style.transformOrigin = options.transformOrigin;
  }
  preview.style.opacity = '1';
  preview.style.zIndex = '99999';
  document.body.appendChild(preview);
  return preview;
};
