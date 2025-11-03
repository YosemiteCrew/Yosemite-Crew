"use client";
import React, { useEffect } from "react";

import Header from "./Header/Header";
import Cookies from "./Cookies/Cookies";
import Github from "./Github/Github";
import { useAuthStore } from "../stores/authStore";
import Sidebar from "./Sidebar/Sidebar";
import { usePathname } from "next/navigation";

const publicRoutes = new Set([
  "/",
  "/signin",
  "/signup",
  "/forgot-password",
  "/about",
  "/application",
  "/book-demo",
  "/contact",
  "/developers",
  "/pms",
  "/pricing",
  "/privacy-policy",
  "/terms-and-conditions"
]);

const SessionInitializer = ({ children }: { children: React.ReactNode }) => {
  const { checkSession } = useAuthStore();
  const pathname = usePathname();

  useEffect(() => {
    const initSession = async () => {
      await checkSession();
    };
    initSession();
  }, [checkSession]);

  return (
    <>
      <Header />
      <Cookies />
      <Github />
      {publicRoutes.has(pathname) ? (
        <div className="bodywrapper">{children}</div>
      ) : (
        <div className="sidebarwrapper">
          <Sidebar />
          <div className="sidebarbodywrapper">{children}</div>
        </div>
      )}
    </>
  );
};

export default SessionInitializer;
