'use client';

import { type CSSProperties, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  IoArrowForwardOutline,
  IoLogoApple,
  IoLogoWindows,
  IoGridOutline,
  IoCalendarOutline,
  IoPawOutline,
  IoDocumentTextOutline,
  IoWalletOutline,
  IoCubeOutline,
  IoChatbubblesOutline,
  IoCloudOfflineOutline,
  IoDownloadOutline,
  IoCheckmark,
  IoWaterOutline,
  IoScanOutline,
  IoMedkitOutline,
  IoShieldCheckmarkOutline,
  IoSyncOutline,
  IoLocationOutline,
  IoInformationCircleOutline,
  IoCheckboxOutline,
  IoPeopleOutline,
  IoExtensionPuzzleOutline,
  IoSearchOutline,
} from 'react-icons/io5';
import {
  HeroVideo,
  HeroGlow,
  InkAnnotate,
  Reveal,
  Spotlight,
  ReleasePill,
  useMagnet,
  useParallax,
  HERO_VIDEOS,
  HERO_POSTERS,
  RELEASES_LATEST_URL,
  MARKETING_LOGO,
  ctaBandContainerStyle,
} from '@/app/features/marketing/site';

const NEWSREADER = 'var(--font-newsreader)';
const EASE = 'cubic-bezier(0.16,1,0.3,1)';

const MAC_DOWNLOAD_URL = RELEASES_LATEST_URL;
const WINDOWS_DOWNLOAD_URL = RELEASES_LATEST_URL;

/* ---------- hoisted static styles ---------- */

const STATUS_BADGE_STYLE: CSSProperties = {
  flex: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  height: 20,
  padding: '0 9px',
  borderRadius: 9999,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const FEATURE_CHECK_ICON_STYLE: CSSProperties = {
  flex: 'none',
  width: 26,
  height: 26,
  borderRadius: 8,
  background: 'var(--blue-soft)',
  color: 'var(--blue)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const DOWNLOAD_BUTTON_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'var(--dl-btn)',
  color: 'var(--dl-btn-text)',
  padding: '10px 18px',
  borderRadius: 14,
  boxShadow: '0 10px 26px var(--sh14)',
  transition: 'background 200ms, transform 200ms',
};

const HERO_CONTENT_STYLE: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1180px, 100%)',
  margin: '0 auto',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const HERO_HEADING_STYLE: CSSProperties = {
  fontFamily: NEWSREADER,
  margin: '26px 0 0',
  fontSize: 'clamp(44px, 6.6vw, 88px)',
  fontWeight: 500,
  lineHeight: 1.03,
  letterSpacing: '-0.06em',
  color: 'var(--ink)',
  maxWidth: '14ch',
  textWrap: 'balance',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  columnGap: '0.24em',
};

const HERO_PARAGRAPH_STYLE: CSSProperties = {
  margin: '26px 0 0',
  maxWidth: 620,
  fontSize: 'clamp(17px, 2vw, 20px)',
  lineHeight: 1.6,
  letterSpacing: '-0.025em',
  color: 'var(--ink-soft)',
  textShadow: '0 1px 16px var(--hero-halo1), 0 1px 3px var(--hero-halo2)',
  opacity: 0,
  animation: `ycHeroUp 1s ${EASE} 0.5s both`,
  textWrap: 'pretty',
};

const CTA_PRIMARY_LINK_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'var(--cta)',
  color: 'var(--cta-text)',
  fontSize: 17,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '16px 32px',
  borderRadius: 9999,
  boxShadow: '0 10px 30px var(--sh18)',
  transition: 'background 200ms',
};

const HERO_SECONDARY_LINK_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'var(--glass-95)',
  color: 'var(--ink-body)',
  fontSize: 17,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '16px 32px',
  borderRadius: 9999,
  border: '1px solid var(--hairline)',
  transition: 'border-color 200ms',
};

const SCHEDULE_ROW_INITIAL_STYLE: CSSProperties = {
  flex: 'none',
  width: 30,
  height: 30,
  borderRadius: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
};

const HERO_SIDEBAR_STYLE: CSSProperties = {
  width: 210,
  flex: 'none',
  borderRight: '1px solid var(--inset)',
  background: 'linear-gradient(180deg, var(--screen), var(--screen-2))',
  padding: '18px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const HERO_FLOAT_CARD_A_STYLE: CSSProperties = {
  position: 'absolute',
  top: '8%',
  right: -34,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 16px',
  borderRadius: 16,
  background: 'var(--glass-92)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  border: '1px solid var(--glass-95)',
  boxShadow: '0 16px 44px var(--sh12)',
  animation: 'ycFloatA 7s ease-in-out infinite',
};

const HERO_FLOAT_ICON_GREEN_STYLE: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 10,
  background: 'var(--avatar-green-bg)',
  color: 'var(--code-str)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const HERO_FLOAT_CARD_B_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: '12%',
  left: -30,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 16px',
  borderRadius: 16,
  background: 'var(--glass-92)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  border: '1px solid var(--glass-95)',
  boxShadow: '0 16px 44px var(--sh12)',
  animation: 'ycFloatB 8.5s ease-in-out 1s infinite',
};

const HERO_FLOAT_ICON_BLUE_STYLE: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 10,
  background: 'var(--blue-soft)',
  color: 'var(--blue)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const RECORD_AVATAR_STYLE: CSSProperties = {
  flex: 'none',
  width: 48,
  height: 48,
  borderRadius: 9999,
  background: 'var(--blue-soft)',
  color: 'var(--blue)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  fontWeight: 700,
};

