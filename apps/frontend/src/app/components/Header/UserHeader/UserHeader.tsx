import React, {useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MdNotificationsActive } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import classNames from "classnames";
import { useAuthStore } from "@/app/stores/authStore";

import "./UserHeader.css";

const appRoutes = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Organisation", href: "/organizations" },
  { name: "Appointments", href: "#" },
  { name: "Tasks", href: "#" },
  { name: "Chat", href: "/chat" },
  { name: "Finance", href: "#" },
  { name: "Companions", href: "/companions" },
  { name: "Inventory", href: "#" },
  { name: "Forms", href: "#" },
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
  const logoUrl = `https://d2il6osz49gpup.cloudfront.net/Logo.png`;
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signout } = useAuthStore();
  const isDev = pathname.startsWith("/developers");
  const routes = isDev ? devRoutes : appRoutes;

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const logoutRedirect = pathname.startsWith("/developers")
    ? "/developers/signin"
    : "/signin";

  const handleLogout = async () => {
    try {
      signout();
      console.log("✅ Signed out using Cognito signout");
      router.replace(logoutRedirect);
    } catch (error) {
      console.error("⚠️ Cognito signout error:", error);
    }
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
