import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "@/app/stores/authStore";

import "./Sidebar.css";

const routes = [
  {
    name: "Dashboard",
    href: "/dashboard",
  },
  {
    name: "Organisation",
    href: "/organizations",
  },
  {
    name: "Appointments",
    href: "#",
  },
  {
    name: "Tasks",
    href: "#",
  },
  {
    name: "Chat",
    href: "/chat",
  },
  {
    name: "Finance",
    href: "#",
  },
  {
    name: "Companions",
    href: "/companions",
  },
  {
    name: "Inventory",
    href: "#",
  },
  {
    name: "Forms",
    href: "#",
  },
  {
    name: "Settings",
    href: "#",
  },
  {
    name: "Sign out",
    href: "#",
  },
];

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { signout } = useAuthStore();

  const handleLogout = async () => {
    try {
      signout();
      console.log("✅ Signed out using Cognito signout");
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
          {route.name}
        </Link>
      ))}
    </div>
  );
};

export default Sidebar;