const FINANCE_LINK_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  textDecoration: 'none',
  color: 'var(--blue-text)',
  fontSize: 17,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  marginTop: 4,
  transition: 'gap 200ms',
};

const OFFLINE_CARD_ICON_STYLE: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: 'var(--inset)',
  color: 'var(--ink-body)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 14,
};

const MODULE_CARD_ICON_STYLE: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 13,
  background: 'var(--pill-raised)',
  color: 'var(--blue)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const CTA_HEADING_STYLE: CSSProperties = {
  fontFamily: NEWSREADER,
  margin: 0,
  fontSize: 'clamp(36px, 5.2vw, 66px)',
  fontWeight: 500,
  lineHeight: 1.06,
  letterSpacing: '-0.055em',
  color: 'var(--ink)',
  textWrap: 'balance',
  fontStyle: 'italic',
};

const CTA_SECONDARY_LINK_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'var(--screen)',
  color: 'var(--ink-body)',
  fontSize: 17,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '16px 32px',
  borderRadius: 9999,
  border: '1px solid var(--hairline)',
  transition: 'border-color 200ms',
};

const heroWord = (text: ReactNode, delay: string, extra?: CSSProperties): ReactNode => (
  <span
    style={{
      display: 'inline-block',
      opacity: 0,
      animation: `ycWord 1.1s ${EASE} ${delay} both`,
      ...extra,
    }}
  >
    {text}
  </span>
);

/* ---------- small shared bits ---------- */

interface StatusBadgeProps {
  label: string;
  bg: string;
  color: string;
}

function StatusBadge({ label, bg, color }: Readonly<StatusBadgeProps>) {
  return <span style={{ ...STATUS_BADGE_STYLE, background: bg, color }}>{label}</span>;
}

interface FeatureCheckProps {
  children: ReactNode;
}

function FeatureCheck({ children }: Readonly<FeatureCheckProps>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={FEATURE_CHECK_ICON_STYLE}>
        <IoCheckmark style={{ fontSize: 15 }} aria-hidden="true" />
      </span>
      <span style={{ fontSize: 15.5, color: 'var(--ink-body)', letterSpacing: '-0.015em' }}>
        {children}
      </span>
    </div>
  );
}

interface DownloadButtonProps {
  linkRef: RefObject<HTMLAnchorElement | null>;
  href: string;
  ariaLabel: string;
  icon: ReactNode;
  label: string;
}

function DownloadButton({ linkRef, href, ariaLabel, icon, label }: Readonly<DownloadButtonProps>) {
  return (
    <a
      ref={linkRef}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      style={DOWNLOAD_BUTTON_STYLE}
    >
      {icon}
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          lineHeight: 1.05,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, letterSpacing: '0.02em', color: 'var(--dl-btn-sub)' }}>
          Download for
        </span>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>{label}</span>
      </span>
    </a>
  );
}

/* ---------- HERO ---------- */

function Hero() {
  const releaseRef = useMagnet<HTMLDivElement>();
  const ctaPrimaryRef = useMagnet<HTMLAnchorElement>();
  const ctaSecondaryRef = useMagnet<HTMLAnchorElement>();
  const macRef = useMagnet<HTMLAnchorElement>();
  const winRef = useMagnet<HTMLAnchorElement>();
  const parallaxRef = useParallax<HTMLElement>();

  return (
    <section
      ref={parallaxRef}
      data-screen-label="Hero"
      data-hero
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, var(--page) 0%, var(--page) 60%, var(--inset) 100%)',
        padding: '148px 24px 90px',
      }}
    >
      <HeroVideo
        src={HERO_VIDEOS.petBusinesses}
        poster={HERO_POSTERS.petBusinesses}
        position="center 40%"
      />
      <HeroGlow
        color="var(--glow-b09)"
        scrollSpeed="-0.05"
        box={{ top: -160, left: 'calc(50% - 620px)', width: 860, height: 600 }}
        animation="ycDrift 30s ease-in-out infinite alternate"
        depth="0.05"
        zIndex={1}
      />
      <HeroGlow
        color="var(--glow-c09)"
        scrollSpeed="0.04"
        box={{ bottom: -220, right: -140, width: 720, height: 540 }}
        animation="ycDrift 38s ease-in-out 3s infinite alternate-reverse"
        depth="0.06"
        zIndex={1}
      />

      <div style={HERO_CONTENT_STYLE}>
        <div ref={releaseRef} style={{ opacity: 0, animation: `ycHeroUp 0.9s ${EASE} 0.05s both` }}>
          <ReleasePill variant="platform" label="Platform PIMS" version="v2.0 beta" />
        </div>

        <HeroHeading />

        <p style={HERO_PARAGRAPH_STYLE}>
          Appointments, records, SOAP notes, invoicing and inventory, the whole clinic in one system
          instead of six tabs and a notebook of workarounds. Built to keep working on the worst
          afternoon, not just the demo.
        </p>

        <HeroCtaRow primaryRef={ctaPrimaryRef} secondaryRef={ctaSecondaryRef} />

        <HeroDownloadRow macRef={macRef} winRef={winRef} />
      </div>

      <HeroMockup />
    </section>
  );
}

function HeroHeading() {
  return (
    <h1 style={HERO_HEADING_STYLE}>
      {heroWord('The', '0.1s')}
      {heroWord('practice,', '0.22s')}
      {heroWord('on', '0.34s')}
      {heroWord(
        <InkAnnotate type="circle" delay={1300}>
          one
        </InkAnnotate>,
        '0.46s',
        {
          fontStyle: 'italic',
          fontWeight: 480,
          color: 'var(--blue-text)',
        }
      )}
      {heroWord('screen.', '0.58s')}
    </h1>
  );
}

