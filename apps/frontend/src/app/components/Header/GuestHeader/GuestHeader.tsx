import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { useAuthStore } from "@/app/stores/authStore";
import { Primary } from "../../Buttons";

interface NavItem {
  label: string;
  href?: string;
  children?: NavItem[];
}

const publicNavItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Pet Businesses", href: "/pms" },
  { label: "Pet Parents", href: "/application" },
  { label: "Developers", href: "/developers" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact us", href: "/contact" },
  { label: "About us", href: "/about" },
];

const GuestHeader = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const logoUrl = `https://d2il6osz49gpup.cloudfront.net/Logo.png`;

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const handleClick = (href: string) => {
    setMenuOpen(false);
    setTimeout(() => {
      router.push(href);
    }, 400);
  };

  const isSignInPage = pathname === "/signin";
  const isSignUpPage = pathname === "/signup";
  const isAuthPage = isSignInPage || isSignUpPage;
  const hideButtons = pathname === "/organizations" || pathname === "/forgot-password";

  return (
    <div className="flex items-center justify-between px-3! sm:px-12! lg:px-20! gap-10 w-full h-20">
      <Link href="/" className="logo">
        <Image src={logoUrl} alt="Logo" width={90} height={83} priority />
      </Link>

      <div className="max-w-[800px] flex-1 hidden lg:flex">
        <ul className="list-none flex items-center justify-between flex-1 p-0 m-0">
          {publicNavItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href ? item.href : "#"}
                className={`${item.href === pathname ? "text-text-primary!" : "text-text-tertiary!"} inline-block text-body-4 hover:text-text-brand! transition-all duration-200 ease-out hover:scale-108!`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

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
            className="px-3 sm:px-12! py-6 bg-white z-999 fixed left-0 w-screen overflow-auto flex flex-col gap-3"
          >
            {publicNavItems.map((item) => (
              <button
                type="button"
                key={item.label}
                onClick={() => handleClick(item.href ? item.href : "#")}
                className={`text-body-4 px-3 py-2 rounded-2xl! border border-card-border! text-start transition-all duration-300 ease-in hover:bg-card-border ${item.href === pathname && "text-text-brand border-text-brand! bg-brand-100"}`}
              >
                {item.label}
              </button>
            ))}
            {!hideButtons &&
              (user ? (
                <Primary
                  href="#"
                  onClick={() => handleClick("/organizations")}
                  text="Go to app"
                  classname="mt-3"
                />
              ) : isSignInPage ? (
                <Primary
                  href="#"
                  onClick={() => handleClick("/signup")}
                  text="Sign up"
                  classname="mt-3"
                />
              ) : isSignUpPage ? (
                <Primary
                  href="#"
                  onClick={() => handleClick("/signin")}
                  text="Sign in"
                  classname="mt-3"
                />
              ) : (
                <Primary
                  href="#"
                  onClick={() => handleClick("/signup")}
                  text="Sign up"
                  classname="mt-3"
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        className={`
                  cursor-pointer
                  h-10 w-10 rounded-full!
                  border border-(--black-bg)!
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
            className="h-0.5 w-[15px] rounded-xs bg-black origin-center"
          />
          <motion.span
            variants={line2Variants}
            className="h-0.5 w-[15px] rounded-xs bg-black origin-center"
          />
          <motion.span
            variants={line3Variants}
            className="h-0.5 w-[15px] rounded-xs bg-black origin-center"
          />
        </motion.div>
      </button>

      {!hideButtons &&
        (user ? (
          <div className="hidden lg:flex">
            <Primary
              href={
                role === "developer" ? "/developers/home" : "/organizations"
              }
              text="Go to app"
            />
          </div>
        ) : isSignInPage ? (
          <div className="hidden lg:flex">
            <Primary href="/signup" text="Sign up" />
          </div>
        ) : isSignUpPage ? (
          <div className="hidden lg:flex">
            <Primary href="/signin" text="Sign in" />
          </div>
        ) : (
          <div className="hidden lg:flex">
            <Primary href="/signup" text="Sign up" />
          </div>
        ))}
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
