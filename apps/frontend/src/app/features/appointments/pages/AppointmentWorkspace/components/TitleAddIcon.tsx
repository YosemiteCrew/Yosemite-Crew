import React from 'react';

/**
 * Small "+" affordance shown at the start of a floating container title
 * (Services & Packages / Prescription). Decorative blue blur circle with a
 * white plus glyph.
 */
export const TitleAddIcon = () => (
  <span
    aria-hidden="true"
    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-text-brand"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 3.33V12.67M3.33 8H12.67"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);