interface HeroCtaRowProps {
  primaryRef: RefObject<HTMLAnchorElement | null>;
  secondaryRef: RefObject<HTMLAnchorElement | null>;
}

function HeroCtaRow({ primaryRef, secondaryRef }: Readonly<HeroCtaRowProps>) {
  return (
    <div
      data-stack-m="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginTop: 36,
        opacity: 0,
        animation: `ycHeroUp 1s ${EASE} 0.62s both`,
      }}
    >
      <Link ref={primaryRef} href="/signup" style={CTA_PRIMARY_LINK_STYLE}>
        Get started free <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
      </Link>
      <Link ref={secondaryRef} href="/contact-us" style={HERO_SECONDARY_LINK_STYLE}>
        Book a walkthrough
      </Link>
    </div>
  );
}

interface HeroDownloadRowProps {
  macRef: RefObject<HTMLAnchorElement | null>;
  winRef: RefObject<HTMLAnchorElement | null>;
}

function HeroDownloadRow({ macRef, winRef }: Readonly<HeroDownloadRowProps>) {
  return (
    <div
      data-stack-m="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        marginTop: 20,
        flexWrap: 'wrap',
        opacity: 0,
        animation: `ycHeroUp 1s ${EASE} 0.72s both`,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13.5,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color: '#837d78',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: 9999,
            background: 'var(--success)',
            boxShadow: '0 0 0 3px rgba(0,143,93,0.16)',
          }}
        />
        {'Runs offline. Get the desktop app'}
      </span>
      <div style={{ display: 'flex', gap: 10 }}>
        <DownloadButton
          linkRef={macRef}
          href={MAC_DOWNLOAD_URL}
          ariaLabel="Download the macOS desktop app"
          icon={<IoLogoApple style={{ fontSize: 22 }} aria-hidden="true" />}
          label="macOS"
        />
        <DownloadButton
          linkRef={winRef}
          href={WINDOWS_DOWNLOAD_URL}
          ariaLabel="Download the Windows desktop app"
          icon={<IoLogoWindows style={{ fontSize: 20 }} aria-hidden="true" />}
          label="Windows"
        />
      </div>
    </div>
  );
}

/* ---------- HERO PIMS WINDOW MOCKUP ---------- */

interface ScheduleRowProps {
  time: string;
  initial: string;
  initialBg: string;
  initialColor: string;
  name: string;
  detail: string;
  badge: ReactNode;
}

function ScheduleRow({
  time,
  initial,
  initialBg,
  initialColor,
  name,
  detail,
  badge,
}: Readonly<ScheduleRowProps>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 14px',
        border: '1px solid var(--hairline)',
        borderRadius: 14,
      }}
    >
      <span style={{ fontSize: 12.5, color: 'var(--ink-faint)', width: 38, flex: 'none' }}>
        {time}
      </span>
      <span style={{ ...SCHEDULE_ROW_INITIAL_STYLE, background: initialBg, color: initialColor }}>
        {initial}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--ink-body)',
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{detail}</div>
      </div>
      {badge}
    </div>
  );
}

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
}

function SidebarItem({ icon, label, active = false }: Readonly<SidebarItemProps>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 12,
        background: active ? 'var(--blue-soft)' : undefined,
        color: active ? 'var(--blue)' : 'var(--ink-muted)',
        fontSize: 13.5,
        fontWeight: active ? 700 : 500,
      }}
    >
      {icon}
      {label}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  subColor: string;
  subWeight?: number;
}

function StatCard({ label, value, sub, subColor, subWeight }: Readonly<StatCardProps>) {
  return (
    <div style={{ border: '1px solid var(--hairline)', borderRadius: 16, padding: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{label}</div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: 'var(--ink)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: subColor, fontWeight: subWeight }}>{sub}</div>
    </div>
  );
}

function HeroWindowBar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 20px',
        borderBottom: '1px solid var(--inset)',
        background: 'var(--screen-2)',
      }}
    >
      <div style={{ display: 'flex', gap: 7 }}>
        {['r', 'y', 'g'].map((dot) => (
          <span
            key={dot}
            style={{ width: 11, height: 11, borderRadius: 9999, background: 'var(--hairline)' }}
          />
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <span
          style={{
            fontSize: 12.5,
            color: 'var(--ink-faint2)',
            letterSpacing: '-0.01em',
            background: 'var(--inset)',
            padding: '5px 16px',
            borderRadius: 9999,
          }}
        >
          alpenblick.yosemitecrew.app
        </span>
      </div>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--success)',
          fontWeight: 700,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: 9999,
            background: 'var(--success)',
            animation: 'ycPulse 2.4s ease-out infinite',
          }}
        />
        {'Offline-ready'}
      </span>
    </div>
  );
}

