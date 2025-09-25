"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

import SignIn from "@/app/Pages/Sign/SignIn";
import { useAuthStore } from "@/app/stores/authStore";

function Page() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      router.push("/organizations");
    }
  }, [user, router]);

  return <SignIn />;
}

export default Page;
