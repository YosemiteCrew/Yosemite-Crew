"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";

type UserType = "Hospital" | "Groomer Shop" | "Doctor" | string;
type DecodedTokenType = {
  userId: string;
  userType: UserType;
  [key: string]: string;
};

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const [tokenChecked, setTokenChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem("token");

    if (!token) {
      console.log("[ProtectedRoute] No token found, redirecting...");
      router.push("/signin");
      return;
    }

    try {
      const decoded = jwtDecode<DecodedTokenType>(token);
      const userRole = decoded.userType;

      if (allowedRoles && !allowedRoles.includes(userRole)) {
        console.log("[ProtectedRoute] Role not allowed:", userRole);
        router.push("/unauthorized");
        return;
      }

      setHasAccess(true);
    } catch (error) {
      console.error("[ProtectedRoute] Error decoding token", error);
      router.push("/signin");
    } finally {
      setTokenChecked(true);
    }
  }, [allowedRoles, router]);

  if (!tokenChecked || !hasAccess) {
    return null; // or <LoadingSpinner />
  }

  return <>{children}</>;
}
