"use client";
import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

import { useAuthStore } from "@/app/stores/authStore";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { status, role } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const isChecking = status === "idle" || status === "checking";
  const isAuthed =
    status === "authenticated" || status === "signin-authenticated";

  useEffect(() => {
    if (role === "member") {
      if (isChecking) return;
      if (!isAuthed) {
        router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
      }
    }
  }, [isChecking, isAuthed, router, pathname, role]);

  if (isChecking) {
    return null;
  }
  if (!isAuthed) return null;
  if (role !== "member") return null;

  return <>{children}</>;
};

export default ProtectedRoute;
