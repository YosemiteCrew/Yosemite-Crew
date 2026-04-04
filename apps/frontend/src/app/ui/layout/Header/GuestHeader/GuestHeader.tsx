import React, { useEffect, useState } from 'react';
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
  const logoUrl = MEDIA_SOURCES.logo;

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  useEffect(() => {
    if (status === 'idle') {
      void useAuthStore.getState().checkSession();
    }
  }, [status]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
    <div
      className="flex items-center justify-between px-3! sm:px-12! lg:px-20! gap-10 w-full h-20"
      data-terminology-lock="true"
    >
      <Link href="/" className="logo">
        <Image src={logoUrl} alt="Logo" width={90} height={83} priority />
      </Link>

      <div className="max-w-[800px] flex-1 hidden lg:flex">
        <ul className="list-none flex items-center justify-between flex-1 p-0 m-0">
          {publicNavItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href ? item.href : '#'}
                className={`${item.href === pathname ? 'text-text-primary!' : 'text-text-tertiary!'} inline-block text-body-4 hover:text-text-brand! transition-all duration-200 ease-out hover:scale-108!`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <MobileMenu isOpen={menuOpen}>
        {publicNavItems.map((item) => (
          <button
            type="button"
            key={item.label}
            onClick={() => handleClick(item.href ? item.href : '#')}
            className={`text-body-4 px-3 py-2 rounded-2xl! border border-card-border! text-start transition-all duration-300 ease-in hover:bg-card-border ${item.href === pathname && 'text-text-brand border-text-brand! bg-brand-100'}`}
          >
            {item.label}
          </button>
        ))}
        {!hideButtons && getMobileAuthButton()}
      </MobileMenu>

      <HamburgerMenuButton menuOpen={menuOpen} onClick={toggleMenu} />

      {!hideButtons && getDesktopAuthButton()}
    </div>
  );
};

export default GuestHeader;
