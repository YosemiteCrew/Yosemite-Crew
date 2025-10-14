import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { motion, AnimatePresence } from "framer-motion";

import { useAuthStore } from "@/app/stores/authStore";
import { NavItem } from "./HeaderInterfaces";
import VerifiedProfile from "./VerifiedProfile";
import UnverifiedProfile from "./UnverifiedProfile";

const PrivateHeader = () => {
  const isVerified = false;
  const { signout } = useAuthStore();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const roles = useMemo(
    () => ["owner", "vet", "technician", "nurse", "assistant", "receptionist"],
    []
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const logoUrl = `https://d2il6osz49gpup.cloudfront.net/Logo.png`;

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const clinicNavItems: NavItem[] = [
    { label: "Dashboard", href: "/empty-dashboard" },
    {
      label: "Clinic",
      children: [
        { label: "Specialities", href: "/departmentsmain" },
        { label: "Practice Team", href: "/practiceTeam" },
        { label: "Manage Invites", href: "/inviteteammembers" },
        { label: "Manage Clinic Visibility", href: "/clinicvisiblity" },
      ],
    },
    {
      label: "Operations",
      children: [
        { label: "Queue Management", href: "#" },
        { label: "Appointments", href: "/AppointmentVet" },
        { label: "Assessments", href: "/AssessmentVet" },
        { label: "Prescriptions", href: "#" },
        { label: "Inventory", href: "/inventorydashboard" },
        { label: "Procedure Packages", href: "#" },
      ],
    },
    {
      label: "Finance",
      children: [
        { label: "Revenue Reporting", href: "/RevenueManagement" },
        { label: "Billing", href: "#" },
        { label: "Client Statements", href: "#" },
        { label: "Coupons", href: "#" },
        { label: "Payment Methods", href: "#" },
        { label: "Procedure Estimates", href: "/ProcedureEstimate" },
      ],
    },
    {
      label: "Help & Resources",
      children: [
        { label: "Blog", href: "/blogpage" },
        { label: "Resources", href: "#" },
        { label: "Contact Us", href: "/contact_us" },
      ],
    },
  ];

  const toggleDropdown = (label: string) => {
    setActiveDropdown((prev) => (prev === label ? null : label));
  };

  const handleMobileNavItemsClick = () => {
    setMobileOpen(false);
    setMenuOpen(false);
  };

  const renderNavItems = (items: NavItem[], isSubmenu = false) => (
    <ul className={classNames({ dropdown: isSubmenu })}>
      {items.map((item) => {
        const hasChildren = (item.children?.length ?? 0) > 0;
        const isActive = pathname === item.href;
        const isOpen = activeDropdown === item.label;

        return (
          <li
            key={item.label}
            className={classNames({ dropdown: hasChildren, active: isOpen })}
          >
            {hasChildren ? (
              <>
                <Link
                  href="#"
                  className="dropdown-toggle"
                  onClick={(e) => {
                    if (
                      typeof globalThis.window !== "undefined" &&
                      window.innerWidth < 1200
                    ) {
                      e.preventDefault();
                      toggleDropdown(item.label);
                    }
                  }}
                >
                  {item.label}
                </Link>
                {renderNavItems(item.children!, true)}
              </>
            ) : (
              <Link
                href={item.href!}
                className={classNames({ active: isActive })}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );

  const renderMobileNavItems = (items: NavItem[]) => (
    <>
      {items.map((item) => {
        const hasChildren = (item.children?.length ?? 0) > 0;
        const isActive = pathname === item.href;

        return (
          <div key={item.label} className="verified-mobile-menu-item">
            {hasChildren ? (
              <>
                <div className="verified-mobile-menu-item-label">
                  {item.label}
                </div>
                <div className="verified-mobile-submenu">
                  {item.children!.map((subItem, index) => (
                    <div
                      key={subItem.label}
                      className="verified-mobile-submenu-item"
                    >
                      <Link
                        href={subItem.href!}
                        className={classNames({
                          active: pathname === subItem.href,
                        })}
                        onClick={handleMobileNavItemsClick}
                      >
                        {subItem.label}
                      </Link>
                      {index !== (item.children?.length ?? 0) - 1 && (
                        <div className="verified-mobile-menu-item-sperator"></div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Link
                href={item.href!}
                className={classNames("verified-mobile-menu-item-label", {
                  active: isActive,
                })}
                onClick={() => {
                  setMobileOpen(false);
                  setMenuOpen(false);
                }}
              >
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </>
  );

  const handleLogout = async () => {
    try {
      signout();
      console.log("✅ Signed out using Cognito signout");
    } catch (error) {
      console.error("⚠️ Cognito signout error:", error);
    }
  };

  return (
    <div className="container-fluid container-xl d-flex align-items-center justify-content-between">
      <Link href="/" className="logo d-flex align-items-center me-auto me-lg-0">
        <Image src={logoUrl} alt="Logo" width={80} height={80} priority />
      </Link>

      <nav className={classNames("navmenu", { open: mobileOpen })}>
        {isVerified && renderNavItems(clinicNavItems)}
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
            className="private-header-mobile-menu"
          >
            {renderMobileNavItems(clinicNavItems)}
            <div className="">
              <div className="verified-profile-mobile-section">
                <Image
                  src={logoUrl}
                  alt="Logo"
                  width={40}
                  height={40}
                  priority
                />
                <div className="verified-mobile-menu-item-label title">
                  San Fransisco Medical Care Center
                </div>
              </div>
              <div className="verified-mobile-submenu">
                <div className="verified-mobile-submenu-item">
                  <a href="/setting">Settings</a>
                </div>
                <div className="verified-mobile-menu-item-sperator"></div>
                <div className="verified-mobile-submenu-item danger">
                  <Link href="/">Sign Out</Link>
                </div>
              </div>
            </div>
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

      {isVerified ? (
        <VerifiedProfile roles={roles} handleLogout={handleLogout} />
      ) : (
        <UnverifiedProfile handleLogout={handleLogout} />
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

export default PrivateHeader;
