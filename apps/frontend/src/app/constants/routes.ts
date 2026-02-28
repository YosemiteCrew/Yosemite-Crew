export type RouteItem = {
  name: string;
  href: string;
  icon?: string;
  verify?: boolean;
};

export const appRoutes: RouteItem[] = [
  { name: "Dashboard", href: "/dashboard", verify: false },
  { name: "Organization", href: "/organization", verify: false },
  { name: "Appointments", href: "/appointments", verify: true },
  { name: "Tasks", href: "/tasks", verify: true },
  { name: "Chat", href: "/chat", verify: true },
  { name: "Finance", href: "/finance", verify: true },
  { name: "Companions", href: "/companions", verify: true },
  { name: "Inventory", href: "/inventory", verify: true },
  { name: "Templates", href: "/forms", verify: true },
];

export const devRoutes: RouteItem[] = [
  { name: "Dashboard", href: "/developers/home" },
  { name: "API Keys", href: "/developers/api-keys" },
  { name: "Website - Builder", href: "/developers/website-builder" },
  { name: "Plugins", href: "/developers/plugins" },
  { name: "Documentation", href: "/developers/documentation" },
];

export const headerAppRoutes: RouteItem[] = [
  ...appRoutes,
  { name: "Settings", href: "/settings", verify: false },
  { name: "Sign out", href: "#", verify: false },
];

export const headerDevRoutes: RouteItem[] = [
  ...devRoutes,
  { name: "Settings", href: "/developers/settings" },
  { name: "Sign out", href: "#" },
];
