"use client";
import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

import SignUp from "@/app/pages/SignUp/SignUp";
import { useAuthStore } from "@/app/stores/authStore";

function Page() {
  const router = useRouter();
  const { status } = useAuthStore();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/organizations");
    }
  }, [status, router]);

  return (
    <Suspense fallback={null}>
      <SignUp />
    </Suspense>
  );
}

export default Page;