function HeroSidebar() {
  return (
    <aside data-hide-m="true" style={HERO_SIDEBAR_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 14px' }}>
        <Image
          src={MARKETING_LOGO}
          alt=""
          width={30}
          height={30}
          style={{ width: 30, height: 30, objectFit: 'contain' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-body)' }}>
            Alpenblick
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-faint2)' }}>Veterinary Clinic</span>
        </div>
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--ink-faint2)',
          padding: '8px 8px 4px',
        }}
      >
        SCHEDULE &amp; WORK
      </span>
      <SidebarItem
        icon={<IoGridOutline style={{ fontSize: 16 }} aria-hidden="true" />}
        label="Dashboard"
      />
      <SidebarItem
        icon={<IoCalendarOutline style={{ fontSize: 16 }} aria-hidden="true" />}
        label="Appointments"
        active
      />
      <SidebarItem
        icon={<IoPawOutline style={{ fontSize: 16 }} aria-hidden="true" />}
        label="Companions"
      />
      <SidebarItem
        icon={<IoDocumentTextOutline style={{ fontSize: 16 }} aria-hidden="true" />}
        label="SOAP notes"
      />
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--ink-faint2)',
          padding: '12px 8px 4px',
        }}
      >
        OPERATIONS
      </span>
      <SidebarItem
        icon={<IoWalletOutline style={{ fontSize: 16 }} aria-hidden="true" />}
        label="Finance"
      />
      <SidebarItem
        icon={<IoCubeOutline style={{ fontSize: 16 }} aria-hidden="true" />}
        label="Inventory"
      />
      <SidebarItem
        icon={<IoChatbubblesOutline style={{ fontSize: 16 }} aria-hidden="true" />}
        label="Chat"
      />
    </aside>
  );
}

function HeroScheduleHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 18,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: 'var(--ink-faint2)', letterSpacing: '-0.01em' }}>
          Thursday, 3 July
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--ink)',
          }}
        >
          Today&apos;s schedule
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <span
          data-hide-m="true"
          style={{
            fontSize: 12.5,
            color: 'var(--ink-muted)',
            border: '1px solid var(--hairline)',
            borderRadius: 9999,
            padding: '7px 14px',
          }}
        >
          Day
        </span>
        <span
          style={{
            fontSize: 12.5,
            color: 'var(--cta-text)',
            background: 'var(--cta)',
            borderRadius: 9999,
            padding: '7px 14px',
          }}
        >
          + New visit
        </span>
      </div>
    </div>
  );
}

function HeroStatCards() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 16,
      }}
    >
      <StatCard
        label="Booked today"
        value="12"
        sub="↑ 2 from yesterday"
        subColor="var(--success)"
        subWeight={600}
      />
      <StatCard
        label="In the building"
        value="3"
        sub="2 waiting · 1 in room"
        subColor="var(--ink-faint)"
      />
      <StatCard label="Invoiced" value="€1,840" sub="0% platform fee" subColor="var(--ink-faint)" />
    </div>
  );
}

function HeroScheduleList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ScheduleRow
        time="08:30"
        initial="B"
        initialBg="var(--blue-soft)"
        initialColor="var(--blue)"
        name="Bella · Labrador"
        detail="Senior wellness · Dr. Weber"
        badge={
          <StatusBadge label="Checked in" bg="var(--avatar-green-bg)" color="var(--code-str)" />
        }
      />
      <ScheduleRow
        time="09:00"
        initial="M"
        initialBg="var(--avatar-violet-bg)"
        initialColor="var(--avatar-violet-ink)"
        name="Miso · Shorthair"
        detail="Dental follow-up · Dr. Osei"
        badge={<StatusBadge label="In progress" bg="var(--blue-soft)" color="var(--blue)" />}
      />
      <ScheduleRow
        time="09:30"
        initial="F"
        initialBg="var(--avatar-green-bg)"
        initialColor="var(--code-str)"
        name="Fjord · Icelandic Horse"
        detail="Lameness exam · yard visit"
        badge={<StatusBadge label="Upcoming" bg="var(--inset)" color="var(--ink-muted)" />}
      />
    </div>
  );
}

function HeroMockupMain() {
  return (
    <div style={{ flex: 1, padding: 22, minWidth: 0 }}>
      <HeroScheduleHeader />
      <HeroStatCards />
      <HeroScheduleList />
    </div>
  );
}

function HeroFloatCards() {
  return (
    <>
      <div data-hero-float="true" style={HERO_FLOAT_CARD_A_STYLE}>
        <span style={HERO_FLOAT_ICON_GREEN_STYLE}>
          <IoCloudOfflineOutline style={{ fontSize: 16 }} aria-hidden="true" />
        </span>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-body)' }}>
            Wifi dropped, still typing
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Nothing lost · syncs later</div>
        </div>
      </div>
      <div data-hero-float="true" style={HERO_FLOAT_CARD_B_STYLE}>
        <span style={HERO_FLOAT_ICON_BLUE_STYLE}>
          <IoDownloadOutline style={{ fontSize: 16 }} aria-hidden="true" />
        </span>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-body)' }}>
            Export everything
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Leaving is free</div>
        </div>
      </div>
    </>
  );
}

function HeroMockup() {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        width: 'min(1180px, 100%)',
        margin: '60px auto 0',
        opacity: 0,
        animation: `ycHeroUp 1.1s ${EASE} 0.78s both`,
      }}
    >
      <div
        style={{
          background: 'var(--screen)',
          border: '1px solid var(--hairline)',
          borderRadius: 28,
          boxShadow: '0 40px 100px var(--sh16)',
          overflow: 'hidden',
        }}
      >
        {/* window bar */}
        <HeroWindowBar />

        <div style={{ display: 'flex', minHeight: 460, textAlign: 'left' }}>
          {/* sidebar */}
          <HeroSidebar />

          {/* main */}
          <HeroMockupMain />
        </div>
      </div>

      {/* floating accents */}
      <HeroFloatCards />
    </div>
  );
}

/* ---------- NOTEBOOK / PROBLEM (dark) ---------- */

