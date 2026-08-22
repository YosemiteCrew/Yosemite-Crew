'use client';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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

// `hasMounted` never changes after hydration, so the store has nothing to emit.
const subscribeToNothing = () => () => {};

const Header = ({ user = false }: { user?: boolean }) => {
  // Both seeded to the SERVER's view, not the window's. Reading window.scrollY
  // in the initializer made the first client render disagree with the server
  // HTML - a hydration mismatch, and a docked class the server never emitted.
  // The real value is read once the effect runs, which is also what makes a
  // restored-scroll or deep-link load correct without waiting for a scroll.
  const [dockPublicHeader, setDockPublicHeader] = useState(false);
  // useSyncExternalStore is the sanctioned way to render differently on the
  // client without a hydration mismatch: the server snapshot is false, the
  // client snapshot true, and React swaps them at hydration rather than during
  // the first render.
  const hasMounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
  const tickingRef = useRef(false);

  useEffect(() => {
    if (user) return;

    const updateHeaderState = () => {
      const currentScrollY = Math.max(globalThis.window.scrollY, 0);
      setDockPublicHeader(currentScrollY >= getHeaderDockThreshold());
      tickingRef.current = false;
    };

    // Read the real scroll position on mount: the state starts at the server's
    // value, so without this a page restored mid-scroll renders undocked until
    // the user scrolls or resizes.
    updateHeaderState();

    const handleScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      globalThis.window.requestAnimationFrame(updateHeaderState);
    };

    globalThis.window.addEventListener('scroll', handleScroll, { passive: true });
    globalThis.window.addEventListener('resize', handleScroll);

    return () => {
      globalThis.window.removeEventListener('scroll', handleScroll);
      globalThis.window.removeEventListener('resize', handleScroll);
    };
  }, [user]);

  const scrollBehaviorReady = hasMounted && !user;
  const publicHeaderDocked = scrollBehaviorReady && dockPublicHeader;
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
