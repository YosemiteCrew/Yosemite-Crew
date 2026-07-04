'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IoArrowBackOutline, IoStar } from 'react-icons/io5';
import { CERT_BADGES, GITHUB_REPO_URL, MARKETING_LOGO } from './assets';
import { useGithubStats } from './useGithubStats';

export interface AuthBrandPoint {
  icon: ReactNode;
  text: string;
}

interface AuthBrandContentProps {
  eyebrow: string;
  /** Headline with an italic em-word span, e.g. See the <em>whole</em> animal. */
  title: ReactNode;
  subtitle: string;
  points: readonly AuthBrandPoint[];
}

/** Swappable middle block of the auth brand panel (clinic vs developer copy). */
export function AuthBrandContent({
  eyebrow,
  title,
  subtitle,
  points,
}: Readonly<AuthBrandContentProps>) {
  const { stars } = useGithubStats();
  return (
    <div style={{ position: 'relative', zIndex: 2, maxWidth: 460 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.11em',
          textTransform: 'uppercase',
          color: '#5ce1e6',
          animation: 'ycFade 0.9s ease 0.1s both',
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: '20px 0 0',
          fontFamily: 'var(--font-newsreader)',
          fontSize: 'clamp(38px, 4vw, 54px)',
          fontWeight: 400,
          lineHeight: 1.04,
          letterSpacing: '-0.03em',
          color: '#f4efe6',
          animation: 'ycUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.16s both',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: '20px 0 0',
          fontSize: 16.5,
          lineHeight: 1.62,
          letterSpacing: '-0.01em',
          color: '#b7ac9d',
          animation: 'ycUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.24s both',
        }}
      >
        {subtitle}
      </p>
      <div
        style={{
          margin: '34px 0 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          animation: 'ycUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.34s both',
        }}
      >
        {points.map((point) => (
          <div key={point.text} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span
              style={{
                flex: 'none',
                width: 38,
                height: 38,
                borderRadius: 11,
                background: 'rgba(234,226,213,0.10)',
                border: '1px solid rgba(234,226,213,0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8fb6f5',
              }}
            >
              {point.icon}
            </span>
            <div
              style={{
                paddingTop: 8,
                fontSize: 15,
                lineHeight: 1.45,
                letterSpacing: '-0.01em',
                color: '#d8cec0',
              }}
            >
              {point.text}
            </div>
          </div>
        ))}
      </div>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener"
        style={{
          marginTop: 32,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 11,
          textDecoration: 'none',
          padding: '10px 16px 10px 14px',
          borderRadius: 9999,
          border: '1px solid rgba(234,226,213,0.18)',
          background: 'rgba(234,226,213,0.05)',
          color: '#eae2d5',
          fontSize: 14,
          letterSpacing: '-0.01em',
          animation: 'ycUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.42s both',
        }}
      >
        <IoStar style={{ fontSize: 16, color: '#ffd479' }} />
        <span style={{ fontWeight: 600, color: '#fff' }}>
          {stars ? `Star on GitHub · ${stars}` : 'Star on GitHub'}
        </span>
        <span
          style={{ width: 1, height: 13, background: 'rgba(234,226,213,0.22)' }}
          aria-hidden="true"
        />
        <span style={{ color: '#b7ac9d' }}>building in the open</span>
      </a>
    </div>
  );
}

interface AuthShellProps {
  /** Swappable brand-panel middle block. */
  brand: ReactNode;
  /** Top-right prompt of the form column, e.g. Already have an account? Sign in. */
  topRight: ReactNode;
  children: ReactNode;
}

/** Cinematic split-screen auth shell: dark brand panel + form column. */
export function AuthShell({ brand, topRight, children }: Readonly<AuthShellProps>) {
  return (
    <div
      data-authgrid="true"
      style={{ display: 'grid', gridTemplateColumns: '1.06fr 1fr', minHeight: '100svh' }}
    >
      <div
        data-brandpanel="true"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(158deg, #2a2723 0%, #1b1a16 52%, #131210 100%)',
          padding: 'clamp(44px, 4.6vw, 76px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#eae2d5',
        }}
      >
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
        >
          <div
            style={{
              position: 'absolute',
              top: -180,
              right: -140,
              width: 620,
              height: 520,
              background: 'radial-gradient(closest-side, rgba(37,123,237,0.26), transparent 70%)',
              animation: 'ycDrift 36s ease-in-out infinite alternate',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -200,
              left: -160,
              width: 600,
              height: 500,
              background: 'radial-gradient(closest-side, rgba(92,225,230,0.14), transparent 70%)',
              animation: 'ycDrift 46s ease-in-out 4s infinite alternate-reverse',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '8%',
              right: -80,
              width: 360,
              height: 320,
              background: 'radial-gradient(closest-side, rgba(255,144,212,0.10), transparent 70%)',
              animation: 'ycDrift 54s ease-in-out 2s infinite alternate',
            }}
          />
        </div>

        <Link
          href="/"
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'inline-flex',
            alignItems: 'center',
            width: 'fit-content',
            textDecoration: 'none',
          }}
        >
          <Image
            src={MARKETING_LOGO}
            alt="Yosemite Crew"
            width={54}
            height={54}
            style={{ objectFit: 'contain' }}
          />
        </Link>

        {brand}

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            animation: 'ycFade 1s ease 0.6s both',
          }}
        >
          <Image
            src={CERT_BADGES.gdpr}
            alt="GDPR"
            width={60}
            height={30}
            style={{
              height: 30,
              width: 'auto',
              opacity: 0.62,
              filter: 'grayscale(1) brightness(2.2)',
            }}
            unoptimized
          />
          <Image
            src={CERT_BADGES.soc2}
            alt="SOC 2"
            width={60}
            height={30}
            style={{
              height: 30,
              width: 'auto',
              opacity: 0.62,
              filter: 'grayscale(1) brightness(2.2)',
            }}
            unoptimized
          />
          <Image
            src={CERT_BADGES.iso}
            alt="ISO 27001"
            width={60}
            height={30}
            style={{
              height: 30,
              width: 'auto',
              opacity: 0.62,
              filter: 'grayscale(1) brightness(2.2)',
            }}
            unoptimized
          />
          <Image
            src={CERT_BADGES.fhir}
            alt="FHIR"
            width={60}
            height={30}
            style={{
              height: 30,
              width: 'auto',
              opacity: 0.62,
              filter: 'grayscale(1) brightness(2.2)',
            }}
            unoptimized
          />
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(180deg, #efe8dc, #e8e0d2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: '22px clamp(20px, 4vw, 44px)',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              textDecoration: 'none',
              color: '#5c5956',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              padding: '8px 15px 8px 12px',
              borderRadius: 9999,
              border: '1px solid #e0d7c9',
              background: 'rgba(253,251,246,0.7)',
            }}
            className="yc-switch"
          >
            <IoArrowBackOutline style={{ fontSize: 16 }} /> Back to home
          </Link>
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              fontSize: 14.5,
              letterSpacing: '-0.01em',
              color: '#5c5956',
            }}
          >
            {topRight}
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          style={{
            position: 'relative',
            zIndex: 2,
            flex: '1 0 auto',
            display: 'grid',
            placeItems: 'center',
            padding: '16px clamp(20px, 4vw, 48px) 48px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: 'min(408px, 100%)',
              animation: 'ycUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.12s both',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
