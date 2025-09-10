"use client";
import React from "react";

import { useAuthStore } from "@/app/stores/authStore";
import PublicHeader from "./PublicHeader";
import PrivateHeader from "./PrivateHeader";

import "./Header.css";

const Header = () => {
  const isVerified = useAuthStore((state) => state.isVerified);
  const isLoggedIn = isVerified !== null;

  return (
    <header className="header">
      {isLoggedIn ? (
        <PrivateHeader/>
      ) : (
        <PublicHeader />
      )}
    </header>
  );
};

export default Header;