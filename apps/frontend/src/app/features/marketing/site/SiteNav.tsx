'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IoLogoGithub, IoMenuOutline, IoCloseOutline } from 'react-icons/io5';
import { GITHUB_REPO_URL, MARKETING_LOGO } from './assets';
import { useGithubStats } from './useGithubStats';
import { useScrolled } from './motion';
import { ThemeToggle } from './ThemeToggle';

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
    globalThis.window.addEventListener('keydown', onKey);
    return () => globalThis.window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const navBackground = scrolled ? 'var(--nav-glass)' : 'transparent';
  const navShadow = scrolled ? 'var(--nav-shadow)' : 'none';

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
        backdropFilter: scrolled ? 'blur(40px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(40px) saturate(180%)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'var(--nav-border)' : 'transparent'}`,
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
                  color: isActive ? 'var(--nav-active)' : 'var(--ink-muted)',
                  background: isActive ? 'var(--nav-active-bg)' : 'transparent',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="yc-nav-cta" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle style={{ width: 40, height: 40 }} />
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: 'var(--ink-body)',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              padding: '9px 16px',
              border: '1px solid var(--glass-btn-border)',
              borderRadius: 9999,
              background: 'var(--glass-btn)',
              backdropFilter: 'blur(30px) saturate(190%)',
              WebkitBackdropFilter: 'blur(30px) saturate(190%)',
              boxShadow:
                '0 2px 4px var(--sh05), 0 8px 20px var(--sh08), inset 0 1px 0 var(--glass-inset-hi)',
            }}
          >
            <IoLogoGithub style={{ fontSize: 16 }} aria-hidden="true" />
            <span>Star</span>
            <span
              style={{
                color: 'var(--ink-faint)',
                fontWeight: 400,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {starsLabel}
            </span>
          </a>
          <Link
            href="/signup"
            style={{
              textDecoration: 'none',
              background: 'var(--cta)',
              color: 'var(--cta-text)',
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
            border: '1px solid var(--hairline)',
            borderRadius: 14,
            background: 'var(--glass-92)',
            color: 'var(--ink-body)',
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
        // Kept mounted for the slide transition; while closed it is removed from
        // the tab order and the accessibility tree so hidden links are not focusable.
        inert={!menuOpen}
        aria-hidden={!menuOpen}
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          top: 78,
          zIndex: 99,
          background: 'var(--glass-93)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          border: '1px solid var(--hairline-soft)',
          boxShadow: '0 24px 60px var(--sh16)',
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
              color: item.key === active ? 'var(--nav-active)' : 'var(--ink-body)',
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
        <div style={{ height: 1, background: 'var(--hairline)', margin: '10px 4px' }} />
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
            color: 'var(--ink-body)',
            fontSize: 15,
            fontWeight: 500,
            padding: '13px 16px',
            border: '1px solid var(--hairline)',
            borderRadius: 9999,
            margin: '4px 0',
          }}
        >
          <IoLogoGithub style={{ fontSize: 16 }} aria-hidden="true" /> Star on GitHub
        </a>
        <div style={{ display: 'flex', gap: 8, margin: '4px 0' }}>
          <Link
            href="/signup"
            onClick={() => setMenuOpen(false)}
            style={{
              textDecoration: 'none',
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              background: 'var(--cta)',
              color: 'var(--cta-text)',
              fontSize: 15,
              fontWeight: 500,
              padding: '13px 16px',
              borderRadius: 9999,
            }}
          >
            Get started
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
