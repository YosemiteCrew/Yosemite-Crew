import type { IconType } from 'react-icons';
import { PERMISSIONS, type Permission } from '@/app/lib/permissions';
import {
  IoHelpCircleOutline,
  IoBook,
  IoBookOutline,
  IoBusinessOutline,
  IoCalendar,
  IoCalendarOutline,
  IoChatbubbleEllipses,
  IoChatbubbleEllipsesOutline,
  IoCheckmarkDoneOutline,
  IoCodeSlashOutline,
  IoCubeOutline,
  IoExtensionPuzzle,
  IoExtensionPuzzleOutline,
  IoEllipsisHorizontalCircle,
  IoEllipsisHorizontalCircleOutline,
  IoGitNetworkOutline,
  IoGrid,
  IoGridOutline,
  IoKey,
  IoKeyOutline,
  IoPaw,
  IoPawOutline,
  IoSettingsOutline,
  IoWalletOutline,
} from 'react-icons/io5';

/**
 * Static definition of the phone shell navigation. All hrefs and route names
 * mirror `constants/routes.ts` so permission/verification gates can be reused —
 * nothing here invents a destination that does not already exist in the app.
 */

export type PhoneTabKey =
  | 'home'
  | 'schedule'
  | 'patients'
  | 'chat'
  | 'more'
  | 'dev-home'
  | 'dev-api-keys'
  | 'dev-plugins'
  | 'dev-docs';

export type PhoneTabConfig = {
  key: PhoneTabKey;
  label: string;
  icon: IconType;
  /** Filled icon variant shown while the tab is active (design: active tab is filled). */
  activeIcon: IconType;
  /** Route pushed on tap (absent for the More tab, which opens a sheet). */
  href?: string;
  /** Matching entry in `appRoutes`, used to reuse the sidebar permission gate. */
  routeName?: string;
  /** Pathname prefixes that mark this tab active. */
  activePrefixes: string[];
  /** True for the More tab, which opens the More bottom sheet. */
  isMore?: boolean;
  /** True for the Chat tab, which surfaces the unread badge. */
  hasBadge?: boolean;
};

export const PHONE_TABS: PhoneTabConfig[] = [
  {
    key: 'home',
    label: 'Home',
    icon: IoGridOutline,
    activeIcon: IoGrid,
    href: '/dashboard',
    routeName: 'Dashboard',
    activePrefixes: ['/dashboard'],
  },
  {
    key: 'schedule',
    label: 'Schedule',
    icon: IoCalendarOutline,
    activeIcon: IoCalendar,
    href: '/appointments',
    routeName: 'Appointments',
    activePrefixes: ['/appointments'],
  },
  {
    key: 'patients',
    label: 'Patients',
    icon: IoPawOutline,
    activeIcon: IoPaw,
    href: '/companions',
    routeName: 'Companions',
    activePrefixes: ['/companions'],
  },
  {
    key: 'chat',
    label: 'Chat',
    icon: IoChatbubbleEllipsesOutline,
    activeIcon: IoChatbubbleEllipses,
    href: '/chat',
    routeName: 'Chat',
    activePrefixes: ['/chat'],
    hasBadge: true,
  },
  {
    key: 'more',
    label: 'More',
    icon: IoEllipsisHorizontalCircleOutline,
    activeIcon: IoEllipsisHorizontalCircle,
    isMore: true,
    activePrefixes: [
      '/tasks',
      '/finance',
      '/inventory',
      '/forms',
      '/integrations',
      '/organization',
      '/settings',
      '/developers',
    ],
  },
];

/**
 * The developer portal's own bottom bar.
 *
 * `PHONE_TABS` is the PIMS set - Home/Schedule/Patients/Chat all point at clinic
 * routes - and the portal was rendering it, so a developer on a phone got a
 * business menu and no way to reach API keys or plugins except through More.
 * The desktop sidebar has always swapped `appRoutes` for `devRoutes` on this
 * same prefix; this is that switch, for the shell the phone actually shows.
 *
 * Deliberately no `routeName`: those exist so a tab can reuse the sidebar's
 * ORG permission gate, and the portal is not org-scoped - `usePhoneNavGate`
 * already short-circuits `isRouteEnabled` to true inside `/developers`. Giving
 * these tabs an org route name would gate the portal on clinic membership.
 *
 * Website Builder is intentionally absent: the portal itself tells a phone
 * visitor it is desktop-only, so a tab leading there would be a dead end.
 */
export const DEV_PHONE_TABS: PhoneTabConfig[] = [
  {
    key: 'dev-home',
    label: 'Home',
    icon: IoGridOutline,
    activeIcon: IoGrid,
    href: '/developers/home',
    activePrefixes: ['/developers/home'],
  },
  {
    key: 'dev-api-keys',
    label: 'API Keys',
    icon: IoKeyOutline,
    activeIcon: IoKey,
    href: '/developers/api-keys',
    activePrefixes: ['/developers/api-keys'],
  },
  {
    key: 'dev-plugins',
    label: 'Plugins',
    icon: IoExtensionPuzzleOutline,
    activeIcon: IoExtensionPuzzle,
    href: '/developers/plugins',
    activePrefixes: ['/developers/plugins'],
  },
  {
    key: 'dev-docs',
    label: 'Docs',
    icon: IoBookOutline,
    activeIcon: IoBook,
    href: '/developers/documentation',
    activePrefixes: ['/developers/documentation'],
  },
  {
    key: 'more',
    label: 'More',
    icon: IoEllipsisHorizontalCircleOutline,
    activeIcon: IoEllipsisHorizontalCircle,
    isMore: true,
    activePrefixes: ['/developers/billing', '/developers/website-builder', '/developers/settings'],
  },
];

