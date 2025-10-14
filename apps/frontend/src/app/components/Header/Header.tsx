"use client";
import React from "react";
import { usePathname } from "next/navigation";

import { useAuthStore } from "@/app/stores/authStore";
import PublicHeader from "./PublicHeader";
import PrivateHeader from "./PrivateHeader";

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
        <PublicHeader />
      </header>
    );
  }

  return (
    <header className="header">
      {user ? <PrivateHeader /> : <PublicHeader />}
    </header>
  );
};

export default Header;
