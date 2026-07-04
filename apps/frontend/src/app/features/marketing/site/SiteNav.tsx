'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IoLogoGithub, IoMenuOutline, IoCloseOutline } from 'react-icons/io5';
import { GITHUB_REPO_URL, MARKETING_LOGO } from './assets';
import { useGithubStats } from './useGithubStats';
import { useScrolled } from './motion';

export type NavKey =
  | 'pet-businesses'
  | 'pet-parents'
  | 'developers'
  | 'pricing'
  | 'contact'
  | 'about';

interface NavItem {
  key: NavKey;
  label: string;
  href: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { key: 'pet-businesses', label: 'Pet Businesses', href: '/pet-businesses' },
  { key: 'pet-parents', label: 'Pet Parents', href: '/pet-parents' },
  { key: 'developers', label: 'Developers', href: '/developers' },
  { key: 'pricing', label: 'Pricing', href: '/pricing' },
  { key: 'contact', label: 'Contact', href: '/contact-us' },
  { key: 'about', label: 'About', href: '/about' },
];

interface SiteNavProps {
  active?: NavKey;
}

const linkBase: CSSProperties = {
  textDecoration: 'none',
  fontSize: 15,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '8px 14px',
  borderRadius: 9999,
  transition: 'color 150ms, background 150ms',
};

export function SiteNav({ active }: Readonly<SiteNavProps>) {
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const { stars } = useGithubStats();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const starsLabel = stars ? `★ ${stars}` : '★';

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const navBackground = scrolled ? 'rgba(241,235,225,0.58)' : 'transparent';
  const navShadow = scrolled
    ? '0 1px 0 rgba(255,255,255,0.5), 0 8px 24px rgba(29,28,27,0.05)'
    : 'none';

  return (
    <header
      data-nav="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: navBackground,
        backdropFilter: scrolled ? 'blur(24px) saturate(160%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(160%)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'rgba(29,28,27,0.05)' : 'transparent'}`,
        boxShadow: navShadow,
        transition:
          'background 300ms ease, box-shadow 300ms ease, border-color 300ms ease, backdrop-filter 300ms ease',
      }}
    >
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          height: 72,
        }}
      >
        <Link
          href="/"
          aria-label="Yosemite Crew home"
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <Image
            src={MARKETING_LOGO}
            alt="Yosemite Crew"
            width={46}
            height={46}
            priority
            style={{ objectFit: 'contain' }}
          />
        </Link>

        <nav
          aria-label="Primary"
          className="yc-nav-links"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  ...linkBase,
                  color: isActive ? '#1657c9' : '#5c5956',
                  background: isActive ? 'rgba(37,123,237,0.08)' : 'transparent',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="yc-nav-cta" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: '#302f2e',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              padding: '9px 16px',
              border: '1px solid rgba(255,255,255,0.65)',
              borderRadius: 9999,
              background: 'linear-gradient(180deg, rgba(255,253,250,0.9), rgba(250,246,239,0.8))',
              backdropFilter: 'blur(30px) saturate(190%)',
              WebkitBackdropFilter: 'blur(30px) saturate(190%)',
              boxShadow:
                '0 2px 4px rgba(29,28,27,0.05), 0 8px 20px rgba(29,28,27,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
            }}
          >
            <IoLogoGithub style={{ fontSize: 16 }} aria-hidden="true" />
            <span>Star</span>
            <span style={{ color: '#8f8984', fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>
              {starsLabel}
            </span>
          </a>
          <Link
            href="/signup"
            style={{
              textDecoration: 'none',
              background: '#302f2e',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              padding: '11px 22px',
              borderRadius: 9999,
              transition: 'background 150ms',
            }}
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="yc-nav-burger"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            border: '1px solid #e5dccf',
            borderRadius: 14,
            background: 'rgba(239,232,220,0.7)',
            color: '#302f2e',
            cursor: 'pointer',
          }}
        >
          {menuOpen ? (
            <IoCloseOutline style={{ fontSize: 24 }} />
          ) : (
            <IoMenuOutline style={{ fontSize: 24 }} />
          )}
        </button>
      </div>

      <div
        ref={panelRef}
        className="yc-nav-panel"
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          top: 78,
          zIndex: 99,
          background: 'rgba(239,232,220,0.93)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          border: '1px solid rgba(239,232,220,0.93)',
          boxShadow: '0 24px 60px rgba(29,28,27,0.16)',
          borderRadius: 24,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          transform: menuOpen ? 'translateY(0)' : 'translateY(-12px)',
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'auto' : 'none',
          transition:
            'opacity 260ms cubic-bezier(0.16,1,0.3,1), transform 260ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            aria-current={item.key === active ? 'page' : undefined}
            style={{
              textDecoration: 'none',
              color: item.key === active ? '#1657c9' : '#302f2e',
              fontSize: 17,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              padding: '14px 16px',
              borderRadius: 14,
            }}
          >
            {item.label}
          </Link>
        ))}
        <div style={{ height: 1, background: '#e5dccf', margin: '10px 4px' }} />
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener"
          onClick={() => setMenuOpen(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            textDecoration: 'none',
            color: '#302f2e',
            fontSize: 15,
            fontWeight: 500,
            padding: '13px 16px',
            border: '1px solid #e0d7c9',
            borderRadius: 9999,
            margin: '4px 0',
          }}
        >
          <IoLogoGithub style={{ fontSize: 16 }} aria-hidden="true" /> Star on GitHub
        </a>
        <Link
          href="/signup"
          onClick={() => setMenuOpen(false)}
          style={{
            textDecoration: 'none',
            display: 'flex',
            justifyContent: 'center',
            background: '#302f2e',
            color: '#fff',
            fontSize: 15,
            fontWeight: 500,
            padding: '13px 16px',
            borderRadius: 9999,
            margin: '4px 0',
          }}
        >
          Get started
        </Link>
      </div>
    </header>
  );
}
