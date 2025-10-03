"use client";
import React from "react";

import { useAuthStore } from "@/app/stores/authStore";
import PublicHeader from "./PublicHeader";
import PrivateHeader from "./PrivateHeader";

import "./Header.css";
import { usePathname } from "next/navigation";

const publicRoutes = [
  "/",
  "/signin",
  "/signup",
  "/about",
  "/pms",
  "/contact",
  "/developers",
  "/application",
  "/pricing",
  "/forgotpassword",
];

const Header = () => {
  const { user } = useAuthStore();
  const pathname = usePathname();

  if (publicRoutes.includes(pathname)) {
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
