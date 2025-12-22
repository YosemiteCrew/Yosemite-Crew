"use client";
import React, { useEffect, useMemo } from "react";

import Header from "./Header/Header";
import Cookies from "./Cookies/Cookies";
import Github from "./Github/Github";
import { useAuthStore } from "../stores/authStore";
import Sidebar from "./Sidebar/Sidebar";
import { usePathname } from "next/navigation";
import { publicRoutes } from "../utils/const";
import "@stripe/connect-js";

const SessionInitializer = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname() || "";
  const isPublicRoute = useMemo(() => publicRoutes.has(pathname), [pathname]);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    void useAuthStore.getState().checkSession();
  }, []);

  const isChecking = status === "idle" || status === "checking";

  return (
    <>
      <Header />
      <Cookies />
      <Github />
      {isPublicRoute ? (
        <div className="bodywrapper">{children}</div>
      ) : (
        <div className="sidebarwrapper">
          <Sidebar />
          <div className="sidebarbodywrapper">
            {isChecking ? null : children}
          </div>
        </div>
      )}
    </>
  );
};

export default SessionInitializer;