function NotebookSection() {
  return (
    <section
      data-screen-label="The notebook"
      style={{ position: 'relative', background: 'var(--spot)', overflow: 'hidden' }}
    >
      <Spotlight style={{ position: 'static' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -220,
            right: -160,
            width: 780,
            height: 600,
            background: 'radial-gradient(closest-side, var(--glow-b12), transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 'min(980px, calc(100% - 48px))',
            margin: '0 auto',
            padding: 'clamp(88px, 12vw, 160px) 0',
          }}
        >
          <Reveal
            delay={0}
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#8f8984',
            }}
          >
            The real incumbent
          </Reveal>
          <Reveal
            as="div"
            delay={100}
            style={{
              margin: '30px 0 0',
              fontSize: 'clamp(24px, 3.4vw, 42px)',
              fontWeight: 500,
              lineHeight: 1.34,
              letterSpacing: '-0.035em',
              color: '#eae2d5',
              textWrap: 'pretty',
            }}
          >
            <p style={{ margin: 0 }}>
              There&apos;s a dog-eared notebook next to the keyboard at almost every clinic, and
              inside it the workaround for the broken bit, the shorthand the front desk invented,
              the note that says which button to press twice. It&apos;s a whole second system, built
              out of paper and habit, just to survive the first one.{' '}
              <span
                style={{
                  fontFamily: NEWSREADER,
                  fontStyle: 'italic',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  color: '#82afec',
                }}
              >
                We built the software so you can finally close the notebook.
              </span>
            </p>
          </Reveal>
        </div>
      </Spotlight>
    </section>
  );
}

/* ---------- FEATURE 1 - Records / SOAP ---------- */

function RecordsIntro() {
  return (
    <Reveal
      delay={0}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 18,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--blue)',
        }}
      >
        Companions &amp; records
      </span>
      <h2
        style={{
          fontFamily: NEWSREADER,
          margin: 0,
          fontSize: 'clamp(30px, 3.6vw, 46px)',
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: '-0.045em',
          color: 'var(--ink)',
          textWrap: 'balance',
        }}
      >
        One patient. Every slice, in one place.
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 17.5,
          lineHeight: 1.65,
          letterSpacing: '-0.02em',
          color: 'var(--ink-muted)',
          textWrap: 'pretty',
        }}
      >
        A dog dies in the gaps between screens: the bloodwork in one system, the scan on a disc in a
        drawer, the locum&apos;s note in a file nobody opens. Yosemite Crew puts the whole history
        on one timeline, so the vet, the nurse and the lab all see the same animal at the same
        moment.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
        <FeatureCheck>SOAP notes that write to the timeline, not a silo</FeatureCheck>
        <FeatureCheck>Bloodwork, imaging and meds on a single record</FeatureCheck>
        <FeatureCheck>Dogs, cats and horses, one system for the whole yard</FeatureCheck>
      </div>
    </Reveal>
  );
}

function RecordsTimeline() {
  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--ink-faint2)',
        }}
      >
        TIMELINE
      </span>
      <TimelineRow
        icon={<IoWaterOutline style={{ fontSize: 15 }} aria-hidden="true" />}
        iconBg="var(--avatar-green-bg)"
        iconColor="var(--code-str)"
        title="Bloodwork panel, all clear"
        meta="Dr. Weber · 2 days ago"
      />
      <TimelineRow
        icon={<IoScanOutline style={{ fontSize: 15 }} aria-hidden="true" />}
        iconBg="var(--avatar-violet-bg)"
        iconColor="var(--avatar-violet-ink)"
        title="Hip X-ray · mild arthritis"
        meta="Imaging · May"
      />
      <TimelineRow
        icon={<IoMedkitOutline style={{ fontSize: 15 }} aria-hidden="true" />}
        iconBg="var(--avatar-amber-bg)"
        iconColor="var(--avatar-amber-ink)"
        title="Carprofen 75mg · 1×/day"
        meta="Prescription · ongoing"
      />
      <div
        style={{
          marginTop: 6,
          padding: 14,
          background: 'var(--page)',
          border: '1px solid var(--inset)',
          borderRadius: 14,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--ink-faint2)',
            marginBottom: 6,
          }}
        >
          S · O · A · P
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-muted)' }}>
          <span style={{ color: 'var(--ink-body)', fontWeight: 600 }}>A:</span> Stable senior.
          Weight holding at 29.4kg.{' '}
          <span style={{ color: 'var(--ink-body)', fontWeight: 600 }}>P:</span> Recheck in 4 weeks;
          continue NSAIDs.
        </div>
      </div>
    </div>
  );
}

function RecordsCard() {
  return (
    <Reveal delay={150} style={{ display: 'flex', justifyContent: 'center' }}>
      <div
        className="yc-card-lift"
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'var(--screen)',
          border: '1px solid var(--hairline)',
          borderRadius: 22,
          boxShadow: '0 24px 60px var(--sh10)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '18px 20px',
            borderBottom: '1px solid var(--inset)',
          }}
        >
          <span style={RECORD_AVATAR_STYLE}>B</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--ink)',
              }}
            >
              Bella
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
              Labrador Retriever · ♀ · 11 yrs · #A-2014
            </div>
          </div>
          <StatusBadge label="Active" bg="var(--avatar-green-bg)" color="var(--code-str)" />
        </div>
        <RecordsTimeline />
      </div>
    </Reveal>
  );
}

function RecordsSection() {
  return (
    <section data-screen-label="Records" style={{ background: 'var(--page)' }}>
      <div
        data-grid-1-m="true"
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
          display: 'grid',
          gridTemplateColumns: '0.92fr 1.08fr',
          gap: 'clamp(40px, 5vw, 80px)',
          alignItems: 'center',
        }}
      >
        <RecordsIntro />
        <RecordsCard />
      </div>
    </section>
  );
}

