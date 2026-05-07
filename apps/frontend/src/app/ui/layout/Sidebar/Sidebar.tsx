import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { IconType } from 'react-icons';
import {
  IoBookOutline,
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoExtensionPuzzleOutline,
  IoGitNetworkOutline,
  IoGlobeOutline,
  IoKeyOutline,
  IoWalletOutline,
} from 'react-icons/io5';
import {
  MdDashboard,
  MdInventory2,
  MdOutlineChecklist,
  MdOutlineCorporateFare,
  MdOutlineKeyboardDoubleArrowLeft,
  MdOutlineKeyboardDoubleArrowRight,
} from 'react-icons/md';
import { FaPaw } from 'react-icons/fa6';

import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useLoadSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { appRoutes, devRoutes } from '@/app/config/routes';
import type { RouteItem } from '@/app/config/routes';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
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
  groups
    .map((group) => ({
      label: group.label,
      routes: group.routeNames
        .map((routeName) => routes.find((route) => route.name === routeName))
        .filter((route): route is RouteItem => Boolean(route)),
    }))
    .filter((group) => group.routes.length > 0);

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

  const isInitialLoading = orgStatus !== 'loaded';
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
          <Image
            src={MEDIA_SOURCES.logo}
            alt="Yosemite Crew"
            width={isCollapsed ? 68 : 90}
            height={isCollapsed ? 64 : 83}
            priority
          />
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
                    <RouteIcon size={18} className="route-icon-svg" />
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
        <GlassTooltip
          content={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          side={isCollapsed ? 'right' : 'top'}
          className="sidebar-route-tooltip"
        >
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="sidebar-collapse-btn"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <MdOutlineKeyboardDoubleArrowRight size={21} />
            ) : (
              <MdOutlineKeyboardDoubleArrowLeft size={21} />
            )}
          </button>
        </GlassTooltip>
      </div>
    </div>
  );
};

export default Sidebar;
