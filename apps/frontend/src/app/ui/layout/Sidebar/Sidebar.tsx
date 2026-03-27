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
import { useLoadSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { appRoutes, devRoutes } from '@/app/config/routes';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { hasAnyRequiredPermission } from '@/app/lib/routePermissions';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

import './Sidebar.css';

const SIDEBAR_COLLAPSED_KEY = 'yc_sidebar_collapsed';

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

const Sidebar = () => {
  useLoadSpecialitiesForPrimaryOrg();
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isDevPortal = pathname?.startsWith('/developers') || false;
  const routes = isDevPortal ? devRoutes : appRoutes;

  const orgStatus = useOrgStore((s) => s.status);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrg = usePrimaryOrg();
  const membership = useOrgStore((s) =>
    primaryOrgId ? (s.membershipsByOrgId?.[primaryOrgId] ?? null) : null
  );
  const effectivePermissions = membership?.effectivePermissions ?? [];

  useEffect(() => {
    try {
      setIsCollapsed(globalThis.window?.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      setIsCollapsed(false);
    }
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
      try {
        globalThis.window?.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore persistence errors
      }
      return next;
    });
  };

  const isInitialLoading = orgStatus !== 'loaded';
  const authenticatedLogoHref = isDevPortal ? '/developers/home' : '/dashboard';

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
        >
          <Image
            src={MEDIA_SOURCES.logo}
            alt="Logo"
            width={isCollapsed ? 68 : 90}
            height={isCollapsed ? 64 : 83}
            priority
          />
        </Link>
      </div>
      <div className="sidebar-routes">
        {routes.map((route) => {
          const needsVerifiedOrg = route.verify;
          const hasRoutePermission = hasAnyRequiredPermission(
            effectivePermissions,
            route.requiredAnyPermissions
          );
          // Developer portal routes don't need org verification
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

          const routeContent = (
            <>{!isCollapsed && <span className="route-label">{route.name}</span>}</>
          );

          const routeClassName = `route ${isActive ? 'route-active' : ''} ${isDisabled ? 'route-disabled' : ''}`;

          if (isCollapsed) {
            return (
              <GlassTooltip
                key={route.name}
                content={route.name}
                side="right"
                className="sidebar-route-tooltip"
              >
                <Link className={routeClassName} href={route.href} onClick={onClick}>
                  <span className="route-collapsed-icon-wrap">{routeIcon}</span>
                </Link>
              </GlassTooltip>
            );
          }

          return (
            <Link key={route.name} className={routeClassName} href={route.href} onClick={onClick}>
              {routeContent}
            </Link>
          );
        })}
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
