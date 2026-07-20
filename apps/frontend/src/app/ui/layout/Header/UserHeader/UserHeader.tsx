import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IoBookOutline,
  IoCaretDown,
  IoHelpCircleOutline,
  IoLogOutOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import { usePathname, useRouter } from 'next/navigation';
import { useSignOut } from '@/app/hooks/useAuth';
import { useHasMounted } from '@/app/hooks/useHasMounted';
import { removeStorageItem } from '@/app/lib/browserStorage';

import { useOrgStore } from '@/app/stores/orgStore';
import { useOrgList, usePrimaryOrg } from '@/app/hooks/useOrgSelectors';

import { useAuthStore } from '@/app/stores/authStore';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import Image from 'next/image';
import { getSafeImageUrl } from '@/app/lib/urls';
import Search from '@/app/ui/inputs/Search';
import { useSearchStore } from '@/app/stores/searchStore';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { ThemeToggle } from '@/app/ui/theme';
import NotificationsBell from '@/app/ui/layout/Notifications/NotificationsBell';
import './UserHeader.css';

/**
 * RouteLoaderOverlay releases the org-switch loader when the pathname or query
 * changes. Pushing the route we are already on fires neither, so callers have to
 * release it themselves.
 */
const isCurrentRoute = (route: string) => {
  const next = new URL(route, globalThis.window.location.origin);
  return (
    next.pathname === globalThis.window.location.pathname &&
    next.search === globalThis.window.location.search
  );
};

const shouldHideSearch = (pathname: string): boolean =>
  pathname.startsWith('/chat') ||
  pathname.startsWith('/settings') ||
  (pathname.startsWith('/organization') && !pathname.startsWith('/organization/specialities')) ||
  pathname.startsWith('/organizations') ||
  pathname.startsWith('/dashboard') ||
  pathname.startsWith('/guides') ||
  pathname.startsWith('/inventory') ||
  (pathname.startsWith('/integrations') && !pathname.startsWith('/integrations/idexx-workspace'));

const getSearchPlaceholder = (
  pathname: string,
  terminologyText: (s: string) => string,
  useOrgTerminology: boolean
): string => {
  if (pathname.startsWith('/appointments/idexx-workspace')) return 'Search result / order';
  if (pathname.startsWith('/appointments')) return 'Search appointments';
  if (pathname.startsWith('/inventory')) return 'Search inventory';
  if (pathname.startsWith('/integrations/idexx-workspace')) return 'Search result / order';
  if (pathname.startsWith('/integrations')) return 'Search integrations';
  if (pathname.startsWith('/forms')) return 'Search forms';
  if (pathname.startsWith('/companions')) {
    return useOrgTerminology ? terminologyText('Search companions') : 'Search companions';
  }
  if (pathname.startsWith('/tasks')) return 'Search tasks';
  if (pathname.startsWith('/finance')) return 'Search invoices';
  if (pathname.startsWith('/organization/specialities')) return 'Search specialities';
  return 'Search';
};

const CLOSED_MENUS = { selectOrg: false, selectProfile: false };

