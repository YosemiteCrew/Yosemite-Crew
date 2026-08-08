'use client';

import type { CSSProperties } from 'react';
import { IoMoonOutline, IoSunnyOutline } from 'react-icons/io5';
import { useTheme } from '@/app/ui/theme/useTheme';

// Hoisted to module scope so the object identity is stable across renders
// (avoids a new inline-object allocation on every render).
const toggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  width: 38,
  height: 38,
  border: '1px solid var(--hairline)',
  borderRadius: 9999,
  background: 'var(--screen-2)',
  color: 'var(--ink-body)',
  cursor: 'pointer',
};

const iconStyle: CSSProperties = { fontSize: 18 };

interface ThemeToggleProps {
  /** Optional style overrides (e.g. full-width inside a collapsed menu). */
  style?: CSSProperties;
}

/**
 * Round button that flips the PIMS between light and dark. Renders a moon in
 * light mode and a sun in dark; `aria-pressed` reflects the dark state.
 */
export function ThemeToggle({ style }: Readonly<ThemeToggleProps>) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light' : 'Switch to dark'}
      style={style ? { ...toggleStyle, ...style } : toggleStyle}
    >
      {dark ? (
        <IoSunnyOutline style={iconStyle} aria-hidden="true" />
      ) : (
        <IoMoonOutline style={iconStyle} aria-hidden="true" />
      )}
    </button>
  );
}

export default ThemeToggle;
