import React, { useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { IconType } from 'react-icons';
import {
  IoBookOutline,
  IoBusinessOutline,
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoCubeOutline,
  IoExtensionPuzzleOutline,
  IoGitNetworkOutline,
  IoGlobeOutline,
  IoGridOutline,
  IoKeyOutline,
  IoListOutline,
  IoPaw,
  IoWalletOutline,
} from 'react-icons/io5';

import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useLoadSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { appRoutes, devRoutes } from '@/app/config/routes';
import type { RouteItem } from '@/app/config/routes';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { hasAnyRequiredPermission, resolveMembershipPermissions } from '@/app/lib/routePermissions';
import {
  isSidebarCollapsedByDefault,
  setSidebarCollapsedPreference,
} from '@/app/lib/sidebarPreference';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { resolveDefaultOpenScreenRouteForProfile } from '@/app/lib/defaultOpenScreen';
import { useIsTabletRail } from './useIsTabletRail';

import './Sidebar.css';
import { usePlatformStatus } from '@/app/hooks/usePlatformStatus';
import { useLocalGuardBypass } from '@/app/lib/localGuardBypass';

const ROUTE_ICONS: Record<string, IconType> = {
  Dashboard: IoGridOutline,
  Organization: IoBusinessOutline,
  Appointments: IoCalendarOutline,
  Tasks: IoListOutline,
  Chat: IoChatbubbleEllipsesOutline,
  Finance: IoWalletOutline,
  Companions: IoPaw,
  Inventory: IoCubeOutline,
  Integrations: IoGitNetworkOutline,
  Network: IoGlobeOutline,
  Templates: IoBookOutline,
  'API Keys': IoKeyOutline,
  Billing: IoWalletOutline,
  'Website - Builder': IoGlobeOutline,
  Plugins: IoExtensionPuzzleOutline,
  Documentation: IoBookOutline,
};

const APP_ROUTE_GROUPS = [
  { label: 'Overview', routeNames: ['Dashboard'] },
  { label: 'Schedule & Work', routeNames: ['Appointments', 'Tasks', 'Chat'] },
  { label: 'Clients & Records', routeNames: ['Companions', 'Templates'] },
  { label: 'Business', routeNames: ['Finance', 'Inventory'] },
  { label: 'Administration', routeNames: ['Organization', 'Integrations', 'Network'] },
] as const;

const DEV_ROUTE_GROUPS = [
  { label: 'Developer', routeNames: ['Dashboard', 'API Keys', 'Billing', 'Website - Builder'] },
  { label: 'Platform', routeNames: ['Plugins', 'Documentation'] },
] as const;

const groupRoutes = (
  routes: RouteItem[],
  groups: readonly { label: string; routeNames: readonly string[] }[]
) =>
  groups.reduce<Array<{ label: string; routes: RouteItem[] }>>((visibleGroups, group) => {
    const groupRoutes = group.routeNames.reduce<RouteItem[]>((items, routeName) => {
      const route = routes.find((item) => item.name === routeName);
      if (route) items.push(route);
      return items;
    }, []);
    if (groupRoutes.length > 0) visibleGroups.push({ label: group.label, routes: groupRoutes });
    return visibleGroups;
  }, []);

// localStorage is the source of truth for the collapse preference. It used to be
// seeded into `useState(() => isSidebarCollapsedByDefault())`, which reads
// localStorage and window.innerWidth while rendering, so the server rendered the
// expanded sidebar and the first client render could disagree. Reading it through
// useSyncExternalStore gives the server an explicit "expanded" snapshot - what the
// helper returns with no window - and applies the real value during the commit,
// before paint, so a tablet never flashes the 224px sidebar.
const collapsePreferenceListeners = new Set<() => void>();

const subscribeCollapsePreference = (onStoreChange: () => void) => {
  collapsePreferenceListeners.add(onStoreChange);
  return () => {
    collapsePreferenceListeners.delete(onStoreChange);
  };
};

const getServerCollapsePreference = () => false;

const Sidebar = () => {
  useLoadSpecialitiesForPrimaryOrg();
  const pathname = usePathname();
  const router = useRouter();
  const prefersCollapsed = useSyncExternalStore(
    subscribeCollapsePreference,
    isSidebarCollapsedByDefault,
    getServerCollapsePreference
  );
  // Tablet is always the icon rail, so it overrides a stored desktop preference
  // (which would otherwise render the 224px sidebar after a desktop -> tablet resize).
  const isTabletRail = useIsTabletRail();
  const platformStatus = usePlatformStatus();
  const isCollapsed = isTabletRail || prefersCollapsed;

  const isDevPortal = pathname?.startsWith('/developers') || false;
  const routes = isDevPortal ? devRoutes : appRoutes;
  const groupedRoutes = groupRoutes(routes, isDevPortal ? DEV_ROUTE_GROUPS : APP_ROUTE_GROUPS);

  const orgStatus = useOrgStore((s) => s.status);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrg = usePrimaryOrg();
  const profile = useUserProfileStore((s) =>
    primaryOrgId ? (s.profilesByOrgId[primaryOrgId] ?? null) : null
  );
  const membership = useOrgStore((s) =>
    primaryOrgId ? (s.membershipsByOrgId?.[primaryOrgId] ?? null) : null
  );
  const effectivePermissions = resolveMembershipPermissions(membership);

  const routeIcons = useMemo(() => ROUTE_ICONS, []);

  const handleClick = (item: any) => {
    if (pathname === item.href) {
      stopRouteLoader();
      return;
    }
    startRouteLoader();
    router.push(item.href);
  };

  const handleToggleCollapse = () => {
    // Write the store, then wake every subscriber so the snapshot is re-read. This
    // used to persist from inside a setState updater, which must stay pure.
    setSidebarCollapsedPreference(!prefersCollapsed);
    collapsePreferenceListeners.forEach((listener) => listener());
  };

  // Skip the org-data loading gate on localhost with NEXT_PUBLIC_DISABLE_AUTH_GUARD so
  // the nav renders for UI/styling work without a session. The shared helper
  // enforces the localhost part, which a direct env read did not.
  const authGuardDisabled = useLocalGuardBypass();
  const isInitialLoading = orgStatus !== 'loaded' && !authGuardDisabled;
  const currentRole = membership?.roleDisplay ?? membership?.roleCode;
  const authenticatedLogoHref = isDevPortal
    ? '/developers/home'
    : resolveDefaultOpenScreenRouteForProfile({
        profile,
        orgType: primaryOrg?.type,
        role: currentRole ?? 'owner',
      });

  // Developer portal doesn't need org data to load
  if (isInitialLoading && !isDevPortal) return <div className="sidebar"></div>;

  // A deactivated mapping counts as no org: an empty permission set alone would
  // still leave routes that declare no required permission reachable.
  const orgMissing = !primaryOrg || membership?.active === false;
  const orgVerified = !!primaryOrg?.isVerified;

  return (
    <div
      className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''} ${isDevPortal ? 'sidebar-dev' : ''}`}
    >
      <div className={`sidebar-top ${isCollapsed ? 'sidebar-top-collapsed' : ''}`}>
        <Link
          href={authenticatedLogoHref}
          className={`logo ${isCollapsed ? 'logo-collapsed' : ''}`}
          aria-label="Yosemite Crew dashboard"
        >
          <Image src="/icon.svg" alt="Yosemite Crew" width={40} height={40} priority />
          {/* The mark alone carries the brand here; the link keeps its aria-label
              so the accessible name survives dropping the wordmark. */}
          {!isCollapsed && isDevPortal && (
            <span className="sidebar-wordmark-group">
              <span className="sidebar-dev-sublabel">Developers</span>
            </span>
          )}
        </Link>
      </div>
      <div className="sidebar-routes">
        {groupedRoutes.map((group) => (
          <div className="sidebar-route-group" key={group.label}>
            {!isCollapsed && <div className="sidebar-route-group-label">{group.label}</div>}
            <div className="sidebar-route-group-items">
              {group.routes.map((route) => {
                const needsVerifiedOrg = route.verify;
                const hasRoutePermission = hasAnyRequiredPermission(
                  effectivePermissions,
                  route.requiredAnyPermissions
                );
                const isDisabled = isDevPortal
                  ? false
                  : route.name !== 'Sign out' &&
                    route.name !== 'Settings' &&
                    (orgMissing || (needsVerifiedOrg && !orgVerified) || !hasRoutePermission);

                const isActive = pathname === route.href;
                /* v8 ignore next -- every route name in APP_ROUTE_GROUPS/DEV_ROUTE_GROUPS maps to an entry in ROUTE_ICONS, so the IoBookOutline fallback is unreachable */
                const RouteIcon = routeIcons[route.name] || IoBookOutline;

                const onClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
                  e.preventDefault();
                  if (isDisabled) return;
                  handleClick(route);
                };

                const routeIcon = (
                  <span className="route-icon" aria-hidden>
                    <RouteIcon size={17} className="route-icon-svg" />
                  </span>
                );

                const routeClassName = `route ${isActive ? 'route-active' : ''} ${isDisabled ? 'route-disabled' : ''}`;

                if (isCollapsed) {
                  return (
                    <GlassTooltip
                      key={route.name}
                      content={`${group.label}: ${route.name}`}
                      side="right"
                      className="sidebar-route-tooltip"
                    >
                      <Link
                        className={routeClassName}
                        href={route.href}
                        prefetch={false}
                        onClick={onClick}
                        aria-current={isActive ? 'page' : undefined}
                        aria-disabled={isDisabled || undefined}
                        tabIndex={isDisabled ? -1 : undefined}
                      >
                        <span className="sr-only">{route.name}</span>
                        <span className="route-collapsed-icon-wrap">{routeIcon}</span>
                      </Link>
                    </GlassTooltip>
                  );
                }

                return (
                  <Link
                    key={route.name}
                    className={routeClassName}
                    href={route.href}
                    // Every sidebar route is permanently in the viewport, so the
                    // App Router's default viewport prefetch fired an RSC request
                    // for ALL of them on mount. Measured on dev: five of those
                    // (/appointments, /chat, /tasks, /dashboard, /companions) took
                    // 3.0-3.8s EACH and ran concurrently with the page's own data,
                    // against a ~6-connection-per-origin cap - so the page you had
                    // actually opened queued behind prefetches for pages you had
                    // not. prefetch={false} drops the viewport prefetch; Next still
                    // prefetches on hover, which is the point of intent anyway.
                    prefetch={false}
                    onClick={onClick}
                    aria-current={isActive ? 'page' : undefined}
                    // A disabled route was disabled to the EYE only - greyed, with
                    // cursor:not-allowed and a click handler that returns early -
                    // while still being a focusable link announced as actionable.
                    // An unverified org's Patients entry could be tabbed to and
                    // read out as a normal destination it can never reach.
                    aria-disabled={isDisabled || undefined}
                    tabIndex={isDisabled ? -1 : undefined}
                  >
                    {routeIcon}
                    <span className="route-label">{route.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        {!isCollapsed && (
          <span className={`sidebar-status sidebar-status-${platformStatus.tone}`}>
            <span className="sidebar-status-dot" aria-hidden />
            {platformStatus.label}
          </span>
        )}
        {/* Tablet is locked to the rail by the breakpoint contract, so there is
            nothing to toggle between there. */}
        {!isTabletRail && (
          <GlassTooltip
            content={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            side={isCollapsed ? 'right' : 'top'}
          >
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="sidebar-collapse-btn"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <IoChevronForwardOutline size={17} />
              ) : (
                <IoChevronBackOutline size={17} />
              )}
            </button>
          </GlassTooltip>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
