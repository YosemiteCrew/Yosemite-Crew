// src/app/signup/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo } from "react";
import SignUp from "@/app/Pages/Sign/SignUp";
import { useStore } from "zustand";
import { useAuthStore } from "@/app/stores/authStore";

function SignUpWrapper() {
  const searchParams = useSearchParams();
  const inviteCode = useMemo(
    () => searchParams.get("inviteCode") ?? "",
    [searchParams]
  );

  return <SignUp inviteCode={inviteCode} />;
}

export default function Page() {
  const isVerified = useStore(useAuthStore, (state) => state.isVerified);
  const router = useRouter();
  const userType = useAuthStore((state) => state.userType);

  useEffect(() => {
    if (isVerified) {
      redirectToDashboard();
    }
  }, [isVerified, router]);
  const redirectToDashboard = () => {
    if (userType === "Veterinary Business") {
      router.push("/emptydashboard");
    } else if (userType === "Breeding Facility") {
      router.push("/DoctorDashboard");
    } else if (userType === "Pet Sitter") {
      router.push("/DoctorDashboard");
    } else if (userType === "Groomer Shop") {
      router.push("/DoctorDashboard");
    }
  };
  return (
    <Suspense fallback={<div>Loading signup...</div>}>
      {!isVerified && <SignUpWrapper />}
    </Suspense>
  );
}