import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

import { useAuthStore } from '@/app/stores/authStore';
import { Primary } from '@/app/ui/primitives/Buttons';
import HamburgerMenuButton from '@/app/ui/layout/Header/HamburgerMenuButton';
import MobileMenu from '@/app/ui/layout/Header/MobileMenu';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';

interface NavItem {
  label: string;
  href?: string;
  children?: NavItem[];
}

const publicNavItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Pet Businesses', href: '/pms' },
  { label: 'Pet Parents', href: '/application' },
  { label: 'Developers', href: '/developers' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact us', href: '/contact' },
  { label: 'About us', href: '/about' },
];

const GuestHeader = () => {
  const pathname = usePathname();
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const { user, role } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const prevPathnameRef = useRef(pathname);
  if (prevPathnameRef.current !== pathname) {
    prevPathnameRef.current = pathname;
    if (menuOpen) setMenuOpen(false);
  }
  const logoUrl = MEDIA_SOURCES.logo;

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  useEffect(() => {
    if (status === 'idle') {
      void useAuthStore.getState().checkSession();
    }
  }, [status]);

  useEffect(() => {
    const closeMenuOnDesktop = () => {
      if (globalThis.window.innerWidth >= 1024) {
        setMenuOpen(false);
      }
    };

    closeMenuOnDesktop();
    globalThis.window.addEventListener('resize', closeMenuOnDesktop);
    return () => globalThis.window.removeEventListener('resize', closeMenuOnDesktop);
  }, []);

  const handleClick = (href: string) => {
    setMenuOpen(false);
    setTimeout(() => {
      startRouteLoader();
      router.push(href);
    }, 400);
  };

  const isSignInPage = pathname === '/signin';
  const isSignUpPage = pathname === '/signup';
  const hideButtons = pathname === '/organizations' || pathname === '/forgot-password';
  const defaultAppRoute =
    role === 'developer' ? '/developers/home' : resolveDefaultOpenScreenRoute(role);
  const mobileMenuId = 'guest-mobile-menu';

  const getMobileAuthButton = () => {
    if (user) {
      return (
        <Primary
          href="#"
          onClick={() => handleClick(defaultAppRoute)}
          text="Go to app"
          className="mt-3"
        />
      );
    }
    if (isSignInPage) {
      return (
        <Primary href="#" onClick={() => handleClick('/signup')} text="Sign up" className="mt-3" />
      );
    }
    if (isSignUpPage) {
      return (
        <Primary href="#" onClick={() => handleClick('/signin')} text="Sign in" className="mt-3" />
      );
    }
    return (
      <Primary href="#" onClick={() => handleClick('/signup')} text="Sign up" className="mt-3" />
    );
  };

  const getDesktopAuthButton = () => {
    if (user) {
      return (
        <div className="hidden lg:flex">
          <Primary href={defaultAppRoute} text="Go to app" />
        </div>
      );
    }
    if (isSignInPage) {
      return (
        <div className="hidden lg:flex">
          <Primary href="/signup" text="Sign up" />
        </div>
      );
    }
    if (isSignUpPage) {
      return (
        <div className="hidden lg:flex">
          <Primary href="/signin" text="Sign in" />
        </div>
      );
    }
    return (
      <div className="hidden lg:flex">
        <Primary href="/signup" text="Sign up" />
      </div>
    );
  };

  return (
    <div className="yc-guest-header" data-terminology-lock="true">
      <Link href="/" className="yc-guest-logo-link" aria-label="Yosemite Crew home">
        <Image
          src={logoUrl}
          alt="Yosemite Crew"
          width={112}
          height={72}
          priority
          style={{ width: 'auto' }}
        />
      </Link>

      <div className="yc-guest-nav">
        <ul className="yc-guest-nav-list">
          {publicNavItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href ? item.href : '#'}
                aria-current={item.href === pathname ? 'page' : undefined}
                className={`yc-guest-nav-link text-body-4 ${
                  item.href === pathname ? 'yc-guest-nav-link-active' : ''
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <MobileMenu isOpen={menuOpen} id={mobileMenuId} onClose={() => setMenuOpen(false)}>
        {publicNavItems.map((item) => (
          <button
            type="button"
            key={item.label}
            onClick={() => handleClick(item.href ? item.href : '#')}
            className={`yc-guest-mobile-route text-body-4 px-3 py-2 ${
              item.href === pathname ? 'yc-guest-mobile-route-active' : ''
            }`}
          >
            {item.label}
          </button>
        ))}
        {!hideButtons && getMobileAuthButton()}
      </MobileMenu>

      <HamburgerMenuButton menuOpen={menuOpen} onClick={toggleMenu} controlsId={mobileMenuId} />

      {!hideButtons && getDesktopAuthButton()}
    </div>
  );
};

export default GuestHeader;
