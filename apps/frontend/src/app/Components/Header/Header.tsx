"use client";
import React from "react";

import { useAuthStore } from "@/app/stores/authStore";
import PublicHeader from "./PublicHeader";
import PrivateHeader from "./PrivateHeader";

import "./Header.css";

const Header = () => {
  const { user } = useAuthStore();

  return (
    <header className="header">
      {user ? <PrivateHeader /> : <PublicHeader />}
    </header>
  );
};

export default Header;
