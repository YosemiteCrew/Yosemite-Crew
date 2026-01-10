import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MdNotificationsActive } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useSignOut } from "@/app/hooks/useAuth";
import { HiBuildingOffice2 } from "react-icons/hi2";

import { useOrgStore } from "@/app/stores/orgStore";
import { useOrgList, usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import { FaCaretDown } from "react-icons/fa6";

import { useAuthStore } from "@/app/stores/authStore";
import { usePrimaryOrgProfile } from "@/app/hooks/useProfiles";
import Image from "next/image";
import { isHttpsImageUrl } from "@/app/utils/urls";
import Search from "../../Inputs/Search";

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

const UserHeader = () => {
  const { signOut } = useSignOut();
  const pathname = usePathname();
  const router = useRouter();
  const attributes = useAuthStore((s) => s.attributes);
  const profile = usePrimaryOrgProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const isDev = pathname.startsWith("/developers");
  const routes = isDev ? devRoutes : appRoutes;
  const [selectOrg, setSelectOrg] = useState(false);
  const [selectProfile, setSelectProfile] = useState(false);
  const orgs = useOrgList();
  const primaryOrg = usePrimaryOrg();
  const setPrimaryOrg = useOrgStore((s) => s.setPrimaryOrg);
  const [search, setSearch] = useState("");
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const logoutRedirect = pathname.startsWith("/developers")
    ? "/developers/signin"
    : "/signin";

  const handleLogout = async () => {
    try {
      await signOut();
      console.log("✅ Signed out using Cognito signout");
      router.replace(logoutRedirect);
    } catch (error) {
      console.error("⚠️ Cognito signout error:", error);
    }
  };

  const handleOrgClick = (orgId: string) => {
    setPrimaryOrg(orgId);
    setSelectOrg(false);
    router.push("/dashboard");
  };

  const handleClick = (item: any) => {
    setMenuOpen(false);
    setTimeout(() => {
      if (item.name === "Sign out") {
        handleLogout();
      } else {
        router.push(item.href);
      }
    }, 400);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setSelectProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        orgDropdownRef.current &&
        !orgDropdownRef.current.contains(event.target as Node)
      ) {
        setSelectOrg(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const orgMissing = !primaryOrg;
  const orgVerified = !!primaryOrg?.isVerified;

  return (
    <div className="flex items-center justify-between px-3 sm:px-12! lg:px-[36px]! w-full h-20 gap-0">
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: `calc(100vh - 80px)`,
              opacity: 1,
              transition: { duration: 0.4, ease: [0.42, 0, 0.58, 1] },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: { duration: 0.3, ease: [0.42, 0, 0.58, 1] },
            }}
            style={{
              top: "80px",
            }}
            className="px-3 sm:px-12! py-6 bg-white z-999 fixed top-full left-0 w-screen overflow-auto flex flex-col gap-3"
          >
            {primaryOrg && (
              <div className="relative">
                <button
                  className="flex items-center gap-2"
                  onClick={() => setSelectOrg((e) => !e)}
                >
                  <div className="h-8 w-8 rounded-default bg-neutral-100 flex items-center justify-center">
                    <HiBuildingOffice2 size={18} color="#302f2e" />
                  </div>
                  <div className="text-black-text text-body-4 truncate max-w-[200px]">
                    {primaryOrg?.name}
                  </div>
                  <FaCaretDown
                    size={20}
                    className={`text-black-text transition-transform cursor-pointer`}
                  />
                </button>
                {selectOrg && (
                  <div className="absolute top-[120%] left-0 rounded-2xl border border-card-border bg-white flex flex-col items-center w-full max-w-[200px] px-2">
                    {orgs.slice(0, 3).map((org, i) => (
                      <button
                        key={org.name + i}
                        className="px-[1.25rem] py-[0.75rem] text-body-4 hover:bg-card-hover rounded-2xl text-text-secondary! hover:text-text-primary! max-w-[200px] w-full truncate border-b! border-b-card-border!"
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
                      className="text-text-brand px-[1.25rem] py-[0.75rem] text-body-4 text-center w-full"
                    >
                      View all
                    </Link>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-col gap-3">
              {routes.map((route, index) => {
                const needsVerifiedOrg = route.verify;
                const isDisabled =
                  route.name !== "Sign out" &&
                  route.name !== "Settings" &&
                  (orgMissing || (needsVerifiedOrg && !orgVerified));

                const isActive = pathname === route.href;

                const onClick: React.MouseEventHandler<HTMLButtonElement> = (
                  e
                ) => {
                  e.preventDefault();
                  if (isDisabled) return;
                  handleClick(route);
                };

                return (
                  <button
                    type="button"
                    key={route.name}
                    onClick={onClick}
                    className={`text-body-4 px-3 py-2 rounded-2xl! border border-card-border! text-start transition-all duration-300 ease-in hover:bg-card-border ${isActive && "text-text-brand border-text-brand! bg-brand-100"} ${isDisabled && "text-[#A09F9F]!"}`}
                  >
                    {route.name}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex lg:hidden">
        <Link href="/" className="logo">
          <Image
            src={"https://d2il6osz49gpup.cloudfront.net/Logo.png"}
            alt="Logo"
            width={90}
            height={83}
            priority
          />
        </Link>
      </div>
      <div className="hidden lg:flex">
        {primaryOrg && (
          <div className="relative" ref={orgDropdownRef}>
            <button
              className={`flex items-center gap-2 w-60 xl:w-[260px] justify-between px-6 py-2 ${selectOrg ? "border border-card-border! rounded-t-2xl!" : "border-white! border"}`}
              onClick={() => setSelectOrg((e) => !e)}
            >
              <div className="h-8 w-8 rounded-default bg-neutral-100 flex items-center justify-center">
                <HiBuildingOffice2 size={18} color="#302f2e" />
              </div>
              <div className="text-black-text text-body-4 truncate flex-1">
                {primaryOrg?.name}
              </div>
              <FaCaretDown
                size={20}
                className={`text-black-text transition-transform cursor-pointer`}
              />
            </button>
            {selectOrg && (
              <div className="absolute top-[100%] left-0 rounded-b-2xl border-l border-r border-b border-card-border bg-white flex flex-col items-center w-full px-[12px] py-[10px]">
                {orgs.slice(0, 3).map((org, i) => (
                  <button
                    key={org.name + i}
                    className="px-[1.25rem] py-[0.75rem] text-body-4 hover:bg-card-hover rounded-2xl! transition-all duration-300 text-text-secondary! hover:text-text-primary! w-full truncate"
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
                  className="text-text-brand px-[1.25rem] py-[0.75rem] text-body-4 text-center w-full hover:bg-card-hover rounded-2xl! transition-all duration-300"
                >
                  View all
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Search value={search} setSearch={setSearch} className={"lg:flex hidden"} />

        <MdNotificationsActive
          color="#302f2e"
          size={22}
          style={{ cursor: "pointer" }}
        />

        <div className="relative hidden lg:flex" ref={profileDropdownRef}>
          <button
            className={`flex items-center gap-2 w-[200px] justify-between px-6 py-2 ${selectProfile ? "border border-card-border! rounded-t-2xl!" : "border-white! border"}`}
            onClick={() => setSelectProfile((e) => !e)}
          >
            <Image
              src={
                isHttpsImageUrl(profile?.personalDetails?.profilePictureUrl)
                  ? profile?.personalDetails?.profilePictureUrl
                  : "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
              }
              alt="Logo"
              height={32}
              width={32}
              className="rounded-full object-cover h-8 min-w-8 max-h-8"
            />
            <div className="text-black-text text-body-4 flex-1 truncate">
              {attributes?.given_name + " " + attributes?.family_name}
            </div>
            <FaCaretDown
              size={20}
              className={`text-black-text transition-transform cursor-pointer`}
            />
          </button>
          {selectProfile && (
            <div className="absolute top-[100%] left-0 rounded-b-2xl border-l border-r border-b border-card-border bg-white flex flex-col items-center w-full px-[12px] py-[10px]">
              <Link
                href={"/settings"}
                onClick={() => setSelectProfile(false)}
                className="text-center px-[1.25rem] py-[0.75rem] text-body-4 w-full text-text-secondary! hover:bg-card-hover rounded-2xl! transition-all duration-300"
              >
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="px-[1.25rem] py-[0.75rem] text-body-4 w-full text-text-error hover:bg-card-hover rounded-2xl! transition-all duration-300"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className={`
            cursor-pointer
            h-10 w-10 rounded-full!
            border border-text-primary!
            bg-(--whitebg)
            lg:hidden
          `}
          onClick={toggleMenu}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <motion.div
            className={`
              h-full w-full
              flex flex-col items-center justify-center
              gap-[3px]
            `}
            initial={false}
            animate={menuOpen ? "open" : "closed"}
          >
            <motion.span
              variants={line1Variants}
              className="h-0.5 w-[15px] rounded-xs bg-text-primary origin-center"
            />
            <motion.span
              variants={line2Variants}
              className="h-0.5 w-[15px] rounded-xs bg-text-primary origin-center"
            />
            <motion.span
              variants={line3Variants}
              className="h-0.5 w-[15px] rounded-xs bg-text-primary origin-center"
            />
          </motion.div>
        </button>
      </div>
    </div>
  );
};

const line1Variants = {
  closed: { rotate: 0, y: 0 },
  open: { rotate: 45, y: 5 },
};

const line2Variants = {
  closed: { opacity: 1 },
  open: { opacity: 0 },
};

const line3Variants = {
  closed: { rotate: 0, y: 0 },
  open: { rotate: -45, y: -5 },
};

export default UserHeader;
