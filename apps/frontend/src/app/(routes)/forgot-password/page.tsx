"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

import ForgotPasswordPage from "@/app/pages/ForgotPassword/ForgotPassword";
import { useAuthStore } from "@/app/stores/authStore";

function Page() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      router.push("/organizations");
    }
  }, [user, router]);

  return <ForgotPasswordPage />;
}

export default Page;
