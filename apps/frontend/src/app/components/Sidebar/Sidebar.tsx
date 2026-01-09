import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

import { usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import { useOrgStore } from "@/app/stores/orgStore";
import { useLoadOrg } from "@/app/hooks/useLoadOrg";
import { useLoadProfiles } from "@/app/hooks/useProfiles";
import { useLoadAvailabilities } from "@/app/hooks/useAvailabiities";
import { useLoadSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";

import "./Sidebar.css";

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
];

const devRoutes: RouteItem[] = [
  { name: "Dashboard", href: "/developers/home" },
  { name: "API Keys", href: "/developers/api-keys" },
  { name: "Website - Builder", href: "/developers/website-builder" },
  { name: "Plugins", href: "/developers/plugins" },
  { name: "Documentation", href: "/developers/documentation" },
];

const Sidebar = () => {
  useLoadOrg();
  useLoadProfiles();
  useLoadAvailabilities();
  useLoadSpecialitiesForPrimaryOrg();
  const pathname = usePathname();
  const router = useRouter();

  const isDevPortal = pathname?.startsWith("/developers") || false;
  const routes = isDevPortal ? devRoutes : appRoutes;

  const orgStatus = useOrgStore((s) => s.status);
  const primaryOrg = usePrimaryOrg();

  const handleClick = (item: any) => {
    router.push(item.href);
  };

  const isInitialLoading = orgStatus !== "loaded";

  if (isInitialLoading) return <div className="sidebar"></div>;

  const orgMissing = !primaryOrg;
  const orgVerified = !!primaryOrg?.isVerified;

  return (
    <div className="sidebar">
      <div className="flex items-center justify-center h-20">
        <Link href="/" className="logo">
          <Image src={"https://d2il6osz49gpup.cloudfront.net/Logo.png"} alt="Logo" width={90} height={83} priority />
        </Link>
      </div>
      <div className="flex gap-3 flex-col">
        {routes.map((route) => {
          const needsVerifiedOrg = route.verify;
          const isDisabled =
            route.name !== "Sign out" &&
            route.name !== "Settings" &&
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
              className={`route ${isActive && "route-active"} ${isDisabled && "text-[#A09F9F]!"}`}
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
