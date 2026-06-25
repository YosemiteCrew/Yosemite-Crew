import { Permission, PERMISSIONS } from '@/app/lib/permissions';

export type RouteItem = {
  name: string;
  href: string;
  icon?: string;
  verify?: boolean;
  requiredAnyPermissions?: Permission[];
};

export const appRoutes: RouteItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    verify: false,
    requiredAnyPermissions: [PERMISSIONS.ANALYTICS_VIEW_ANY],
  },
  { name: 'Organization', href: '/organization', verify: false },
  {
    name: 'Appointments',
    href: '/appointments',
    verify: true,
    requiredAnyPermissions: [PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.APPOINTMENTS_VIEW_OWN],
  },
  {
    name: 'Tasks',
    href: '/tasks',
    verify: true,
    requiredAnyPermissions: [PERMISSIONS.TASKS_VIEW_ANY, PERMISSIONS.TASKS_VIEW_OWN],
  },
  {
    name: 'Chat',
    href: '/chat',
    verify: true,
    requiredAnyPermissions: [PERMISSIONS.COMMUNICATION_VIEW_ANY],
  },
  {
    name: 'Finance',
    href: '/finance',
    verify: true,
    requiredAnyPermissions: [PERMISSIONS.BILLING_VIEW_ANY],
  },
  {
    name: 'Companions',
    href: '/companions',
    verify: true,
    requiredAnyPermissions: [PERMISSIONS.COMPANIONS_VIEW_ANY],
  },
  {
    name: 'Inventory',
    href: '/inventory',
    verify: true,
    requiredAnyPermissions: [PERMISSIONS.INVENTORY_VIEW_ANY],
  },
  {
    name: 'Integrations',
    href: '/integrations',
    verify: true,
    requiredAnyPermissions: [PERMISSIONS.INTEGRATIONS_VIEW_ANY],
  },
  {
    name: 'Templates',
    href: '/forms',
    verify: true,
    requiredAnyPermissions: [PERMISSIONS.FORMS_VIEW_ANY],
  },
];

export const devRoutes: RouteItem[] = [
  { name: 'Dashboard', href: '/developers/home' },
  { name: 'API Keys', href: '/developers/api-keys' },
  { name: 'Website - Builder', href: '/developers/website-builder' },
  { name: 'Plugins', href: '/developers/plugins' },
  { name: 'Documentation', href: '/developers/documentation' },
];

export const headerAppRoutes: RouteItem[] = [
  ...appRoutes,
  { name: 'Settings', href: '/settings', verify: false },
  { name: 'Sign out', href: '#', verify: false },
];

export const headerDevRoutes: RouteItem[] = [
  ...devRoutes,
  { name: 'Settings', href: '/developers/settings' },
  { name: 'Sign out', href: '#' },
];
