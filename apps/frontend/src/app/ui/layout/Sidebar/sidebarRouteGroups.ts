import type { IconType } from 'react-icons';
import {
  IoBookOutline,
  IoBusinessOutline,
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoCodeSlashOutline,
  IoCubeOutline,
  IoExtensionPuzzleOutline,
  IoFlaskOutline,
  IoGitNetworkOutline,
  IoGlobeOutline,
  IoGridOutline,
  IoKeyOutline,
  IoListOutline,
  IoPaw,
  IoWalletOutline,
} from 'react-icons/io5';

import type { RouteItem } from '@/app/config/routes';

/**
 * Sidebar route configuration, kept out of `Sidebar.tsx` so that file only
 * exports the component: Fast Refresh cannot preserve state across a module
 * that also exports plain values. Same split as `phoneShellConfig.ts`.
 */

export const ROUTE_ICONS: Record<string, IconType> = {
  Dashboard: IoGridOutline,
  Organization: IoBusinessOutline,
  Appointments: IoCalendarOutline,
  Tasks: IoListOutline,
  Chat: IoChatbubbleEllipsesOutline,
  Finance: IoWalletOutline,
  Companions: IoPaw,
  Inventory: IoCubeOutline,
  'Controlled drug register': IoFlaskOutline,
  Integrations: IoGitNetworkOutline,
  Network: IoGlobeOutline,
  Templates: IoBookOutline,
  Connect: IoCodeSlashOutline,
  'My Integrations': IoCodeSlashOutline,
  'API Keys': IoKeyOutline,
  'Form Draft Import': IoBookOutline,
  Billing: IoWalletOutline,
  'Website - Builder': IoGlobeOutline,
  Plugins: IoExtensionPuzzleOutline,
  Documentation: IoBookOutline,
  'API Playground': IoCodeSlashOutline,
  'MCP Playground': IoCubeOutline,
};

export const APP_ROUTE_GROUPS = [
  { label: 'Overview', routeNames: ['Dashboard'] },
  { label: 'Schedule & Work', routeNames: ['Appointments', 'Tasks', 'Chat'] },
  { label: 'Clients & Records', routeNames: ['Companions', 'Templates'] },
  { label: 'Business', routeNames: ['Finance', 'Inventory', 'Controlled drug register'] },
  { label: 'Administration', routeNames: ['Organization', 'Integrations', 'Network'] },
] as const;

/**
 * Groups are an allow-list of route **names**, and `groupRoutes` drops any route
 * no group names. A route added to `devRoutes` on its own therefore ships
 * unreachable, which is how both playground pages ended up invisible.
 * `developerRouteGroups.test.ts` walks `devRoutes` and fails on any orphan.
 */
export const DEV_ROUTE_GROUPS = [
  {
    label: 'Developer',
    routeNames: [
      'Dashboard',
      'Connect',
      'API Keys',
      'My Integrations',
      'Form Draft Import',
      'Billing',
      'Website - Builder',
    ],
  },
  {
    label: 'Platform',
    routeNames: ['Plugins', 'Documentation', 'API Playground', 'MCP Playground'],
  },
] as const;

export const groupRoutes = (
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