/**
 * What the More sheet offers inside the portal. The business sections
 * (Tasks, Finance, Inventory...) are clinic routes and do not belong here;
 * these are the developer destinations the bottom bar has no room for.
 */
export const DEV_PHONE_MORE_LINKS: MoreLinkConfig[] = [
  { key: 'dev-billing', label: 'Billing', href: '/developers/billing', icon: IoWalletOutline },
  {
    key: 'dev-website-builder',
    label: 'Website builder',
    href: '/developers/website-builder',
    icon: IoBusinessOutline,
  },
  {
    key: 'dev-settings',
    label: 'Settings',
    href: '/developers/settings',
    icon: IoSettingsOutline,
  },
];

export type FabActionKey = 'appointment' | 'task' | 'companion' | 'product';

/**
 * Custom event the FAB dispatches so the active page can open its create flow.
 * Lives here (not in `PhoneShell.tsx`) so a page can subscribe via
 * `usePhonePrimaryAction` without importing the whole shell component.
 */
export const PHONE_PRIMARY_ACTION_EVENT = 'yc:phone-primary-action';

export type PhonePrimaryActionDetail = {
  key: FabActionKey;
  href: string;
};

export type FabAction = {
  key: FabActionKey;
  label: string;
  ariaLabel: string;
  /** Route that must be enabled for the action to appear. */
  routeName: string;
  /**
   * Permissions that let the user actually create the thing. `routeName` only
   * covers the VIEW permission for the list route, so without this the FAB
   * offered a create flow the desktop create button hides - any one of these
   * grants is enough, matching the desktop checks.
   */
  createAnyOf: Permission[];
  /** Exact pathname the action belongs to (index/list route only). */
  matchHref: string;
};

export const PHONE_FAB_ACTIONS: FabAction[] = [
  {
    key: 'appointment',
    label: 'New appointment',
    ariaLabel: 'New appointment',
    routeName: 'Appointments',
    createAnyOf: [PERMISSIONS.APPOINTMENTS_EDIT_ANY, PERMISSIONS.APPOINTMENTS_EDIT_OWN],
    matchHref: '/appointments',
  },
  {
    key: 'task',
    label: 'New task',
    ariaLabel: 'New task',
    routeName: 'Tasks',
    createAnyOf: [PERMISSIONS.TASKS_EDIT_ANY],
    matchHref: '/tasks',
  },
  {
    key: 'companion',
    label: 'New companion',
    ariaLabel: 'New companion',
    routeName: 'Companions',
    createAnyOf: [PERMISSIONS.COMPANIONS_EDIT_ANY],
    matchHref: '/companions',
  },
  {
    key: 'product',
    label: 'New product',
    ariaLabel: 'New product',
    routeName: 'Inventory',
    createAnyOf: [PERMISSIONS.INVENTORY_EDIT_ANY],
    matchHref: '/inventory',
  },
];

/**
 * The FAB only carries a creation action on the exact list/index route for that
 * area. Detail/workspace routes (e.g. `/appointments/[id]`) return `null` so the
 * FAB is absent, matching the "pages without a creation action have no FAB" rule.
 */
export const resolveFabAction = (pathname: string): FabAction | null =>
  PHONE_FAB_ACTIONS.find((action) => action.matchHref === pathname) ?? null;

export type MoreSectionConfig = {
  key: string;
  label: string;
  context: string;
  href: string;
  routeName: string;
  icon: IconType;
};

/** The six secondary areas shown in the More sheet (each with a context line). */
export const PHONE_MORE_SECTIONS: MoreSectionConfig[] = [
  {
    key: 'tasks',
    label: 'Tasks',
    context: 'Team to-dos and follow-ups',
    href: '/tasks',
    routeName: 'Tasks',
    icon: IoCheckmarkDoneOutline,
  },
  {
    key: 'finance',
    label: 'Finance',
    context: 'Invoices and payments',
    href: '/finance',
    routeName: 'Finance',
    icon: IoWalletOutline,
  },
  {
    key: 'inventory',
    label: 'Inventory',
    context: 'Stock, dispensary and restock',
    href: '/inventory',
    routeName: 'Inventory',
    icon: IoCubeOutline,
  },
  {
    key: 'templates',
    label: 'Templates',
    context: 'Forms and document templates',
    href: '/forms',
    routeName: 'Templates',
    icon: IoBookOutline,
  },
  {
    key: 'integrations',
    label: 'Integrations',
    context: 'IDEXX, MSD and devices',
    href: '/integrations',
    routeName: 'Integrations',
    icon: IoGitNetworkOutline,
  },
  {
    key: 'organization',
    label: 'Organization',
    context: 'Profile, team and rooms',
    href: '/organization',
    routeName: 'Organization',
    icon: IoBusinessOutline,
  },
];

export type MoreLinkConfig = {
  key: string;
  label: string;
  href: string;
  icon: IconType;
};

/** Always-available links shown below the secondary areas in the More sheet. */
export const PHONE_MORE_LINKS: MoreLinkConfig[] = [
  /* Guides is here because the phone had no way to reach it at all. On desktop
     it hangs off the account menu in UserHeader, but the phone shows
     PhoneHeader instead, which has no menu - so the only route in was the
     dashboard's VideosCard, and that card's close button writes
     `yc_dashboard_videos_hidden` and never comes back. One dismissal and a
     phone user lost the whole training library permanently. */
  { key: 'guides', label: 'Guides', href: '/guides', icon: IoHelpCircleOutline },
  { key: 'settings', label: 'Settings', href: '/settings', icon: IoSettingsOutline },
  {
    key: 'developer-portal',
    label: 'Developer portal',
    href: '/developers/home',
    icon: IoCodeSlashOutline,
  },
];
