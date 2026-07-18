import type { IconType } from 'react-icons';
import {
  IoBookOutline,
  IoBusinessOutline,
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoCodeSlashOutline,
  IoCubeOutline,
  IoEllipsisHorizontal,
  IoGitNetworkOutline,
  IoHomeOutline,
  IoListOutline,
  IoPaw,
  IoSettingsOutline,
  IoWalletOutline,
} from 'react-icons/io5';

/**
 * Static definition of the phone shell navigation. All hrefs and route names
 * mirror `constants/routes.ts` so permission/verification gates can be reused —
 * nothing here invents a destination that does not already exist in the app.
 */

export type PhoneTabKey = 'home' | 'schedule' | 'patients' | 'chat' | 'more';

export type PhoneTabConfig = {
  key: PhoneTabKey;
  label: string;
  icon: IconType;
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
    icon: IoHomeOutline,
    href: '/dashboard',
    routeName: 'Dashboard',
    activePrefixes: ['/dashboard'],
  },
  {
    key: 'schedule',
    label: 'Schedule',
    icon: IoCalendarOutline,
    href: '/appointments',
    routeName: 'Appointments',
    activePrefixes: ['/appointments'],
  },
  {
    key: 'patients',
    label: 'Patients',
    icon: IoPaw,
    href: '/companions',
    routeName: 'Companions',
    activePrefixes: ['/companions'],
  },
  {
    key: 'chat',
    label: 'Chat',
    icon: IoChatbubbleEllipsesOutline,
    href: '/chat',
    routeName: 'Chat',
    activePrefixes: ['/chat'],
    hasBadge: true,
  },
  {
    key: 'more',
    label: 'More',
    icon: IoEllipsisHorizontal,
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
  /** Exact pathname the action belongs to (index/list route only). */
  matchHref: string;
};

export const PHONE_FAB_ACTIONS: FabAction[] = [
  {
    key: 'appointment',
    label: 'New appointment',
    ariaLabel: 'New appointment',
    routeName: 'Appointments',
    matchHref: '/appointments',
  },
  {
    key: 'task',
    label: 'New task',
    ariaLabel: 'New task',
    routeName: 'Tasks',
    matchHref: '/tasks',
  },
  {
    key: 'companion',
    label: 'New companion',
    ariaLabel: 'New companion',
    routeName: 'Companions',
    matchHref: '/companions',
  },
  {
    key: 'product',
    label: 'New product',
    ariaLabel: 'New product',
    routeName: 'Inventory',
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
    icon: IoListOutline,
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
  { key: 'settings', label: 'Settings', href: '/settings', icon: IoSettingsOutline },
  {
    key: 'developer-portal',
    label: 'Developer portal',
    href: '/developers/home',
    icon: IoCodeSlashOutline,
  },
];