interface TimelineRowProps {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  meta: string;
}

function TimelineRow({ icon, iconBg, iconColor, title, meta }: Readonly<TimelineRowProps>) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span
        style={{
          flex: 'none',
          width: 30,
          height: 30,
          borderRadius: 10,
          background: iconBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-body)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{meta}</div>
      </div>
    </div>
  );
}

/* ---------- FEATURE 2 - Finance (reversed) ---------- */

function FinanceCard() {
  return (
    <Reveal delay={150} style={{ display: 'flex', justifyContent: 'center' }}>
      <div
        className="yc-card-lift"
        style={{
          width: '100%',
          maxWidth: 500,
          background: 'var(--screen)',
          border: '1px solid var(--hairline)',
          borderRadius: 22,
          boxShadow: '0 24px 60px var(--sh10)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 20,
            borderBottom: '1px solid var(--inset)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          >
            Invoice · #YC-2041
          </div>
          <StatusBadge label="Paid" bg="var(--avatar-green-bg)" color="var(--code-str)" />
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InvoiceRow label="Senior wellness exam" amount="€65.00" />
          <InvoiceRow label="Bloodwork panel" amount="€48.00" />
          <InvoiceRow label="Carprofen 75mg × 30" amount="€22.00" />
          <div style={{ height: 1, background: 'var(--inset)', margin: '4px 0' }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Total</span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--ink)',
              }}
            >
              €135.00
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: 'var(--avatar-green-bg)',
              borderRadius: 14,
            }}
          >
            <IoShieldCheckmarkOutline
              style={{ fontSize: 18, color: 'var(--code-str)' }}
              aria-hidden="true"
            />
            <span
              style={{
                fontSize: 13,
                color: 'var(--code-str)',
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              Your statement says{' '}
              <em style={{ fontStyle: 'normal', fontWeight: 700 }}>your clinic</em>, 0% platform fee
            </span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

interface FinanceIntroProps {
  linkRef: RefObject<HTMLAnchorElement | null>;
}

function FinanceIntro({ linkRef }: Readonly<FinanceIntroProps>) {
  return (
    <Reveal
      delay={0}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 18,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--blue)',
        }}
      >
        Finance
      </span>
      <h2
        style={{
          fontFamily: NEWSREADER,
          margin: 0,
          fontSize: 'clamp(30px, 3.6vw, 46px)',
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: '-0.045em',
          color: 'var(--ink)',
          textWrap: 'balance',
        }}
      >
        You pay your vet. Your statement should say your vet.
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 17.5,
          lineHeight: 1.65,
          letterSpacing: '-0.02em',
          color: 'var(--ink-muted)',
          textWrap: 'pretty',
        }}
      >
        Invoicing, estimates and payments live inside the record, with no third company standing
        between the pet parent and you, and no vendor&apos;s name where yours should be.{' '}
        <strong
          style={{
            fontWeight: 700,
            color: 'var(--ink-body)',
            textDecoration: 'underline',
            textDecorationColor: 'var(--blue)',
            textDecorationThickness: '2px',
            textUnderlineOffset: '3px',
          }}
        >
          We take zero cut of your payments
        </strong>
        {
          ', because the day you become a toll collector is the day you stop making the product better.'
        }
      </p>
      <Link ref={linkRef} href="/pricing" className="yc-link" style={FINANCE_LINK_STYLE}>
        See how pricing works <IoArrowForwardOutline style={{ fontSize: 16 }} aria-hidden="true" />
      </Link>
    </Reveal>
  );
}

function FinanceSection() {
  const linkRef = useMagnet<HTMLAnchorElement>();
  return (
    <section data-screen-label="Finance" style={{ background: 'var(--band)' }}>
      <div
        data-grid-1-m="true"
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
          display: 'grid',
          gridTemplateColumns: '1.08fr 0.92fr',
          gap: 'clamp(40px, 5vw, 80px)',
          alignItems: 'center',
        }}
      >
        <FinanceCard />

        <div data-order-first-m="true">
          <FinanceIntro linkRef={linkRef} />
        </div>
      </div>
    </section>
  );
}

interface InvoiceRowProps {
  label: string;
  amount: string;
}

function InvoiceRow({ label, amount }: Readonly<InvoiceRowProps>) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
      <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span style={{ color: 'var(--ink-body)', fontWeight: 600 }}>{amount}</span>
    </div>
  );
}

/* ---------- OFFLINE BAND ---------- */

interface OfflineCardProps {
  delay: number;
  icon: ReactNode;
  title: string;
  body: string;
}

function OfflineCard({ delay, icon, title, body }: Readonly<OfflineCardProps>) {
  return (
    <Reveal
      delay={delay}
      style={{
        background: 'var(--screen)',
        border: '1px solid var(--hairline)',
        borderRadius: 20,
        padding: 24,
      }}
    >
      <span style={OFFLINE_CARD_ICON_STYLE}>{icon}</span>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink-muted)' }}>{body}</div>
    </Reveal>
  );
}

