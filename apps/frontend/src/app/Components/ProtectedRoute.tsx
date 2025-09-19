"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/app/stores/authStore";

type ProtectedRouteProps = {
  children: React.ReactNode;
  rolesAllowed?: string[];
};

const ProtectedRoute = ({ children, rolesAllowed }: ProtectedRouteProps) => {
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/signin");
      return;
    }
    if (rolesAllowed && role && !rolesAllowed.includes(role)) {
      router.replace("/signin");
    }
  }, [user, role, rolesAllowed, router]);

  if (!user) return null;
  if (rolesAllowed && role && !rolesAllowed.includes(role)) return null;

  return <>{children}</>;
};

export default ProtectedRoute;
