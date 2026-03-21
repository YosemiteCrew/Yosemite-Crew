import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MdNotificationsActive } from 'react-icons/md';
import { usePathname, useRouter } from 'next/navigation';
import { useSignOut } from '@/app/hooks/useAuth';

import { useOrgStore } from '@/app/stores/orgStore';
import { useOrgList, usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { FaCaretDown } from 'react-icons/fa6';

import { useAuthStore } from '@/app/stores/authStore';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import Image from 'next/image';
import { getSafeImageUrl } from '@/app/lib/urls';
import Search from '@/app/ui/inputs/Search';
import { useSearchStore } from '@/app/stores/searchStore';
import { useUniversalSearchStore } from '@/app/stores/universalSearchStore';
import HamburgerMenuButton from '@/app/ui/layout/Header/HamburgerMenuButton';
import MobileMenu from '@/app/ui/layout/Header/MobileMenu';
import { headerAppRoutes, headerDevRoutes } from '@/app/config/routes';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

const UserHeader = () => {
  const terminologyText = useCompanionTerminologyText();
  const { signOut } = useSignOut();
  const pathname = usePathname();
  const router = useRouter();
  const attributes = useAuthStore((s) => s.attributes);
  const profile = usePrimaryOrgProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const isDev = pathname.startsWith('/developers');
  const { isEnabled: merckEnabled } = useResolvedMerckIntegrationForPrimaryOrg();
  const routes = isDev ? headerDevRoutes : headerAppRoutes;
  const mobileRoutes = isDev
    ? routes
    : (() => {
        const next = [...routes];
        const signOutIndex = next.findIndex((route) => route.name === 'Sign out');
        const insertIndex = signOutIndex === -1 ? next.length : signOutIndex;
        if (merckEnabled) {
          next.splice(insertIndex, 0, {
            name: 'Merck Manuals',
            href: '/integrations/merck-manuals',
            verify: true,
          });
        }
        next.splice(insertIndex, 0, { name: 'Guides', href: '/guides', verify: false });
        return next;
      })();
  const [selectOrg, setSelectOrg] = useState(false);
  const [selectProfile, setSelectProfile] = useState(false);
  const orgs = useOrgList();
  const primaryOrg = usePrimaryOrg();
  const setPrimaryOrg = useOrgStore((s) => s.setPrimaryOrg);
  const membershipsByOrgId = useOrgStore((s) => s.membershipsByOrgId);
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const clear = useSearchStore((s) => s.clear);
  const openUniversalSearch = useUniversalSearchStore((s) => s.open);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const logoutRedirect = pathname.startsWith('/developers') ? '/developers/signin' : '/signin';

  useEffect(() => {
    clear();
  }, [pathname, clear]);

  useEffect(() => {
    setMenuOpen(false);
    setSelectOrg(false);
    setSelectProfile(false);
  }, [pathname]);

  useEffect(() => {
    const closeMenuOnDesktop = () => {
      if (globalThis.window.innerWidth >= 1024) {
        setMenuOpen(false);
        setSelectOrg(false);
        setSelectProfile(false);
      }
    };

    closeMenuOnDesktop();
    globalThis.window.addEventListener('resize', closeMenuOnDesktop);
    return () => globalThis.window.removeEventListener('resize', closeMenuOnDesktop);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      if (globalThis.window !== undefined) {
        globalThis.localStorage.removeItem('yc_dashboard_videos_hidden');
      }
      console.log('✅ Signed out using Cognito signout');
      startRouteLoader();
      router.replace(logoutRedirect);
    } catch (error) {
      console.error('⚠️ Cognito signout error:', error);
    }
  };

  const handleOrgClick = (orgId: string) => {
    setPrimaryOrg(orgId);
    setSelectOrg(false);
    const role = membershipsByOrgId[orgId]?.roleDisplay ?? membershipsByOrgId[orgId]?.roleCode;
    startRouteLoader();
    router.push(resolveDefaultOpenScreenRoute(role));
  };

  const handleMobileOrgClick = (orgId: string) => {
    setPrimaryOrg(orgId);
    setSelectOrg(false);
    setMenuOpen(false);
    const role = membershipsByOrgId[orgId]?.roleDisplay ?? membershipsByOrgId[orgId]?.roleCode;
    setTimeout(() => {
      startRouteLoader();
      router.push(resolveDefaultOpenScreenRoute(role));
    }, 300);
  };

  const handleClick = (item: any) => {
    setMenuOpen(false);
    setTimeout(() => {
      if (item.name === 'Sign out') {
        handleLogout();
      } else {
        startRouteLoader();
        router.push(item.href);
      }
    }, 400);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setSelectProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setSelectOrg(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const orgMissing = !primaryOrg;
  const orgVerified = !!primaryOrg?.isVerified;

  const getSearchPlaceholder = () => {
    if (pathname.startsWith('/appointments/idexx-workspace')) return 'Search result / order';
    if (pathname.startsWith('/appointments')) return 'Search appointments';
    if (pathname.startsWith('/inventory')) return 'Search inventory';
    if (pathname.startsWith('/integrations/idexx-workspace')) return 'Search result / order';
    if (pathname.startsWith('/integrations')) return 'Search integrations';
    if (pathname.startsWith('/forms')) return 'Search forms';
    if (pathname.startsWith('/companions')) return terminologyText('Search companions');
    if (pathname.startsWith('/tasks')) return 'Search tasks';
    if (pathname.startsWith('/finance')) return 'Search invoices';
    return 'Search';
  };

  const hideSearch =
    pathname.startsWith('/chat') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/organization') ||
    pathname.startsWith('/organizations') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/guides') ||
    (pathname.startsWith('/integrations') && !pathname.startsWith('/integrations/idexx-workspace'));
  const authenticatedLogoHref = isDev ? '/developers/home' : '/dashboard';

  return (
    <div className="flex items-center justify-between px-3 sm:px-12! lg:px-[36px]! w-full h-20 gap-0">
      <MobileMenu isOpen={menuOpen}>
        {primaryOrg && !isDev && (
          <div className="relative w-fit" ref={orgDropdownRef}>
            <button
              className={`flex items-center gap-2 w-60 z-1000 xl:w-[260px] justify-between px-6 py-2 ${selectOrg ? 'border border-card-border! rounded-t-2xl!' : 'border-white! border'}`}
              onClick={() => setSelectOrg((e) => !e)}
            >
              <div className="flex justify-center h-8 w-8 shrink-0">
                <Image
                  src={getSafeImageUrl(primaryOrg.imageURL, 'business')}
                  alt="Logo"
                  height={32}
                  width={32}
                  className="rounded-full cursor-pointer h-8 w-8 object-cover"
                />
              </div>
              <div className="text-black-text text-body-4 truncate max-w-[200px]">
                {primaryOrg?.name}
              </div>
              <FaCaretDown
                size={20}
                className={`text-black-text transition-transform cursor-pointer`}
              />
            </button>
            {selectOrg && (
              <div className="absolute top-[100%] left-0 z-1000 rounded-b-2xl border-l border-r border-b border-card-border bg-white flex flex-col items-center w-full px-[12px] py-[10px]">
                {orgs.slice(0, 3).map((org, i) => (
                  <button
                    key={org.name + i}
                    className="px-[1.25rem] py-[0.75rem] text-body-4 hover:bg-card-hover rounded-2xl! transition-all duration-300 text-text-secondary! hover:text-text-primary! w-full truncate"
                    onClick={() => handleMobileOrgClick(org._id?.toString() || org.name)}
                  >
                    {org.name}
                  </button>
                ))}
                <Link
                  href={'/organizations'}
                  onClick={() => {
                    setSelectOrg(false);
                    setMenuOpen(false);
                  }}
                  className="text-text-brand px-[1.25rem] py-[0.75rem] text-body-4 text-center w-full hover:bg-card-hover rounded-2xl! transition-all duration-300"
                >
                  View all
                </Link>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col gap-3">
          {mobileRoutes.map((route) => {
            const needsVerifiedOrg = route.verify;
            // Developer portal routes don't need org verification
            const isDisabled = isDev
              ? false
              : route.name !== 'Sign out' &&
                route.name !== 'Settings' &&
                (orgMissing || (needsVerifiedOrg && !orgVerified));

            const isActive = pathname === route.href;

            const onClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
              e.preventDefault();
              if (isDisabled) return;
              handleClick(route);
            };

            return (
              <button
                type="button"
                key={route.name}
                onClick={onClick}
                className={`text-body-4 px-3 py-2 rounded-2xl! border border-card-border! text-start transition-all duration-300 ease-in hover:bg-card-border ${isActive && 'text-text-brand border-text-brand! bg-brand-100'} ${isDisabled && 'text-[#A09F9F]!'}`}
              >
                {route.name}
              </button>
            );
          })}
        </div>
      </MobileMenu>

      <div className="flex lg:hidden">
        <Link href={authenticatedLogoHref} className="logo">
          <Image src={MEDIA_SOURCES.logo} alt="Logo" width={90} height={83} priority />
        </Link>
      </div>
      <div className="hidden lg:flex">
        {primaryOrg && !isDev && (
          <div className="relative" ref={orgDropdownRef}>
            <button
              className={`flex items-center gap-2 w-60 xl:w-[260px] justify-between px-6 py-2 ${selectOrg ? 'border border-card-border! rounded-t-2xl!' : 'border-white! border'}`}
              onClick={() => setSelectOrg((e) => !e)}
            >
              <div className="flex justify-center h-8 w-8 shrink-0">
                <Image
                  src={getSafeImageUrl(primaryOrg.imageURL, 'business')}
                  alt="Logo"
                  height={32}
                  width={32}
                  className="rounded-full cursor-pointer h-8 w-8 object-cover"
                />
              </div>
              <div className="text-black-text text-body-4 truncate flex-1">{primaryOrg?.name}</div>
              <FaCaretDown
                size={20}
                className={`text-black-text transition-transform cursor-pointer`}
              />
            </button>
            {selectOrg && (
              <div className="absolute top-[100%] left-0 rounded-b-2xl border-l border-r border-b border-card-border bg-white flex flex-col items-center w-full px-[12px] py-[10px]">
                {orgs.slice(0, 3).map((org, i) => (
                  <button
                    key={org.name + i}
                    className="px-[1.25rem] py-[0.75rem] text-body-4 hover:bg-card-hover rounded-2xl! transition-all duration-300 text-text-secondary! hover:text-text-primary! w-full truncate"
                    onClick={() => handleOrgClick(org._id?.toString() || org.name)}
                  >
                    {org.name}
                  </button>
                ))}
                <Link
                  href={'/organizations'}
                  onClick={() => setSelectOrg(false)}
                  className="text-text-brand px-[1.25rem] py-[0.75rem] text-body-4 text-center w-full hover:bg-card-hover rounded-2xl! transition-all duration-300"
                >
                  View all
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        {!hideSearch && (
          <Search
            value={query}
            setSearch={setQuery}
            className={'lg:flex hidden'}
            placeholder={getSearchPlaceholder()}
          />
        )}
        <button
          type="button"
          onClick={openUniversalSearch}
          className="hidden lg:flex h-12 items-center gap-2 rounded-2xl! border border-input-border-default bg-white px-3.5 text-body-4 text-text-secondary hover:border-input-border-active hover:text-text-brand hover:bg-brand-100/40 transition-all duration-200"
          aria-label="Open universal search"
        >
          <span className="rounded-md border border-card-border bg-white px-1.5 py-0.5 text-caption-1 leading-none">
            ⌘
          </span>
          <span className="text-caption-1 text-text-secondary/70">/</span>
          <span className="rounded-md border border-card-border bg-white px-1.5 py-0.5 text-caption-1 leading-none">
            Ctrl
          </span>
          <span className="text-caption-1 text-text-secondary/70">+</span>
          <span className="rounded-md border border-card-border bg-white px-1.5 py-0.5 text-caption-1 leading-none">
            K
          </span>
        </button>

        <MdNotificationsActive color="#302f2e" size={22} style={{ cursor: 'pointer' }} />

        <div className="relative hidden lg:flex" ref={profileDropdownRef}>
          <button
            className={`flex items-center gap-2 w-[200px] justify-between px-6 py-2 ${selectProfile ? 'border border-card-border! rounded-t-2xl!' : 'border-white! border'}`}
            onClick={() => setSelectProfile((e) => !e)}
          >
            <Image
              src={getSafeImageUrl(profile?.personalDetails?.profilePictureUrl, 'person')}
              alt="Logo"
              height={32}
              width={32}
              className="rounded-full object-cover h-8 min-w-8 max-h-8"
            />
            <div className="text-black-text text-body-4 flex-1 truncate">
              {attributes?.given_name + ' ' + attributes?.family_name}
            </div>
            <FaCaretDown
              size={20}
              className={`text-black-text transition-transform cursor-pointer`}
            />
          </button>
          {selectProfile && (
            <div className="absolute top-[100%] left-0 rounded-b-2xl border-l border-r border-b border-card-border bg-white flex flex-col items-center w-full px-[12px] py-[10px]">
              <Link
                href={isDev ? '/developers/settings' : '/settings'}
                onClick={() => setSelectProfile(false)}
                className="text-center px-[1.25rem] py-[0.75rem] text-body-4 w-full text-text-secondary! hover:bg-card-hover rounded-2xl! transition-all duration-300"
              >
                Settings
              </Link>
              {!isDev && merckEnabled && (
                <Link
                  href="/integrations/merck-manuals"
                  onClick={() => setSelectProfile(false)}
                  className="text-center px-[1.25rem] py-[0.75rem] text-body-4 w-full text-text-secondary! hover:bg-card-hover rounded-2xl! transition-all duration-300"
                >
                  Merck Manuals
                </Link>
              )}
              {!isDev && (
                <Link
                  href="/guides"
                  onClick={() => setSelectProfile(false)}
                  className="text-center px-[1.25rem] py-[0.75rem] text-body-4 w-full text-text-secondary! hover:bg-card-hover rounded-2xl! transition-all duration-300"
                >
                  Guides
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="px-[1.25rem] py-[0.75rem] text-body-4 w-full text-text-error hover:bg-card-hover rounded-2xl! transition-all duration-300"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        <HamburgerMenuButton menuOpen={menuOpen} onClick={toggleMenu} />
      </div>
    </div>
  );
};

export default UserHeader;
