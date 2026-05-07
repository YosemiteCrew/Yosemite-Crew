import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MdDashboard,
  MdInventory2,
  MdNotificationsActive,
  MdOutlineChecklist,
  MdOutlineCorporateFare,
} from 'react-icons/md';
import {
  IoBookOutline,
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoExtensionPuzzleOutline,
  IoGitNetworkOutline,
  IoGlobeOutline,
  IoHelpCircleOutline,
  IoKeyOutline,
  IoLogOutOutline,
  IoSettingsOutline,
  IoWalletOutline,
} from 'react-icons/io5';
import { FaPaw, FaCaretDown } from 'react-icons/fa6';
import { usePathname, useRouter } from 'next/navigation';
import { useSignOut } from '@/app/hooks/useAuth';

import { useOrgStore } from '@/app/stores/orgStore';
import { useOrgList, usePrimaryOrg } from '@/app/hooks/useOrgSelectors';

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
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { resolveDefaultOpenScreenRouteForProfile } from '@/app/lib/defaultOpenScreen';
import './UserHeader.css';

const ROUTE_ICONS = {
  Dashboard: MdDashboard,
  Organization: MdOutlineCorporateFare,
  Appointments: IoCalendarOutline,
  Tasks: MdOutlineChecklist,
  Chat: IoChatbubbleEllipsesOutline,
  Finance: IoWalletOutline,
  Companions: FaPaw,
  Inventory: MdInventory2,
  Integrations: IoGitNetworkOutline,
  Templates: IoBookOutline,
  'API Keys': IoKeyOutline,
  'Website - Builder': IoGlobeOutline,
  Plugins: IoExtensionPuzzleOutline,
  Documentation: IoBookOutline,
  Settings: IoSettingsOutline,
  Guides: IoHelpCircleOutline,
  'MSD Veterinary Manual': IoBookOutline,
  'Sign out': IoLogOutOutline,
} as const;

const APP_MOBILE_ROUTE_GROUPS = [
  { label: 'Overview', routeNames: ['Dashboard'] },
  { label: 'Schedule & Work', routeNames: ['Appointments', 'Tasks', 'Chat'] },
  { label: 'Clients & Records', routeNames: ['Companions', 'Templates'] },
  { label: 'Business', routeNames: ['Finance', 'Inventory'] },
  { label: 'Administration', routeNames: ['Organization', 'Integrations'] },
  { label: 'Support', routeNames: ['Guides', 'MSD Veterinary Manual'] },
  { label: 'Account', routeNames: ['Settings', 'Sign out'] },
] as const;

const DEV_MOBILE_ROUTE_GROUPS = [
  { label: 'Developer', routeNames: ['Dashboard', 'API Keys', 'Website - Builder'] },
  { label: 'Platform', routeNames: ['Plugins', 'Documentation'] },
  { label: 'Account', routeNames: ['Settings', 'Sign out'] },
] as const;

