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
import { appRoutes, devRoutes } from "@/app/config/routes";

import "./Sidebar.css";

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

  // Developer portal doesn't need org data to load
  if (isInitialLoading && !isDevPortal) return <div className="sidebar"></div>;

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
          // Developer portal routes don't need org verification
          const isDisabled = isDevPortal
            ? false
            : route.name !== "Sign out" &&
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