function OfflineSection() {
  return (
    <section data-screen-label="Offline-first" style={{ background: 'var(--inset)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
        }}
      >
        <Reveal delay={0} style={{ maxWidth: 720 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
            }}
          >
            Built for the worst afternoon
          </span>
          <h2
            style={{
              fontFamily: NEWSREADER,
              margin: '22px 0 0',
              fontSize: 'clamp(30px, 4vw, 50px)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.05em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            The wifi blinks mid-emergency. Nothing you typed is lost.
          </h2>
          <p
            style={{
              margin: '20px 0 0',
              fontSize: 18,
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: 'var(--ink-muted)',
              textWrap: 'pretty',
            }}
          >
            One hand on a frightened animal, the other on a tablet, and the page reloads, throwing
            away the dose you were recording. That&apos;s the cloud assuming the network. We put the
            database on your machine, so the software keeps working whether the internet does or
            not, then syncs the moment it&apos;s back.
          </p>
        </Reveal>
        <div
          data-grid-2-m="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 20,
            marginTop: 'clamp(40px, 5vw, 64px)',
          }}
        >
          <OfflineCard
            delay={0}
            icon={<IoCloudOfflineOutline style={{ fontSize: 20 }} aria-hidden="true" />}
            title="Works offline"
            body="Desktop app with the data local, so no spinner when the router hides behind a cabinet."
          />
          <OfflineCard
            delay={80}
            icon={<IoSyncOutline style={{ fontSize: 20 }} aria-hidden="true" />}
            title="Syncs when it's back"
            body="Reconnect and every note, dose and invoice catches up on its own."
          />
          <OfflineCard
            delay={160}
            icon={<IoLocationOutline style={{ fontSize: 20 }} aria-hidden="true" />}
            title="Data stays home"
            body="Records sit in the country you practice in, under laws you actually agreed to."
          />
          <OfflineCard
            delay={240}
            icon={<IoDownloadOutline style={{ fontSize: 20 }} aria-hidden="true" />}
            title="Leaving is free"
            body="Everything exports. Walk out tomorrow and take every record with you."
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- CLINICAL CALCULATORS ---------- */

const CALCULATORS: ReadonlyArray<{ name: string; unit?: string }> = [
  { name: 'CRI', unit: 'mL/hr' },
  { name: 'Drip rate', unit: 'gtt/min' },
  { name: 'Shock bolus', unit: 'mL/kg' },
  { name: 'IRIS stage', unit: 'I–IV' },
  { name: 'Transfusion', unit: 'mL' },
  { name: 'Energy · RER', unit: 'kcal/day' },
  { name: 'Free-water deficit', unit: 'L' },
  { name: 'Corrected Ca²⁺' },
  { name: 'Corrected Na⁺' },
  { name: 'Anion gap', unit: 'mEq/L' },
  { name: 'Blood pressure', unit: 'mmHg' },
  { name: 'Osmolality', unit: 'mOsm/kg' },
  { name: 'Oxygen flow', unit: 'L/min' },
  { name: 'Concentration', unit: 'mg/mL' },
  { name: 'Gestation', unit: 'days' },
];

function CalculatorsSection() {
  return (
    <section data-screen-label="Calculators" style={{ background: 'var(--band)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
        }}
      >
        <Reveal delay={0} style={{ maxWidth: 780 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--blue)',
            }}
          >
            Clinical tools, built in
          </span>
          <h2
            style={{
              fontFamily: NEWSREADER,
              margin: '22px 0 0',
              fontSize: 'clamp(30px, 4vw, 50px)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.05em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            The math you don&apos;t want to get wrong.
          </h2>
          <p
            style={{
              margin: '20px 0 0',
              fontSize: 18,
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: 'var(--ink-muted)',
              textWrap: 'pretty',
            }}
          >
            Fifteen clinical calculators live inside the record, so the numbers that decide a case,
            infusion and fluid rates, kidney staging, transfusion volumes, are one tap from the
            patient instead of a scrap of paper or a browser tab. Each one shows its working and
            carries the clinical disclaimer.
          </p>
        </Reveal>
        <Reveal
          delay={120}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 'clamp(36px, 5vw, 56px)',
          }}
        >
          {CALCULATORS.map((calc) => (
            <div
              key={calc.name}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                background: 'var(--screen)',
                border: '1px solid var(--hairline)',
                borderRadius: 14,
                padding: '12px 16px',
              }}
            >
              <span
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                {calc.name}
              </span>
              {calc.unit ? (
                <span
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: 12,
                    color: 'var(--ink-faint)',
                  }}
                >
                  {calc.unit}
                </span>
              ) : null}
            </div>
          ))}
        </Reveal>
        <Reveal
          delay={200}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 26,
            fontSize: 13.5,
            color: 'var(--ink-faint)',
            letterSpacing: '-0.01em',
          }}
        >
          <IoInformationCircleOutline
            style={{ fontSize: 17, color: 'var(--ink-faint2)' }}
            aria-hidden="true"
          />
          <span>
            Decision support, not a substitute for clinical judgement. Every result is yours to
            check.
          </span>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- MODULES ---------- */

interface ModuleCardProps {
  delay: number;
  icon: ReactNode;
  title: string;
  body: string;
}

function ModuleCard({ delay, icon, title, body }: Readonly<ModuleCardProps>) {
  return (
    <Reveal
      delay={delay}
      style={{
        background: 'var(--inset)',
        borderRadius: 24,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <span style={MODULE_CARD_ICON_STYLE}>{icon}</span>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: 'var(--ink-muted)',
          letterSpacing: '-0.01em',
        }}
      >
        {body}
      </div>
    </Reveal>
  );
}

