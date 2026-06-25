'use client';
import React, { useEffect, useRef, useState } from 'react';
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

const Header = ({ user = false }: { user?: boolean }) => {
  const [dockPublicHeader, setDockPublicHeader] = useState(false);
  const [scrollBehaviorReady, setScrollBehaviorReady] = useState(false);
  const tickingRef = useRef(false);

  useEffect(() => {
    if (user) {
      setScrollBehaviorReady(false);
      return;
    }

    const updateHeaderState = () => {
      const currentScrollY = Math.max(globalThis.window.scrollY, 0);
      setDockPublicHeader(currentScrollY >= getHeaderDockThreshold());
      tickingRef.current = false;
    };

    const handleScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      globalThis.window.requestAnimationFrame(updateHeaderState);
    };

    updateHeaderState();
    setScrollBehaviorReady(true);
    globalThis.window.addEventListener('scroll', handleScroll, { passive: true });
    globalThis.window.addEventListener('resize', handleScroll);

    return () => {
      globalThis.window.removeEventListener('scroll', handleScroll);
      globalThis.window.removeEventListener('resize', handleScroll);
    };
  }, [user]);

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
