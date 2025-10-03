"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/app/stores/authStore";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/signin");
    }
  }, [user, router]);

  if (!user) return null;

  return <>{children}</>;
};

export default ProtectedRoute;
