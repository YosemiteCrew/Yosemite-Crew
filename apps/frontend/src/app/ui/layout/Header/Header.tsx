'use client';
import React, { useSyncExternalStore } from 'react';
import GuestHeader from '@/app/ui/layout/Header/GuestHeader/GuestHeader';
import UserHeader from '@/app/ui/layout/Header/UserHeader/UserHeader';
import './Header.css';

// Distance (px) the user must scroll before the floating pill expands into the
// flush docked bar. Keyed off the viewport height so the pill stays floating
// through most of the first/hero section, then docks once the user scrolls
// meaningfully past it. A viewport-relative value works on every public page,
// including ones whose first child wraps the entire page (so its bottom never
// becomes a usable trigger), keeping the transform consistent across routes.
const getHeaderDockThreshold = () => Math.round(globalThis.window.innerHeight * 0.6);

// The signed-in header never docks, so it has nothing to subscribe to.
const subscribeToNothing = () => () => {};
const isNeverDocked = () => false;

// Scroll and resize can fire many times per frame; re-read at most once a frame.
const subscribeToScroll = (onChange: () => void) => {
  let pending = false;
  let frame = 0;
  const handleScroll = () => {
    if (pending) return;
    pending = true;
    frame = globalThis.window.requestAnimationFrame(() => {
      pending = false;
      onChange();
    });
  };

  globalThis.window.addEventListener('scroll', handleScroll, { passive: true });
  globalThis.window.addEventListener('resize', handleScroll);

  return () => {
    if (pending) globalThis.window.cancelAnimationFrame(frame);
    globalThis.window.removeEventListener('scroll', handleScroll);
    globalThis.window.removeEventListener('resize', handleScroll);
  };
};

const isPastDockThreshold = () =>
  Math.max(globalThis.window.scrollY, 0) >= getHeaderDockThreshold();

const Header = ({ user = false }: { user?: boolean }) => {
  // The scroll position is read straight from the window. The server snapshot is
  // false, so the first client render matches the server HTML, and React swaps in
  // the real value at hydration - which also docks a restored-scroll or deep-link
  // load without waiting for a scroll.
  const publicHeaderDocked = useSyncExternalStore(
    user ? subscribeToNothing : subscribeToScroll,
    user ? isNeverDocked : isPastDockThreshold,
    isNeverDocked
  );
  const headerClassName = [
    'yc-liquid-header-shell flex items-center justify-center w-full',
    'sticky top-0 left-0 z-997',
    user ? 'yc-user-header-shell' : 'yc-guest-header-shell',
    publicHeaderDocked ? 'yc-public-header-docked' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <header className={headerClassName}>{user ? <UserHeader /> : <GuestHeader />}</header>;
};

export default Header;
