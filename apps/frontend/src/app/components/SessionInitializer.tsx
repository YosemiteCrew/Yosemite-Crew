"use client";
import React, { useEffect } from "react";

import Header from "./Header/Header";
import Cookies from "./Cookies/Cookies";
import Github from "./Github/Github";
import { useAuthStore } from "../stores/authStore";
import Sidebar from "./Sidebar/Sidebar";
import { usePathname, useRouter } from "next/navigation";
import { publicRoutes } from "../utils/const";

const SessionInitializer = ({ children }: { children: React.ReactNode }) => {
  const { checkSession, status, role, signout } = useAuthStore();
  const pathname = usePathname() || "";
  const router = useRouter();

  const hideSidebarRoutes = ["/developers/documentation"];
  const shouldHideSidebar = hideSidebarRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isPublicRoute = publicRoutes.has(pathname);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const isDevRoute = pathname.startsWith("/developers");
    const isPublic = isPublicRoute;
    const devFlag =
      typeof globalThis !== "undefined" &&
      globalThis.sessionStorage?.getItem("devAuth") === "true"; // Temporary fallback until custom:role is in the token
    const isDevRole = role === "developer" || (!role && devFlag);

    if (isDevRoute && !isDevRole && !isPublic) {
      signout();
      router.replace("/developers/signin");
    } else if (!isDevRoute && isDevRole && !isPublic) {
      router.replace("/developers/home");
    }
  }, [pathname, router, role, status, signout]);

  return (
    <>
      <Header />
      <Cookies />
      <Github />
      {isPublicRoute || shouldHideSidebar ? (
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