const MODULES: ReadonlyArray<{ delay: number; icon: ReactNode; title: string; body: string }> = [
  {
    delay: 0,
    icon: <IoCalendarOutline style={{ fontSize: 21 }} aria-hidden="true" />,
    title: 'Appointments',
    body: 'A calendar the whole team trusts: requests, check-ins and room status, with reminders that go out on their own.',
  },
  {
    delay: 80,
    icon: <IoCubeOutline style={{ fontSize: 21 }} aria-hidden="true" />,
    title: 'Inventory',
    body: 'Stock and controlled medicines tracked in the system, not the notebook, so nothing runs out in the middle of a clinic.',
  },
  {
    delay: 160,
    icon: <IoCheckboxOutline style={{ fontSize: 21 }} aria-hidden="true" />,
    title: 'Tasks',
    body: 'The follow-ups that usually slip through the cracks, assigned, dated and off the back of your mind.',
  },
  {
    delay: 0,
    icon: <IoPeopleOutline style={{ fontSize: 21 }} aria-hidden="true" />,
    title: 'Team and roles',
    body: 'Permissions that match how the clinic actually works, from the front desk to the lead vet.',
  },
  {
    delay: 80,
    icon: <IoChatbubblesOutline style={{ fontSize: 21 }} aria-hidden="true" />,
    title: 'Chat',
    body: 'Talk to pet parents and to each other in one thread, with the photo of the limp attached to the right animal.',
  },
  {
    delay: 160,
    icon: <IoGridOutline style={{ fontSize: 21 }} aria-hidden="true" />,
    title: 'Dashboard',
    body: 'One screen of what matters today: who is in the building, what is owed, and what is overdue.',
  },
  {
    delay: 0,
    icon: <IoDocumentTextOutline style={{ fontSize: 21 }} aria-hidden="true" />,
    title: 'Templates & forms',
    body: 'Consult, intake and consent forms you build once and reuse, filled in on the record instead of on paper.',
  },
  {
    delay: 80,
    icon: <IoExtensionPuzzleOutline style={{ fontSize: 21 }} aria-hidden="true" />,
    title: 'Integrations',
    body: 'Connect the labs, pharmacies and tools you already use, from a marketplace the community keeps growing.',
  },
  {
    delay: 160,
    icon: <IoSearchOutline style={{ fontSize: 21 }} aria-hidden="true" />,
    title: 'Universal search',
    body: 'Find any animal, invoice or note in one box, across the whole clinic, the moment you need it.',
  },
];

function ModulesSection() {
  return (
    <section data-screen-label="Modules" style={{ background: 'var(--page)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
          borderTop: '1px solid #e6ded1',
        }}
      >
        <Reveal delay={0} style={{ maxWidth: 700, marginBottom: 'clamp(40px, 5vw, 60px)' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--blue)',
            }}
          >
            One system, not six tabs
          </span>
          <h2
            style={{
              fontFamily: NEWSREADER,
              margin: '22px 0 0',
              fontSize: 'clamp(30px, 4vw, 50px)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.05em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            Everything the clinic runs on.
          </h2>
          <p
            style={{
              margin: '20px 0 0',
              fontSize: 18,
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: 'var(--ink-muted)',
              textWrap: 'pretty',
            }}
          >
            Most software leaves the team doing the{' '}
            <strong
              style={{
                fontWeight: 700,
                color: 'var(--ink-body)',
                textDecoration: 'underline',
                textDecorationColor: 'var(--blue)',
                textDecorationThickness: '2px',
                textUnderlineOffset: '3px',
              }}
            >
              swivel-chair shuffle
            </strong>
            {
              ': ten tabs for ten tools, copying a name from one into the next, with none of it part of the actual work. Here it is one workflow, so the day moves through the system instead of around it.'
            }
          </p>
        </Reveal>
        <div
          data-grid-2-m="true"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}
        >
          {MODULES.map((mod) => (
            <ModuleCard
              key={mod.title}
              delay={mod.delay}
              icon={mod.icon}
              title={mod.title}
              body={mod.body}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA ---------- */

function CtaSection() {
  const primaryRef = useMagnet<HTMLAnchorElement>();
  const secondaryRef = useMagnet<HTMLAnchorElement>();
  return (
    <section
      data-screen-label="CTA"
      style={{ position: 'relative', background: 'var(--page)', overflow: 'hidden' }}
    >
      <HeroGlow
        parallax={false}
        color="var(--glow-b07)"
        box={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 900,
          height: 500,
        }}
      />
      <div style={ctaBandContainerStyle('clamp(88px, 12vw, 150px) 0')}>
        <Reveal
          as="div"
          delay={0}
          style={{ display: 'flex', justifyContent: 'center', width: '100%' }}
        >
          <h2 style={CTA_HEADING_STYLE}>Close the notebook.</h2>
        </Reveal>
        <Reveal
          as="div"
          delay={100}
          style={{
            margin: '22px 0 0',
            maxWidth: 560,
            fontSize: 18,
            lineHeight: 1.65,
            letterSpacing: '-0.02em',
            color: 'var(--ink-muted)',
            textWrap: 'pretty',
          }}
        >
          <p style={{ margin: 0 }}>
            Self-host free forever, or let us run it pay-as-you-go. No contracts, no platform fees,
            and you can leave whenever you want.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <div
            data-stack-m="true"
            style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 36 }}
          >
            <Link ref={primaryRef} href="/signup" style={CTA_PRIMARY_LINK_STYLE}>
              Get started free <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
            </Link>
            <Link ref={secondaryRef} href="/contact-us" style={CTA_SECONDARY_LINK_STYLE}>
              Book a walkthrough
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- PAGE ---------- */

export function PetBusinesses() {
  return (
    <>
      <Hero />
      <NotebookSection />
      <RecordsSection />
      <FinanceSection />
      <OfflineSection />
      <CalculatorsSection />
      <ModulesSection />
      <CtaSection />
    </>
  );
}

export default PetBusinesses;
