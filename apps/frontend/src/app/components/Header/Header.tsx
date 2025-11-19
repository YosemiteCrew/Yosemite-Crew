"use client";
import React from "react";
import { usePathname } from "next/navigation";

import GuestHeader from "./GuestHeader/GuestHeader";
import UserHeader from "./UserHeader/UserHeader";

import "./Header.css";

const publicRoutes = new Set([
  "/",
  "/signin",
  "/signup",
  "/developers/signin",
  "/developers/signup",
  "/forgot-password",
  "/about",
  "/application",
  "/book-demo",
  "/contact",
  "/developers",
  "/pms",
  "/pricing",
  "/privacy-policy",
  "/terms-and-conditions",
]);

const Header = () => {
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
      <UserHeader />
    </header>
  );
};

export default Header;