const groupRoutesByName = (
  routes: typeof headerAppRoutes,
  groups: readonly { label: string; routeNames: readonly string[] }[]
) =>
  groups
    .map((group) => ({
      label: group.label,
      routes: group.routeNames
        .map((routeName) => routes.find((route) => route.name === routeName))
        .filter((route): route is (typeof routes)[number] => Boolean(route)),
    }))
    .filter((group) => group.routes.length > 0);

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
            name: 'MSD Veterinary Manual',
            href: '/integrations/merck-manuals',
            verify: true,
          });
        }
        next.splice(insertIndex, 0, { name: 'Guides', href: '/guides', verify: false });
        return next;
      })();
  const mobileRouteGroups = groupRoutesByName(
    mobileRoutes,
    isDev ? DEV_MOBILE_ROUTE_GROUPS : APP_MOBILE_ROUTE_GROUPS
  );
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
  const mobileMenuId = 'user-mobile-menu';
  const orgMenuId = 'user-header-org-menu';
  const profileMenuId = 'user-header-profile-menu';

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
    startRouteLoader();
    try {
      await signOut();
      if (globalThis.window !== undefined) {
        globalThis.localStorage.removeItem('yc_dashboard_videos_hidden');
      }
      router.replace(logoutRedirect);
    } catch (error) {
      console.error('⚠️ Cognito signout error:', error);
      stopRouteLoader();
    }
  };

  const handleOrgClick = async (orgId: string) => {
    setPrimaryOrg(orgId);
    setSelectOrg(false);
    const { show, hide } = useFullscreenLoaderStore.getState();
    show('org-switch');
    startRouteLoader();
    try {
      const role = membershipsByOrgId[orgId]?.roleDisplay ?? membershipsByOrgId[orgId]?.roleCode;
      const nextRoute = await resolveOrgScopedRedirect({ orgId, fallbackRole: role });
      router.push(nextRoute);
    } catch {
      hide('org-switch');
      stopRouteLoader();
    }
  };

  const handleMobileOrgClick = (orgId: string) => {
    setPrimaryOrg(orgId);
    setSelectOrg(false);
    setMenuOpen(false);
    const { show, hide } = useFullscreenLoaderStore.getState();
    show('org-switch');
    setTimeout(() => {
      startRouteLoader();
      const role = membershipsByOrgId[orgId]?.roleDisplay ?? membershipsByOrgId[orgId]?.roleCode;
      void resolveOrgScopedRedirect({ orgId, fallbackRole: role })
        .then((nextRoute) => {
          router.push(nextRoute);
        })
        .catch(() => {
          hide('org-switch');
          stopRouteLoader();
        });
    }, 300);
  };

  const handleClick = (item: any) => {
    setMenuOpen(false);
    if (item.name === 'Sign out') {
      handleLogout();
      return;
    }
    setTimeout(() => {
      startRouteLoader();
      router.push(item.href);
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
  const primaryOrgId = primaryOrg?._id?.toString();
  const currentMembership = primaryOrgId ? membershipsByOrgId[primaryOrgId] : null;
  const currentRole = currentMembership?.roleDisplay ?? currentMembership?.roleCode;
  // Computed client-side only to avoid SSR/client hydration mismatch — store
  // is empty on the server so the resolved href would differ from the client.
  const [authenticatedLogoHref, setAuthenticatedLogoHref] = useState('/');
  useEffect(() => {
    if (isDev) {
      setAuthenticatedLogoHref('/developers/home');
    } else {
      setAuthenticatedLogoHref(
        resolveDefaultOpenScreenRouteForProfile({
          profile,
          orgType: primaryOrg?.type,
          role: currentRole ?? 'owner',
        })
      );
    }
  }, [isDev, profile, primaryOrg?.type, currentRole]);
  const displayName =
    `${attributes?.given_name ?? ''} ${attributes?.family_name ?? ''}`.trim() || 'Account';

  return (
    <div className="yc-user-header">
      <MobileMenu
        isOpen={menuOpen}
        id={mobileMenuId}
        onClose={() => {
          setMenuOpen(false);
          setSelectOrg(false);
        }}
      >
        <div className="yc-mobile-menu-shell">
          {primaryOrg && !isDev && (
            <div className="yc-mobile-org-card" ref={orgDropdownRef}>
              <button
                type="button"
                className="yc-mobile-org-trigger"
                onClick={() => setSelectOrg((e) => !e)}
                aria-expanded={selectOrg}
                aria-controls={orgMenuId}
                aria-haspopup="menu"
              >
                <Image
                  src={getSafeImageUrl(primaryOrg.imageURL, 'business')}
                  alt=""
                  height={34}
                  width={34}
                  className="yc-header-avatar"
                />
                <span className="yc-mobile-org-copy">
                  <span className="yc-header-kicker">Organization</span>
                  <span className="yc-header-primary-text">{primaryOrg?.name}</span>
                </span>
                <FaCaretDown className={selectOrg ? 'yc-chevron-open' : ''} size={16} />
              </button>
              {selectOrg && (
                <div id={orgMenuId} className="yc-mobile-dropdown-list" role="menu">
                  {orgs.slice(0, 4).map((org) => (
                    <button
                      key={org._id?.toString() || org.name}
                      type="button"
                      className="yc-menu-row"
                      onClick={() => handleMobileOrgClick(org._id?.toString() || org.name)}
                      role="menuitem"
                    >
                      {org.name}
                    </button>
                  ))}
                  <Link
                    href="/organizations"
                    onClick={() => {
                      setSelectOrg(false);
                      setMenuOpen(false);
                    }}
                    className="yc-menu-row yc-menu-row-accent"
                    role="menuitem"
                  >
                    View all organizations
                  </Link>
                </div>
              )}
            </div>
          )}
          {mobileRouteGroups.map((group) => (
            <div className="yc-mobile-route-group" key={group.label}>
              <div className="yc-mobile-section-label">{group.label}</div>
              {group.routes.map((route) => {
                const RouteIcon =
                  ROUTE_ICONS[route.name as keyof typeof ROUTE_ICONS] ?? IoBookOutline;
                const needsVerifiedOrg = route.verify;
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
                    className={`yc-mobile-route ${isActive ? 'yc-mobile-route-active' : ''} ${isDisabled ? 'yc-mobile-route-disabled' : ''}`}
                  >
                    <span className="yc-mobile-route-icon" aria-hidden>
                      <RouteIcon size={18} />
                    </span>
                    <span className="yc-mobile-route-label">{route.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </MobileMenu>

      <div className="yc-header-mobile-brand">
        <Link href={authenticatedLogoHref} className="yc-header-logo-link">
          <Image
            src={MEDIA_SOURCES.logo}
            alt="Logo"
            width={86}
            height={56}
            priority
            fetchPriority="high"
          />
        </Link>
      </div>
      <div className="yc-header-left">
        {primaryOrg && !isDev && (
          <div className="yc-header-dropdown-wrap" ref={orgDropdownRef}>
            <button
              type="button"
              className={`yc-header-org-trigger ${selectOrg ? 'yc-header-trigger-open' : ''}`}
              onClick={() => setSelectOrg((e) => !e)}
              aria-expanded={selectOrg}
              aria-controls={orgMenuId}
              aria-haspopup="menu"
            >
              <Image
                src={getSafeImageUrl(primaryOrg.imageURL, 'business')}
                alt=""
                height={34}
                width={34}
                className="yc-header-avatar"
              />
              <span className="yc-header-trigger-copy">
                <span className="yc-header-kicker">Organization</span>
                <span className="yc-header-primary-text">{primaryOrg?.name}</span>
              </span>
              <FaCaretDown className={selectOrg ? 'yc-chevron-open' : ''} size={15} />
            </button>
            {selectOrg && (
              <div
                id={orgMenuId}
                className="yc-header-dropdown-panel"
                role="menu"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSelectOrg(false);
                  }
                }}
              >
                <div className="yc-header-dropdown-title">Switch organization</div>
                {orgs.slice(0, 4).map((org) => (
                  <button
                    key={org._id?.toString() || org.name}
                    type="button"
                    className="yc-menu-row"
                    onClick={() => handleOrgClick(org._id?.toString() || org.name)}
                    role="menuitem"
                  >
                    {org.name}
                  </button>
                ))}
                <Link
                  href="/organizations"
                  onClick={() => setSelectOrg(false)}
                  className="yc-menu-row yc-menu-row-accent"
                  role="menuitem"
                >
                  View all organizations
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="yc-header-actions">
        {!hideSearch && (
          <Search
            value={query}
            setSearch={setQuery}
            className="yc-header-search"
            placeholder={getSearchPlaceholder()}
          />
        )}
        <button
          type="button"
          onClick={openUniversalSearch}
          className="yc-command-button"
          aria-label="Open universal search"
        >
          <span className="yc-command-key">⌘</span>
          <span className="yc-command-divider">/</span>
          <span className="yc-command-key">Ctrl</span>
          <span className="yc-command-divider">+</span>
          <span className="yc-command-key">K</span>
        </button>

        <button type="button" className="yc-icon-button" aria-label="Notifications">
          <MdNotificationsActive size={19} />
        </button>

        <div className="yc-profile-wrap" ref={profileDropdownRef}>
          <button
            type="button"
            className={`yc-profile-trigger ${selectProfile ? 'yc-header-trigger-open' : ''}`}
            onClick={() => setSelectProfile((e) => !e)}
            aria-expanded={selectProfile}
            aria-controls={profileMenuId}
            aria-haspopup="menu"
          >
            <Image
              src={getSafeImageUrl(profile?.personalDetails?.profilePictureUrl, 'person')}
              alt=""
              height={34}
              width={34}
              className="yc-header-avatar"
            />
            <span className="yc-profile-name">{displayName}</span>
            <FaCaretDown className={selectProfile ? 'yc-chevron-open' : ''} size={15} />
          </button>
          {selectProfile && (
            <div
              id={profileMenuId}
              className="yc-header-dropdown-panel yc-profile-panel"
              role="menu"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSelectProfile(false);
                }
              }}
            >
              <div className="yc-header-dropdown-title">Account</div>
              <Link
                href={isDev ? '/developers/settings' : '/settings'}
                onClick={() => setSelectProfile(false)}
                className="yc-menu-row"
                role="menuitem"
              >
                <IoSettingsOutline size={16} className="yc-menu-row-icon" aria-hidden />
                Settings
              </Link>
              {!isDev && merckEnabled && orgVerified && (
                <Link
                  href="/integrations/merck-manuals"
                  onClick={() => setSelectProfile(false)}
                  className="yc-menu-row"
                  role="menuitem"
                >
                  <IoBookOutline size={16} className="yc-menu-row-icon" aria-hidden />
                  MSD Veterinary Manual
                </Link>
              )}
              {!isDev && (
                <Link
                  href="/guides"
                  onClick={() => setSelectProfile(false)}
                  className="yc-menu-row"
                  role="menuitem"
                >
                  <IoHelpCircleOutline size={16} className="yc-menu-row-icon" aria-hidden />
                  Guides
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="yc-menu-row yc-menu-row-danger"
                role="menuitem"
              >
                <IoLogOutOutline size={16} className="yc-menu-row-icon" aria-hidden />
                Sign out
              </button>
            </div>
          )}
        </div>

        <HamburgerMenuButton menuOpen={menuOpen} onClick={toggleMenu} controlsId={mobileMenuId} />
      </div>
    </div>
  );
};

export default UserHeader;
