'use client';
import React, { useEffect, useRef, useState } from 'react';
import GuestHeader from '@/app/ui/layout/Header/GuestHeader/GuestHeader';
import UserHeader from '@/app/ui/layout/Header/UserHeader/UserHeader';
import './Header.css';

const getFirstSectionDockPoint = () => {
  // Keyed off .yc-public-page — the wrapper shared by BOTH public shells
  // ((public)/layout.tsx and PublicShell), so the dock trigger is identical on
  // every public page. Its first child is the page's first/hero section.
  const publicPage = document.querySelector('.yc-public-page');
  const firstPublicSection = publicPage?.firstElementChild;
  if (!firstPublicSection) return globalThis.window.innerHeight;

  return firstPublicSection.getBoundingClientRect().bottom + globalThis.window.scrollY;
};

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
      setDockPublicHeader(currentScrollY >= getFirstSectionDockPoint());
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
