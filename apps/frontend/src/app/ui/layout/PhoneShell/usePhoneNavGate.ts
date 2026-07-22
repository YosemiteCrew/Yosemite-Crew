'use client';

import { usePathname, useRouter } from 'next/navigation';

import { appRoutes } from '@/app/config/routes';
import { hasAnyRequiredPermission, resolveMembershipPermissions } from '@/app/lib/routePermissions';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';

export type PhoneNavGate = {
  pathname: string;
  isDevPortal: boolean;
  /** Whether a tab/section route is reachable (same rule the sidebar applies). */
  isRouteEnabled: (routeName?: string) => boolean;
  /** Whether the given pathname is currently active for this tab. */
  isActive: (prefixes: string[]) => boolean;
  /** Pushes a route with the shared route loader, mirroring the sidebar. */
  navigate: (href?: string) => void;
};

/**
 * Reuses the sidebar's route-availability logic (org present, verified where
 * required, and permission held) so the phone tab bar / More sheet gate exactly
 * like the desktop nav. Reads the same stores the sidebar reads — no new data.
 */
export function usePhoneNavGate(): PhoneNavGate {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const isDevPortal = pathname.startsWith('/developers');

  const primaryOrg = usePrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const membership = useOrgStore((s) =>
    primaryOrgId ? (s.membershipsByOrgId?.[primaryOrgId] ?? null) : null
  );
  const effectivePermissions = resolveMembershipPermissions(membership);

  const orgMissing = !primaryOrg;
  const orgVerified = !!primaryOrg?.isVerified;

  const isRouteEnabled = (routeName?: string): boolean => {
    if (!routeName) return true;
    if (isDevPortal) return true;
    if (routeName === 'Settings') return true;
    const route = appRoutes.find((item) => item.name === routeName);
    if (!route) return true;
    return !(
      orgMissing ||
      (route.verify && !orgVerified) ||
      !hasAnyRequiredPermission(effectivePermissions, route.requiredAnyPermissions)
    );
  };

  const isActive = (prefixes: string[]): boolean =>
    prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const navigate = (href?: string): void => {
    if (!href) return;
    if (pathname === href) {
      stopRouteLoader();
      return;
    }
    startRouteLoader();
    router.push(href);
  };

  return { pathname, isDevPortal, isRouteEnabled, isActive, navigate };
}

export default usePhoneNavGate;
