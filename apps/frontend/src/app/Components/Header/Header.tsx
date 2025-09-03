"use client";
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import classNames from "classnames";

import "./Header.css";

import { FaBarsStaggered, FaCaretDown, FaUser } from "react-icons/fa6";
import { IoIosHelpCircleOutline, IoMdClose } from "react-icons/io";
import { IoNotifications } from "react-icons/io5";
import { RiAccountBoxFill } from "react-icons/ri";
import { FaSignInAlt } from "react-icons/fa";

import { useAuthStore } from '@/app/stores/authStore';
import { handleLogout } from '@/app/utils/LogoutApi';
import { Icon } from '@iconify/react/dist/iconify.js';

interface NavItem {
  label: string;
  href?: string;
  children?: NavItem[];
}



const publicNavItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about_us" },
  { label: "PMS", href: "/homepage" },
  { label: "Developers", href: "/developerlanding" },
  { label: "Resources", href: "/resources" },
  { label: "Contact Us", href: "/contact_us" },
  { label: "Blog", href: "/blogpage" },
];

const Header = () => {
  const isVerified = useAuthStore((state) => state.isVerified);
  return (
    <header className="header">
      {isVerified ? <LoggedInHeader /> : <PublicHeader />}
    </header>
  );
};

export default Header;

// -------------------------
// ✅ LOGGED IN HEADER
// -------------------------
const LoggedInHeader = () => {
  const { profile, vetAndTeamsProfile, userType } = useAuthStore(); 
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const roles = useMemo(
    () => ["vet",
      "vetTechnician",
      "nurse",
      "vetAssistant",
      "receptionist",],
    []
  );
  const clinicNavItems: NavItem[] = [
    { label: "Home", href: "/" },
    { label: "Dashboard", href: getDashboardRoute() },
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
  const logoUrl = process.env.NEXT_PUBLIC_BASE_IMAGE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/Logo.png`
    : "/Logo.png";

  function getImageUrl(input: unknown): string {
    if (typeof input === "string") return input;
    if (Array.isArray(input)) return input[0] || logoUrl;
    if (input instanceof File) return URL.createObjectURL(input);
    return logoUrl;
  }

  function getDashboardRoute() {
    switch (userType) {
      case "veterinaryBusiness":
        return "/emptydashboard";
      case "breedingFacility":
      case "petSitter":
      case "groomerShop":
        return "/DoctorDashboard";
      case "vet":
        return "/DoctorDashboard";
      case "vetTechnician":
        return "/DoctorDashboard";
      case "nurse":
        return "/DoctorDashboard";
      case "vetAssistant":
        return "/DoctorDashboard";
      case "receptionist":
        return "/DoctorDashboard";
      default:
        return "/businessDashboard";
    }
  }

  const imageSrc = getImageUrl(
    roles.includes(userType as string)
      ? vetAndTeamsProfile?.image
      : profile?.image
  );

  useEffect(() => {
    document.body.classList.toggle("mobile-nav-active", mobileOpen);
  }, [mobileOpen]);

  const toggleDropdown = (label: string) => {
    setActiveDropdown((prev) => (prev === label ? null : label));
  };

  const renderNavItems = (items: NavItem[], isSubmenu = false) => (
    <ul className={classNames({ dropdown: isSubmenu })}>
      {items.map((item) => {
        const hasChildren = item.children?.length ?? 0 > 0;
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
                      typeof window !== "undefined" &&
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
  const getDisplayName = () => {
    if (roles.includes(userType as string)) {
      const first = vetAndTeamsProfile?.name?.firstName ?? "";
      const last = vetAndTeamsProfile?.name?.lastName ?? "";
      return `${first} ${last}`.trim() || "Complete Your Profile";
    }
    return profile?.name?.businessName ?? "Complete Your Profile";
  };
  return (
    <div className="container-fluid container-xl d-flex align-items-center justify-content-between">
      <Link href="/" className="logo d-flex align-items-center me-auto me-lg-0">
        <Image src={logoUrl} alt="Logo" width={80} height={80} priority />
      </Link>

      <nav className={classNames("navmenu", { open: mobileOpen })}>
        {renderNavItems(clinicNavItems)}
        <button
          className="mobile-nav-toggle d-xl-none"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <IoMdClose size={28} /> : <FaBarsStaggered size={28} />}
        </button>
      </nav>

      <div className="UserInfoHeader">
        <div className="Notify">
          <IoNotifications />
          <div className="count"></div>
        </div>
        <div className="HeaderProfDiv">
          <ul className="NavUL">
            <li className="nav-item dropdown">
              <span className="nav-profile">
                <div className="user">
                  <Image src={imageSrc} alt="Profile" width={40} height={40} />
                </div>
                <div className="userHostDiv">
                  <div className="userName">
                    <p>
                      {getDisplayName()}
                    </p>
                    <FaCaretDown />
                  </div>
                  <p className="Tier">Free tier - Cloud hosted</p>
                </div>
              </span>

              <div className="profileUl">
                <div className='ProfDiv'>
                  <Link href="/"><FaUser /> My Profile</Link>
                  <Link href="#"><RiAccountBoxFill /> Account Settings</Link>
                  <Link href="#"><IoIosHelpCircleOutline /> Need Help?</Link>
                  <Link href='#' onClick={() => handleLogout()}><FaSignInAlt /> Sign Out</Link>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// -------------------------
// ✅ PUBLIC HEADER
// -------------------------
const PublicHeader = () => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logoUrl = process.env.NEXT_PUBLIC_BASE_IMAGE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/Logo.png`
    : "/Logo.png";

  useEffect(() => {
    document.body.classList.toggle("mobile-nav-active", mobileOpen);
  }, [mobileOpen]);

  return (
    <div className="container-fluid container-xl d-flex align-items-center justify-content-between">
      <Link href="/" className="logo d-flex align-items-center me-auto me-lg-0">
        <Image src={logoUrl} alt="Logo" width={80} height={80} priority />
      </Link>

      <nav className={classNames("navmenu", { open: mobileOpen })}>
        <ul>
          {publicNavItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href? item.href : "#"}
                className={classNames({ active: pathname === item.href })}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <button
          className="mobile-nav-toggle d-xl-none"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <IoMdClose size={28} /> : <FaBarsStaggered size={28} />}
        </button>
      </nav>

      { (pathname !== '/signup' && pathname !== '/signin') && <Link href="/signup" className="HeaderSign">
        <Icon icon="carbon:checkmark-filled" width="20" height="20" /> Sign Up
      </Link> }
    </div>
  );
};