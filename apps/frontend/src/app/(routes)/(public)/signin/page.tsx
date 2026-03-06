"use client";
import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/app/stores/authStore";
import SignIn from "@/app/features/auth/pages/SignIn/SignIn";

function Page() {
  const router = useRouter();
  const { status } = useAuthStore();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/organizations");
    }
  }, [status, router]);

  return (
    <Suspense fallback={<div></div>}>
      <SignIn />
    </Suspense>
  );
}

export default Page;
