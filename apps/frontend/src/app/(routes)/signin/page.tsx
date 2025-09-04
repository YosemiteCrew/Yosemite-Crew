"use client";
import SignIn from "@/app/Pages/Sign/SignIn";
import { useAuthStore } from "@/app/stores/authStore";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { useStore } from "zustand";

function Page() {
  const isVerified = useStore(useAuthStore, (state) => state.isVerified);
  const userType = useAuthStore((state) => state.userType);

  const router = useRouter();
  useEffect(() => {
    if (isVerified === 1) {
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
    } else if (userType === "petSitter") {
      router.push("/emptydashboard");
    }
  };
  return (
    <>
      {isVerified === null && (
        <>
          <SignIn />
        </>
      )}
    </>
  );
}

export default Page;
