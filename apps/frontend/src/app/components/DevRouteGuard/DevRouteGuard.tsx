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
    if (status === "idle" || status === "checking") return;

    const isDevPath = pathname?.startsWith("/developers");
    const devFlag =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("devAuth") === "true"; // Temporary fallback until custom:role is present
    const isDevRole = role === "developer" || (!role && devFlag);

    if (!isDevPath) {
      setAllowed(true);
      return;
    }

    if (status === "unauthenticated") {
      router.replace("/developers/signin");
      return;
    }

    if (status === "authenticated" && !isDevRole) {
      signout();
      router.replace("/developers/signin");
      return;
    }

    setAllowed(true);
  }, [status, role, pathname, router, signout]);

  if (!allowed) return null;

  return <>{children}</>;
};

export default DevRouteGuard;