const useUserHeaderContent = () => {
  const terminologyText = useCompanionTerminologyText();
  const { signOut } = useSignOut();
  const pathname = usePathname();
  const router = useRouter();
  const attributes = useAuthStore((s) => s.attributes);
  const profile = usePrimaryOrgProfile();
  const [openMenus, setOpenMenus] = useState(CLOSED_MENUS);
  const { selectOrg, selectProfile } = openMenus;
  const setSelectOrg = (value: boolean | ((prev: boolean) => boolean)) =>
    setOpenMenus((m) => ({
      ...m,
      selectOrg: typeof value === 'function' ? value(m.selectOrg) : value,
    }));
  const setSelectProfile = (value: boolean | ((prev: boolean) => boolean)) =>
    setOpenMenus((m) => ({
      ...m,
      selectProfile: typeof value === 'function' ? value(m.selectProfile) : value,
    }));
  const mounted = useHasMounted();
  const isDev = pathname.startsWith('/developers');
  const { isEnabled: merckEnabled } = useResolvedMerckIntegrationForPrimaryOrg();
  const orgs = useOrgList();
  const primaryOrg = usePrimaryOrg();
  const setPrimaryOrg = useOrgStore((s) => s.setPrimaryOrg);
  const membershipsByOrgId = useOrgStore((s) => s.membershipsByOrgId);
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const clear = useSearchStore((s) => s.clear);
  const desktopOrgDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const orgMenuId = 'user-header-org-menu';
  const profileMenuId = 'user-header-profile-menu';

  const logoutRedirect = pathname.startsWith('/developers') ? '/developers/signin' : '/signin';
  // Reset transient header UI when the route changes. Menus reset during
  // render (local state); `clear()` mutates the external search store, so it
  // must run in an effect — calling a store setter during render updates other
  // store subscribers mid render and triggers React's "Cannot update a
  // component while rendering a different component" warning.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpenMenus(CLOSED_MENUS);
  }
  useEffect(() => {
    clear();
  }, [pathname, clear]);

  const handleLogout = async () => {
    startRouteLoader();
    try {
      await signOut();
      removeStorageItem('local', 'yc_dashboard_videos_hidden');
      router.replace(logoutRedirect);
    } catch (error) {
      console.error('⚠️ Signout error:', error);
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
      if (isCurrentRoute(nextRoute)) {
        hide('org-switch');
        stopRouteLoader();
      }
    } catch {
      hide('org-switch');
      stopRouteLoader();
    }
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
      const target = event.target as Node;
      const clickedInsideDesktopOrgMenu = desktopOrgDropdownRef.current?.contains(target) ?? false;
      if (!clickedInsideDesktopOrgMenu) {
        setSelectOrg(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const orgVerified = !!primaryOrg?.isVerified;

  const searchPlaceholder = getSearchPlaceholder(pathname, terminologyText, mounted);

  const hideSearch = shouldHideSearch(pathname);
  const displayName =
    `${attributes?.given_name ?? ''} ${attributes?.family_name ?? ''}`.trim() || 'Account';

  return (
    <div className="yc-user-header">
      <div className="yc-header-left">
        {primaryOrg && !isDev && (
          <div className="yc-header-dropdown-wrap" ref={desktopOrgDropdownRef}>
            <button
              type="button"
              className={`yc-header-org-trigger ${selectOrg ? 'yc-header-trigger-open' : ''}`}
              onClick={() => setSelectOrg((e) => !e)}
              aria-expanded={selectOrg}
              aria-controls={orgMenuId}
              aria-haspopup="menu"
            >
              {/* The design's org chip is a --blue-soft monogram; the logo image
                  is only used when the organization actually carries one. */}
              {primaryOrg.imageURL ? (
                <Image
                  src={getSafeImageUrl(primaryOrg.imageURL, 'business')}
                  alt=""
                  height={32}
                  width={32}
                  className="yc-header-avatar"
                />
              ) : (
                <span className="yc-header-org-chip" aria-hidden>
                  {primaryOrg.name.trim().charAt(0) || 'O'}
                </span>
              )}
              <span className="yc-header-trigger-copy">
                <span className="yc-header-kicker">Organization</span>
                <span className="yc-header-primary-text">{primaryOrg?.name}</span>
              </span>
              <IoCaretDown className={selectOrg ? 'yc-chevron-open' : ''} size={11} />
            </button>
            {selectOrg && (
              <div
                id={orgMenuId}
                className="yc-header-dropdown-panel"
                role="menu"
                tabIndex={-1}
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
            placeholder={searchPlaceholder}
          />
        )}
        <ThemeToggle />

        <NotificationsBell />

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
              height={30}
              width={30}
              className="yc-header-avatar"
            />
            <span className="yc-profile-name">{displayName}</span>
            <IoCaretDown className={selectProfile ? 'yc-chevron-open' : ''} size={10} />
          </button>
          {selectProfile && (
            <div
              id={profileMenuId}
              className="yc-header-dropdown-panel yc-profile-panel"
              role="menu"
              tabIndex={-1}
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
      </div>
    </div>
  );
};

const UserHeader = () => useUserHeaderContent();

export default UserHeader;
