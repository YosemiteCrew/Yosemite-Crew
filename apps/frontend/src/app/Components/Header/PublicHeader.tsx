import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react/dist/iconify.js";
import classNames from "classnames";
import { motion, AnimatePresence } from "framer-motion";

import { NavItem } from "./HeaderInterfaces";

const publicNavItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Pet Business", href: "/homepage" },
  { label: "Pet Parent", href: "/petowner" },
  { label: "Developers", href: "/developerlanding" },
  // { label: "Resources", href: "/resources" },
  { label: "About Us", href: "/about_us" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact Us", href: "/contact_us" },
  // { label: "Blog", href: "/blogpage" },
];

const PublicHeader = () => {
  const pathname = usePathname();
  const router = useRouter();
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
    <div className="container-fluid container-xl d-flex align-items-center justify-content-between">
      <Link href="/" className="logo d-flex align-items-center me-auto me-lg-0">
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
              height: `calc(100vh - 100px)`,
              opacity: 1,
              transition: { duration: 0.4, ease: [0.42, 0, 0.58, 1] },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: { duration: 0.3, ease: [0.42, 0, 0.58, 1] },
            }}
            style={{
              top: "100px",
            }}
            className="public-header-mobile-menu"
          >
            {publicNavItems.map((item) => (
              <div key={item.label} className="mobile-menu-item">
                <a
                  // href={item.href ? item.href : "#"}
                  onClick={() => handleClick(item.href ? item.href : "#")}
                  className={classNames({ active: pathname === item.href })}
                >
                  {item.label}
                </a>
                <div className="mobile-menu-item-sperator"></div>
              </div>
            ))}
            {pathname !== "/signup" && pathname !== "/signin" && (
              <a
                onClick={() => handleClick("/signup")}
                className="HeaderSign-mobile"
              >
                <Icon icon="carbon:checkmark-filled" width="20" height="20" />{" "}
                Sign Up
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="menu-toggle" onClick={toggleMenu}>
        <motion.div
          className="hamburger-icon"
          initial={false}
          animate={menuOpen ? "open" : "closed"}
        >
          <motion.span variants={line1Variants} />
          <motion.span variants={line2Variants} />
          <motion.span variants={line3Variants} />
        </motion.div>
      </div>

      {pathname !== "/signup" && pathname !== "/signin" && (
        <Link href="/signup" className="HeaderSign">
          <Icon icon="carbon:checkmark-filled" width="20" height="20" /> Sign Up
        </Link>
      )}
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

export default PublicHeader;
