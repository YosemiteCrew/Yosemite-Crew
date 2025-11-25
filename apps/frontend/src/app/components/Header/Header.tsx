"use client";
import React from "react";
import { usePathname } from "next/navigation";

import GuestHeader from "./GuestHeader/GuestHeader";
import UserHeader from "./UserHeader/UserHeader";
import { publicRoutes } from "@/app/utils/const";

import "./Header.css";

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
