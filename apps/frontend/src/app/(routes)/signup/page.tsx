"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

import SignUp from "@/app/pages/SignUp/SignUp";
import { useAuthStore } from "@/app/stores/authStore";

function Page() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      router.push("/create-org");
    }
  }, [user, router]);

  return <SignUp />;
}

export default Page;
