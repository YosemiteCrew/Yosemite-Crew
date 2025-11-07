"use client";
import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

import { useAuthStore } from "@/app/stores/authStore";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { status } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status === "checking") return null; // or a skeleton/loader
  if (status === "unauthenticated") return null;

  return <>{children}</>;
};

export default ProtectedRoute;
