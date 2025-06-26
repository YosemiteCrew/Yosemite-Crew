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

interface NavItem {
  label: string;
  href?: string;
  children?: NavItem[];
}

interface HeaderProps {
  isLoggedIn: boolean;
}

const navItems: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Clinic',
    children: [
      { label: 'Dropdown 1', href: '/clinic/dropdown1' },
      { label: 'Dropdown 2', href: '/clinic/dropdown2' },
    ]
  },
  {
    label: 'Operations',
    children: [
      { label: 'Dropdown 1', href: '/operations/dropdown1' },
      { label: 'Dropdown 2', href: '/operations/dropdown2' },
    ]
  },
  {
    label: 'Finance',
    children: [
      { label: 'Dropdown 1', href: '/finance/dropdown1' },
      { label: 'Dropdown 2', href: '/finance/dropdown2' },
    ]
  },
  {
    label: 'Help & Resources',
    children: [
      { label: 'Dropdown 1', href: '/help/dropdown1' },
      { label: 'Dropdown 2', href: '/help/dropdown2' },
    ]
  }
];

const Header: React.FC<HeaderProps> = ({ isLoggedIn }) => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

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

        {isLoggedIn && (
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
                  <div className="dropdown profileUl">
                    <div className='ProfDiv'>
                      <Link href="#"><FaUser /> My Profile</Link>
                      <Link href="#"><RiAccountBoxFill/> Account Settings</Link>
                      <Link href="#"><IoIosHelpCircleOutline/> Need Help?</Link>
                      <Link href="/signup"><FaSignInAlt/> Sign Out</Link>
                    </div>
                    {/* <li><Link href="#"><RiAccountBoxFill/> Account Settings</Link></li>
                    <li><Link href="#"><IoIosHelpCircleOutline/> Need Help?</Link></li>
                    <li><Link href="/signup"><FaSignInAlt/> Sign Out</Link></li> */}
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
