import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FaCaretDown } from "react-icons/fa6";

import { useAuthStore } from "@/app/stores/authStore";

import "./Sidebar.css";

type RouteItem = {
  name: string;
  href: string;
  icon?: string;
};

const appRoutes: RouteItem[] = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Organization", href: "/organization" },
  { name: "Appointments", href: "/appointments" },
  { name: "Tasks", href: "/tasks" },
  { name: "Chat", href: "/chat" },
  { name: "Finance", href: "/finance" },
  { name: "Companions", href: "/companions" },
  { name: "Inventory", href: "/inventory" },
  { name: "Forms", href: "/forms" },
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
  const [selectOrg, setSelectOrg] = useState(false);

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
      <div className="relative">
        <button
          className="flex items-center gap-2.5"
          onClick={() => setSelectOrg((e) => !e)}
        >
          <Image
            src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
            alt="Logo"
            height={42}
            width={42}
            className="rounded-full"
          />
          <div className="font-grotesk font-medium text-black-text text-[19px] tracking-tight leading-6">
            San Francisco Medical Center
          </div>
          <FaCaretDown
            size={20}
            className={`text-black-text transition-transform cursor-pointer`}
          />
        </button>
        {selectOrg && (
          <div className="absolute top-[120%] left-0 rounded-2xl border border-grey-noti bg-white shadow-md! flex flex-col items-center w-full px-3">
            <button className="text-grey-noti font-grotesk font-medium text-[16px] text-center py-2 w-full">
              New York Pet Care Hospital
            </button>
            <Link
              href={"/organizations"}
              onClick={() => setSelectOrg(false)}
              className="text-blue-text font-grotesk font-medium text-[16px] text-center py-2 border-t! border-t-grey-light! w-full"
            >
              View all
            </Link>
          </div>
        )}
      </div>
      <div className="flex gap-3 flex-col">
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
    </div>
  );
};

export default Sidebar;
