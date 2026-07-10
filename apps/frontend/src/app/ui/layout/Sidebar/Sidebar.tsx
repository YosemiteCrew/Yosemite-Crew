import React, { useEffect, useMemo, useState } from 'react';
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
import { hasAnyRequiredPermission } from '@/app/lib/routePermissions';
import {
  isSidebarCollapsedByDefault,
  setSidebarCollapsedPreference,
} from '@/app/lib/sidebarPreference';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { resolveDefaultOpenScreenRouteForProfile } from '@/app/lib/defaultOpenScreen';

import './Sidebar.css';

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
  Templates: IoBookOutline,
  'API Keys': IoKeyOutline,
  'Website - Builder': IoGlobeOutline,
  Plugins: IoExtensionPuzzleOutline,
  Documentation: IoBookOutline,
};

const APP_ROUTE_GROUPS = [
  { label: 'Overview', routeNames: ['Dashboard'] },
  { label: 'Schedule & Work', routeNames: ['Appointments', 'Tasks', 'Chat'] },
  { label: 'Clients & Records', routeNames: ['Companions', 'Templates'] },
  { label: 'Business', routeNames: ['Finance', 'Inventory'] },
  { label: 'Administration', routeNames: ['Organization', 'Integrations'] },
] as const;

const DEV_ROUTE_GROUPS = [
  { label: 'Developer', routeNames: ['Dashboard', 'API Keys', 'Website - Builder'] },
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

const Sidebar = () => {
  useLoadSpecialitiesForPrimaryOrg();
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(true);

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
  const effectivePermissions = membership?.effectivePermissions ?? [];

  useEffect(() => {
    setIsCollapsed(isSidebarCollapsedByDefault());
  }, []);

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
    setIsCollapsed((prev) => {
      const next = !prev;
      setSidebarCollapsedPreference(next);
      return next;
    });
  };

  // Skip the org-data loading gate on localhost with NEXT_PUBLIC_DISABLE_AUTH_GUARD so
  // the nav renders for UI/styling work without a session. No effect when deployed.
  const authGuardDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD === 'true';
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

  const orgMissing = !primaryOrg;
  const orgVerified = !!primaryOrg?.isVerified;

  return (
    <div className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className={`sidebar-top ${isCollapsed ? 'sidebar-top-collapsed' : ''}`}>
        <Link
          href={authenticatedLogoHref}
          className={`logo ${isCollapsed ? 'logo-collapsed' : ''}`}
          aria-label="Yosemite Crew dashboard"
        >
          <Image src="/icon.svg" alt="Yosemite Crew" width={30} height={30} priority />
          {!isCollapsed && <span className="sidebar-wordmark">Yosemite Crew</span>}
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
                        onClick={onClick}
                        aria-current={isActive ? 'page' : undefined}
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
                    onClick={onClick}
                    aria-current={isActive ? 'page' : undefined}
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
          <span className="sidebar-status">
            <span className="sidebar-status-dot" aria-hidden />
            All systems live
          </span>
        )}
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
      </div>
    </div>
  );
};

export default Sidebar;
