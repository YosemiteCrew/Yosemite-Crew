'use client';

import type { CSSProperties } from 'react';
import { IoMoonOutline, IoSunnyOutline } from 'react-icons/io5';
import { useTheme } from './useTheme';

const toggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  width: 44,
  height: 44,
  border: '1px solid var(--glass-btn-border)',
  borderRadius: 9999,
  background: 'var(--glass-btn)',
  backdropFilter: 'blur(30px) saturate(190%)',
  WebkitBackdropFilter: 'blur(30px) saturate(190%)',
  color: 'var(--ink-body)',
  cursor: 'pointer',
  boxShadow: 'var(--glass-pill-shadow)',
};

interface ThemeToggleProps {
  /** Optional style overrides (e.g. full-width inside the mobile menu). */
  style?: CSSProperties;
}

/**
 * Round glass button that flips the site between light and dark. Renders a moon in
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
      style={{ ...toggleStyle, ...style }}
    >
      {dark ? (
        <IoSunnyOutline style={{ fontSize: 18 }} aria-hidden="true" />
      ) : (
        <IoMoonOutline style={{ fontSize: 18 }} aria-hidden="true" />
      )}
    </button>
  );
}
