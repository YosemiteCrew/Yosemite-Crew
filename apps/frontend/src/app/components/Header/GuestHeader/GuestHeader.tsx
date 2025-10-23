import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import classNames from "classnames";
import { motion, AnimatePresence } from "framer-motion";

import { useAuthStore } from "@/app/stores/authStore";
import { NavItem } from "../HeaderInterfaces";
import { Primary } from "../../Buttons";

import "./GuestHeader.css";

const publicNavItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Pet Businesses", href: "/pms" },
  { label: "Pet Parents", href: "/application" },
  { label: "Developers", href: "/developers" },
  { label: "About us", href: "/about" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact us", href: "/contact" },
];

const GuestHeader = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const logoUrl = `https://d2il6osz49gpup.cloudfront.net/Logo.png`;

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const handleClick = (href: string) => {
    setMenuOpen(false);
    setTimeout(() => {
      router.push(href);
    }, 400);
  };

  return (
    <div className="header-container">
      <Link href="/" className="logo">
        <Image src={logoUrl} alt="Logo" width={80} height={80} priority />
      </Link>

      <nav className="navmenu">
        <ul>
          {publicNavItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href ? item.href : "#"}
                className={classNames({ active: pathname === item.href })}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

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
            {publicNavItems.map((item, index) => (
              <div key={item.label} className="mobile-menu-item">
                <button
                  type="button"
                  onClick={() => handleClick(item.href ? item.href : "#")}
                  className={classNames("mobile-menu-item-button", {
                    active: pathname === item.href,
                  })}
                >
                  {item.label}
                </button>
                {index !== publicNavItems.length - 1 && (
                  <div className="mobile-menu-item-sperator"></div>
                )}
              </div>
            ))}
            {pathname !== "/signup" && pathname !== "/signin" && user ? (
              <button
                type="button"
                onClick={() => handleClick("/organizations")}
                className="HeaderSign-mobile"
                aria-label="Sign Up"
              >
                Go to app
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleClick("/signup")}
                className="HeaderSign-mobile"
                aria-label="Sign Up"
              >
                Sign up
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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

      <div className="navmenu-button">
        {pathname !== "/signup" && pathname !== "/signin" && user ? (
          <Primary
            href="/organizations"
            text="Go to app"
            style={{ width: "160px", maxHeight: "60px" }}
          />
        ) : (
          <Primary
            href="/signup"
            text="Sign up"
            style={{ width: "160px", maxHeight: "60px" }}
          />
        )}
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

export default GuestHeader;
