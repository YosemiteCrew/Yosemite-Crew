"use client";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";

/**
 * Blocks access to developer routes unless authenticated with developer role.
 */
const DevRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { status, role, signout } = useAuthStore();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Wait for auth status to be determined
    if (status === "idle" || status === "checking") return;

    const isDevPath = pathname?.startsWith("/developers");

    // Check sessionStorage for devAuth flag (temporary fallback until custom:role is in Cognito)
    const devFlag =
      typeof window !== "undefined" &&
      window.sessionStorage?.getItem("devAuth") === "true";

    // User is developer if they have the developer role OR the devAuth flag is set
    const isDevRole = role === "developer" || devFlag;

    if (!isDevPath) {
      setAllowed(true);
      return;
    }

    // Allow authenticated developers (both "authenticated" and "signin-authenticated" statuses)
    const isAuthenticated = status === "authenticated" || status === "signin-authenticated";

    if (isAuthenticated && isDevRole) {
      setAllowed(true);
      return;
    }

    // Not authenticated - redirect to signin
    if (status === "unauthenticated") {
      router.replace("/developers/signin");
      return;
    }

    // Authenticated but not a developer - sign out and redirect
    if (isAuthenticated && !isDevRole) {
      signout();
      router.replace("/developers/signin");
      return;
    }
  }, [status, role, pathname, router, signout]);

  if (!allowed) return null;

  return <>{children}</>;
};

export default DevRouteGuard;
