'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import classNames from 'classnames';
import './Header.css';
import { FaBarsStaggered, FaCaretDown, FaUser } from 'react-icons/fa6';
import { IoIosHelpCircleOutline, IoMdClose } from 'react-icons/io';
import { IoNotifications } from 'react-icons/io5';
import { FaSignInAlt } from 'react-icons/fa';
import { RiAccountBoxFill } from 'react-icons/ri';
import { useAuthStore } from '@/app/stores/authStore';
import { handleLogout } from '@/app/utils/LogoutApi';

interface NavItem {
  label: string;
  href?: string;
  children?: NavItem[];
}

// interface HeaderProps {
//   isLoggedIn?: boolean;
// }

const navItems: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Clinic',
    children: [
      { label: 'Specialities', href: '/departmentsmain' },
      { label: 'Practice Team', href: '/practiceTeam' },
      { label: 'Manage Invites', href: '/inviteteammembers' },
      { label: 'Manage Clinic Visibility', href: '/clinicvisiblity' },
    ]
  },
  {
    label: 'Operations',
    children: [
      { label: 'Queue Management', href: '#' },
      { label: 'Appointments', href: '/AppointmentVet' },
      { label: 'Assessments', href: '/AssessmentVet' },
      { label: 'Prescriptions', href: '#' },
      { label: 'Inventory', href: '/inventorydashboard' },
      { label: 'Procedure Packages', href: '#' },
    ]
  },
  {
    label: 'Finance',
    children: [
      { label: 'Revenue Reporting', href: '/RevenueManagement' },
      { label: 'Billing', href: '#' },
      { label: 'Client Statements', href: '#' },
      { label: 'Coupons', href: '#' },
      { label: 'Payment Methods', href: '#' },
      { label: 'Procedure Estimates', href: '/ProcedureEstimate' },
    ]
  },
  {
    label: 'Help & Resources',
    children: [
      { label: 'Blog', href: '/blogpage' },
      { label: 'Resources', href: '#' },
      { label: 'Contact Us', href: '/contact_us' },
    ]
  },
  
];

const Header = () => {
  const { userType } = useAuthStore();
  console.log("userType", userType);
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const isVerified = useAuthStore((state) => state.isVerified);
  useEffect(() => {
    document.body.classList.toggle('mobile-nav-active', mobileOpen);
  }, [mobileOpen]);

  const toggleDropdown = (label: string) => {
    setActiveDropdown(prev => (prev === label ? null : label));
  };

  const renderNavItems = (items: NavItem[], isSubmenu = false) => (
    <ul className={classNames({ dropdown: isSubmenu })}>
      {items.map(item => {
        const hasChildren = item.children?.length ?? 0 > 0;
        const isActive = pathname === item.href;
        const isOpen = activeDropdown === item.label;

        return (
          <li key={item.label} className={classNames({ dropdown: hasChildren, active: isOpen })}>
            {hasChildren ? (
              <>
                <Link
                  href="#"
                  className="dropdown-toggle"
                  onClick={(e) => {
                    if (typeof window !== 'undefined' && window.innerWidth < 1200) {
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

  const logoUrl = process.env.NEXT_PUBLIC_BASE_IMAGE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/Logo.png`
    : '/Logo.png';

  return (
    <header className="header d-flex align-items-center">
      <div className="container-fluid container-xl d-flex align-items-center justify-content-between">
        <Link href="/" className="logo d-flex align-items-center me-auto me-lg-0">
          <Image
            aria-hidden
            src={logoUrl}
            alt="Logo"
            width={80}
            height={80}
            priority
          />
        </Link>

        <nav className={classNames('navmenu', { open: mobileOpen })}>
          {renderNavItems(navItems)}
          <button className="mobile-nav-toggle d-xl-none" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <IoMdClose size={28} /> : <FaBarsStaggered size={28} />}
          </button>
        </nav>
        {isVerified && (
          <div className="UserInfoHeader">

            <div className="Notify">
              <IoNotifications />
              <div className="count">
              </div>
            </div>
            <div className="HeaderProfDiv">
              <ul className="NavUL">
                <li className="nav-item dropdown">
                  <span className="nav-profile">
                    <div className="user">
                      <Image src={logoUrl} alt="Profile" width={40} height={40} />
                    </div>
                    <div className="userHostDiv">
                      <div className="userName">
                        <p>San Francisco Animal<br />Medical Center </p>
                        <FaCaretDown />
                      </div>
                      <p className='Tier'>Free tier - Cloud hosted</p>
                    </div>
                    
                  </span>
                  <div className="profileUl">
                    <div className='ProfDiv'>
                      <Link href="#"><FaUser /> My Profile</Link>
                      <Link href="#"><RiAccountBoxFill/> Account Settings</Link>
                      <Link href="#"><IoIosHelpCircleOutline/> Need Help?</Link>
                      <Link href="/signup" onClick={()=>handleLogout()}><FaSignInAlt/> Sign Out</Link>
                    </div>
                    {/* <li><Link href="#"><RiAccountBoxFill/> Account Settings</Link></li>
                    <li><Link href="#"><IoIosHelpCircleOutline/> Need Help?</Link></li> */}
                    {/* <li><Link href="/signup"><FaSignInAlt/> Sign Out</Link></li>  */}
                  </div>
                </li>
              </ul>
            </div>

          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
