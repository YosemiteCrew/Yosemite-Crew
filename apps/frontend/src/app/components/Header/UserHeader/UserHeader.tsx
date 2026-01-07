import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MdNotificationsActive } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import classNames from "classnames";
import { useSignOut } from "@/app/hooks/useAuth";

import "./UserHeader.css";
import { useOrgStore } from "@/app/stores/orgStore";
import { useOrgList, usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import { isHttpsImageUrl } from "@/app/utils/urls";
import { FaCaretDown } from "react-icons/fa6";

const appRoutes = [
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

const devRoutes = [
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
  const logoUrl = `https://d2il6osz49gpup.cloudfront.net/Logo.png`;
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isDev = pathname.startsWith("/developers");
  const routes = isDev ? devRoutes : appRoutes;
  const [selectOrg, setSelectOrg] = useState(false);
  const orgs = useOrgList();
  const primaryOrg = usePrimaryOrg();
  const setPrimaryOrg = useOrgStore((s) => s.setPrimaryOrg);

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

  return (
    <div className="user-header-container">
      <Link href="/" className="logo">
        <Image src={logoUrl} alt="Logo" width={80} height={80} priority />
      </Link>

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
            className="public-header-mobile-menu"
          >
            {routes.map((item, index) => (
              <div key={item.name} className="mobile-menu-item">
                <button
                  type="button"
                  onClick={() => handleClick(item)}
                  className={classNames("mobile-menu-item-button", {
                    active: pathname === item.href,
                  })}
                >
                  {item.name}
                </button>
                {index !== routes.length - 1 && (
                  <div className="mobile-menu-item-sperator"></div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="headerRight">
        <MdNotificationsActive
          color="#595958"
          size={28}
          style={{ cursor: "pointer" }}
        />
        {primaryOrg && (
          <div className="relative">
            <button
              className="flex items-center gap-2.5"
              onClick={() => setSelectOrg((e) => !e)}
            >
              <Image
                src={
                  isHttpsImageUrl(primaryOrg.imageURL)
                    ? primaryOrg.imageURL
                    : "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
                }
                alt="Logo"
                height={42}
                width={42}
                className="rounded-full min-w-[42px] max-h-[42px] h-[42px] object-cover"
              />
              <div className="font-satoshi font-medium text-black-text text-[16px] tracking-tight leading-6">
                Manipal Hospital
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
        <button
          type="button"
          className="menu-toggle"
          onClick={toggleMenu}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <motion.div
            className="hamburger-icon"
            initial={false}
            animate={menuOpen ? "open" : "closed"}
          >
            <motion.span variants={line1Variants} />
            <motion.span variants={line2Variants} />
            <motion.span variants={line3Variants} />
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
