"use client";
import React from "react";
import { usePathname } from "next/navigation";

import { useAuthStore } from "@/app/stores/authStore";
import GuestHeader from "./GuestHeader/GuestHeader";
import UserHeader from "./UserHeader/UserHeader";

import "./Header.css";

const publicRoutes = new Set([
  "/",
  "/signin",
  "/signup",
  "/about",
  "/pms",
  "/contact",
  "/developers",
  "/application",
  "/pricing",
  "/forgot-password",
]);

const Header = () => {
  const { user } = useAuthStore();
  const pathname = usePathname();

  if (publicRoutes.has(pathname)) {
    return (
      <header className="header">
        <GuestHeader />
      </header>
    );
  }

  return (
    <header className="header">
      {user ? <UserHeader /> : <GuestHeader />}
    </header>
  );
};

export default Header;
