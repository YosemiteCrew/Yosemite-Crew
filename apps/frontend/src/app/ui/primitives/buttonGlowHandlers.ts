import type { PointerEvent } from 'react';

const setGlowOrigin = (e: PointerEvent<HTMLButtonElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--yc-button-x', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--yc-button-y', `${e.clientY - r.top}px`);
};

/**
 * Pointer handlers that keep the `yc-primary-button` glow centred on the
 * cursor. Spread onto the button: `<button {...primaryButtonGlowHandlers}>`.
 */
export const primaryButtonGlowHandlers = {
  onPointerDown: setGlowOrigin,
  onPointerMove: setGlowOrigin,
};
