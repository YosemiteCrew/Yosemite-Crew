import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "@/app/stores/authStore";

import "./Sidebar.css";

type RouteItem = {
  name: string;
  href: string;
  icon?: string;
};

const appRoutes: RouteItem[] = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Organisation", href: "/organizations" },
  { name: "Appointments", href: "#" },
  { name: "Tasks", href: "#" },
  { name: "Chat", href: "/chat" },
  { name: "Finance", href: "#" },
  { name: "Companions", href: "/companions" },
  { name: "Inventory", href: "/inventory" },
  { name: "Forms", href: "#" },
  { name: "Settings", href: "/settings" },
  { name: "Sign out", href: "#" },
];

const devRoutes: RouteItem[] = [
  { name: "Dashboard", href: "/developers/home" },
  { name: "API Keys", href: "/developers/api-keys" },
  { name: "Website - Builder", href: "/developers/website-builder" },
  { name: "Plugins", href: "/developers/plugins" },
  { name: "Documentation", href: "/developers/documentation" },
  { name: "Settings", href: "/developers/settings" },
  { name: "Sign out", href: "#" },
];

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { signout } = useAuthStore();

  const isDevPortal = pathname?.startsWith("/developers") || false;
  const routes = isDevPortal ? devRoutes : appRoutes;

  const handleLogout = async () => {
    try {
      signout();
      console.log("✅ Signed out using Cognito signout");
      router.replace(isDevPortal ? "/developers/signin" : "/signin");
    } catch (error) {
      console.error("⚠️ Cognito signout error:", error);
    }
  };

  const handleClick = (item: any) => {
    if (item.name === "Sign out") {
      handleLogout();
    } else {
      router.push(item.href);
    }
  };

  return (
    <div className="sidebar">
      {routes.map((route) => (
        <Link
          key={route.name}
          className={`route ${pathname === route.href ? "route-active" : ""}`}
          href={route.href}
          onClick={() => handleClick(route)}
        >
          <span className="route-label">{route.name}</span>
        </Link>
      ))}
    </div>
  );
};

export default Sidebar;
