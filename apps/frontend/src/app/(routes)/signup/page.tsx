// src/app/signup/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import React, { Suspense, useMemo } from "react";
import SignUp from "@/app/Pages/Sign/SignUp";

function SignUpWrapper() {
  const searchParams = useSearchParams();
  const inviteCode = useMemo(
    () => searchParams.get("inviteCode") ?? "",
    [searchParams]
  );

  return <SignUp inviteCode={inviteCode} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading signup...</div>}>
      <SignUpWrapper />
    </Suspense>
  );
}
