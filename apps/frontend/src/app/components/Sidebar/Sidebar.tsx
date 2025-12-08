import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FaCaretDown } from "react-icons/fa6";

import { useAuthStore } from "@/app/stores/authStore";
import { useOrgList, usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import { useOrgStore } from "@/app/stores/orgStore";

import "./Sidebar.css";
import { useLoadOrgAndInvites } from "@/app/hooks/useLoadOrgAndInvites";

type RouteItem = {
  name: string;
  href: string;
  icon?: string;
  verify?: boolean;
};

const appRoutes: RouteItem[] = [
  { name: "Dashboard", href: "/dashboard", verify: false },
  { name: "Organization", href: "/organization", verify: false },
  { name: "Appointments", href: "/appointments", verify: true },
  { name: "Tasks", href: "/tasks", verify: true },
  { name: "Chat", href: "/chat", verify: true },
  { name: "Finance", href: "/finance", verify: true },
  { name: "Companions", href: "/companions", verify: true },
  { name: "Inventory", href: "/inventory", verify: true },
  { name: "Forms", href: "/forms", verify: true },
  { name: "Settings", href: "/settings", verify: false },
  { name: "Sign out", href: "#", verify: false },
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
  useLoadOrgAndInvites()
  const pathname = usePathname();
  const router = useRouter();
  const { signout } = useAuthStore();
  const [selectOrg, setSelectOrg] = useState(false);

  const isDevPortal = pathname?.startsWith("/developers") || false;
  const routes = isDevPortal ? devRoutes : appRoutes;

  const orgStatus = useOrgStore((s) => s.status);
  const orgs = useOrgList();
  const primaryOrg = usePrimaryOrg();
  const setPrimaryOrg = useOrgStore((s) => s.setPrimaryOrg);

  const handleOrgClick = (orgId: string) => {
    setPrimaryOrg(orgId);
    setSelectOrg(false);
    router.push("/dashboard");
  };

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

  if (orgStatus !== "loaded") return <div className="sidebar"></div>;

  const orgMissing = !primaryOrg;
  const orgVerified = !!primaryOrg?.isVerified;

  return (
    <div className="sidebar">
      {primaryOrg && (
        <div className="relative">
          <button
            className="flex items-center gap-2.5"
            onClick={() => setSelectOrg((e) => !e)}
          >
            <Image
              src={
                primaryOrg.imageURL ||
                "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
              }
              alt="Logo"
              height={42}
              width={42}
              className="rounded-full"
            />
            <div className="font-grotesk font-medium text-black-text text-[19px] tracking-tight leading-6">
              {primaryOrg.name}
            </div>
            <FaCaretDown
              size={20}
              className={`text-black-text transition-transform cursor-pointer`}
            />
          </button>
          {selectOrg && (
            <div className="absolute top-[120%] left-0 rounded-2xl border border-grey-noti bg-white shadow-md! flex flex-col items-center w-full px-3">
              {orgs.slice(0, 3).map((org, i) => (
                <button
                  key={org.name + i}
                  className="text-grey-noti font-grotesk font-medium text-[16px] text-center py-2 w-full"
                  onClick={() =>
                    handleOrgClick(org._id?.toString() || org.name)
                  }
                >
                  {org.name}
                </button>
              ))}
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
      )}

      <div className="flex gap-3 flex-col">
        {routes.map((route) => {
          const needsVerifiedOrg = route.verify;
          const isDisabled =
            route.name !== "Sign out" &&
            (orgMissing || (needsVerifiedOrg && !orgVerified));

          const isActive = pathname === route.href;

          const onClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
            e.preventDefault();
            if (isDisabled) return;
            handleClick(route);
          };

          return (
            <Link
              key={route.name}
              className={`route ${isActive && "route-active"} ${isDisabled && "text-[#BFBFBE]!"}`}
              href={route.href}
              onClick={onClick}
            >
              <span className="route-label">{route.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;
