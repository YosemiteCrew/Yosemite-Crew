'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  IoLogoGithub,
  IoArrowForwardOutline,
  IoChevronDownOutline,
  IoDownloadOutline,
  IoAddOutline,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoMedkitOutline,
  IoImagesOutline,
  IoHome,
  IoChatbubbleOutline,
  IoPersonOutline,
  IoExtensionPuzzleOutline,
} from 'react-icons/io5';
import {
  ReleasePill,
  Reveal,
  Spotlight,
  HeroVideo,
  HeroGlow,
  CountUp,
  InkAnnotate,
  useMagnet,
  useParallax,
  useGithubStats,
  HERO_AVATARS,
  COMPANION_PHOTOS,
  HERO_VIDEOS,
  HERO_POSTERS,
  GITHUB_REPO_URL,
  ctaBandContainerStyle,
} from '@/app/features/marketing/site';

const SERIF = 'var(--font-newsreader)';

/* Static inline-style objects hoisted to module scope (no rendered-output change). */

const MARKETING_LINK_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  textDecoration: 'none',
  color: 'var(--blue-text)',
  fontSize: 17,
  fontWeight: 500,
  letterSpacing: '-0.02em',
};

const HERO_GLASS_CARD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 18px',
  borderRadius: 20,
  background: 'var(--glass-93)',
  backdropFilter: 'blur(40px) saturate(200%)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%)',
  border: '1px solid var(--hairline-soft)',
  boxShadow: '0 12px 40px var(--sh08)',
};

const HERO_GLASS_CARD_WIDE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '16px 18px',
  borderRadius: 20,
  maxWidth: 260,
  background: 'var(--glass-93)',
  backdropFilter: 'blur(40px) saturate(200%)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%)',
  border: '1px solid var(--hairline-soft)',
  boxShadow: '0 12px 40px var(--sh08)',
};

const HERO_STAT_CARD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 18px',
  borderRadius: 20,
  background: 'var(--glass-93)',
  backdropFilter: 'blur(40px) saturate(200%)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%)',
  border: '1px solid var(--hairline-soft)',
  boxShadow: '0 12px 40px var(--sh08)',
};

const HERO_MESSAGE_AVATAR_STYLE: CSSProperties = {
  flex: 'none',
  width: 32,
  height: 32,
  borderRadius: 9999,
  background: 'var(--blue-soft)',
  color: 'var(--blue)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
};

const HERO_EXPORT_ICON_STYLE: CSSProperties = {
  flex: 'none',
  width: 32,
  height: 32,
  borderRadius: 12,
  background: 'var(--inset)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-body)',
};

const HERO_SECTION_STYLE: CSSProperties = {
  position: 'relative',
  minHeight: '100svh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  background: 'linear-gradient(180deg, var(--page) 0%, var(--page) 55%, var(--inset) 100%)',
  padding: '140px 24px 100px',
};

const HERO_HEADING_STYLE: CSSProperties = {
  fontFamily: SERIF,
  margin: '28px 0 0',
  fontSize: 'clamp(52px, 8.4vw, 104px)',
  fontWeight: 500,
  lineHeight: 1.02,
  letterSpacing: '-0.06em',
  color: 'var(--ink)',
  textWrap: 'balance',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  columnGap: '0.24em',
};

const HERO_SUBTITLE_STYLE: CSSProperties = {
  margin: '28px 0 0',
  maxWidth: 660,
  fontSize: 'clamp(17px, 2vw, 21px)',
  fontWeight: 400,
  lineHeight: 1.6,
  letterSpacing: '-0.025em',
  color: 'var(--ink-body)',
  textShadow: '0 1px 16px var(--hero-halo1), 0 1px 3px var(--hero-halo2)',
  opacity: 0,
  animation: 'ycHeroUp 1s cubic-bezier(0.16,1,0.3,1) 0.3s both',
  textWrap: 'pretty',
};

const CTA_PRIMARY_BUTTON_STYLE: CSSProperties = {
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
};

const HERO_GITHUB_BUTTON_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'var(--glass-92)',
  color: 'var(--ink-body)',
  fontSize: 17,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '16px 32px',
  borderRadius: 9999,
  border: '1px solid var(--hairline)',
};

const HERO_AVATAR_BADGE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: 9999,
  boxShadow: '0 0 0 2px var(--page)',
  background: 'var(--cta)',
  color: 'var(--inset)',
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  marginLeft: -12,
};

const MANIFESTO_STATEMENT_STYLE: CSSProperties = {
  display: 'block',
  margin: '32px 0 0',
  fontSize: 'clamp(26px, 3.6vw, 44px)',
  fontWeight: 500,
  lineHeight: 1.35,
  letterSpacing: '-0.035em',
  color: '#eae2d5',
  textWrap: 'pretty',
};

const SCHEDULE_ROW_AVATAR_STYLE: CSSProperties = {
  flex: 'none',
  width: 34,
  height: 34,
  borderRadius: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
};

const RECORD_ROW_ICON_STYLE: CSSProperties = {
  flex: 'none',
  width: 30,
  height: 30,
  borderRadius: 10,
  background: 'var(--inset)',
  color: 'var(--ink-body)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const COMPANION_TILE_STYLE: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  padding: '12px 8px',
  background: 'var(--screen)',
  borderRadius: 18,
};

const COMPANION_TILE_AVATAR_STYLE: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 700,
};

const PHONE_ADD_BUTTON_STYLE: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 9999,
  background: 'var(--screen)',
  border: '1px solid var(--hairline)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-body)',
};

const PHONE_CALENDAR_ICON_STYLE: CSSProperties = {
  flex: 'none',
  width: 38,
  height: 38,
  borderRadius: 14,
  background: 'var(--blue-soft)',
  color: 'var(--blue)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const DEV_PLUGIN_ICON_STYLE: CSSProperties = {
  flex: 'none',
  width: 34,
  height: 34,
  borderRadius: 12,
  background: '#454341',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#eae2d5',
};

const CTA_SUBTITLE_STYLE: CSSProperties = {
  display: 'block',
  margin: '24px 0 0',
  maxWidth: 600,
  fontSize: 18,
  lineHeight: 1.65,
  letterSpacing: '-0.02em',
  color: 'var(--ink-muted)',
  textWrap: 'pretty',
};

const CTA_SECONDARY_BUTTON_STYLE: CSSProperties = {
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
};

/* ─────────────────────────── SHARED ─────────────────────────── */

/** Uppercase section eyebrow shared across the marketing sections. */
function Eyebrow({
  as: Tag = 'div',
  color,
  children,
}: Readonly<{ as?: 'div' | 'span'; color: string; children: ReactNode }>) {
  return (
    <Tag
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </Tag>
  );
}

/** The three inert traffic-light dots in a mock window/card chrome. */
function WindowDots({ color }: Readonly<{ color: string }>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 9999, background: color }} />
      <span style={{ width: 10, height: 10, borderRadius: 9999, background: color }} />
      <span style={{ width: 10, height: 10, borderRadius: 9999, background: color }} />
    </div>
  );
}

type PillarCopyProps = Readonly<{
  eyebrow: string;
  eyebrowAs?: 'div' | 'span';
  heading: ReactNode;
  body: ReactNode;
  linkHref: string;
  linkText: ReactNode;
}>;

/** Shared left/right copy column (eyebrow + heading + body + link) for the three pillars. */
function PillarCopy({ eyebrow, eyebrowAs, heading, body, linkHref, linkText }: PillarCopyProps) {
  return (
    <Reveal
      delay={0}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20 }}
    >
      <Eyebrow as={eyebrowAs} color="var(--blue-text)">
        {eyebrow}
      </Eyebrow>
      <h2
        style={{
          fontFamily: SERIF,
          margin: 0,
          fontSize: 'clamp(34px, 4vw, 52px)',
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: '-0.045em',
          color: 'var(--ink)',
          textWrap: 'balance',
        }}
      >
        {heading}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 18,
          lineHeight: 1.65,
          letterSpacing: '-0.02em',
          color: 'var(--ink-muted)',
          textWrap: 'pretty',
        }}
      >
        {body}
      </p>
      <Link href={linkHref} className="yc-link" style={{ ...MARKETING_LINK_STYLE, marginTop: 8 }}>
        {linkText} <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
      </Link>
    </Reveal>
  );
}

/* ─────────────────────────── HERO ─────────────────────────── */

function HeroAppointmentCard() {
  return (
    <div
      style={{
        position: 'absolute',
        left: '5%',
        top: '23%',
        animation: 'ycFloatA 7s ease-in-out 1.2s infinite',
        zIndex: 2,
      }}
    >
      <div style={HERO_GLASS_CARD_STYLE}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 9999,
            background: 'var(--success)',
            animation: 'ycPulse 2.4s ease-out infinite',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ink-body)',
            }}
          >
            Appointment confirmed
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)', letterSpacing: '-0.01em' }}>
            Bella · Sat 09:00 · Dr. Weber
          </span>
        </div>
      </div>
    </div>
  );
}

function HeroMessageCard() {
  return (
    <div
      style={{
        position: 'absolute',
        right: '4.5%',
        top: '27%',
        animation: 'ycFloatB 9s ease-in-out 0.6s infinite',
        zIndex: 2,
      }}
    >
      <div style={HERO_GLASS_CARD_WIDE_STYLE}>
        <span style={HERO_MESSAGE_AVATAR_STYLE}>SW</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ink-body)',
            }}
          >
            Dr. Weber <span style={{ fontWeight: 400, color: 'var(--ink-faint2)' }}>· 14:02</span>
          </span>
          <span
            style={{
              fontSize: 14,
              color: 'var(--ink-muted)',
              letterSpacing: '-0.01em',
              lineHeight: 1.4,
            }}
          >
            Bloodwork is in, all clear. See you Saturday.
          </span>
        </div>
      </div>
    </div>
  );
}

function HeroExportCard() {
  return (
    <div
      style={{
        position: 'absolute',
        left: '9%',
        bottom: '17%',
        animation: 'ycFloatB 8s ease-in-out 2s infinite',
        zIndex: 2,
      }}
    >
      <div style={HERO_GLASS_CARD_STYLE}>
        <span style={HERO_EXPORT_ICON_STYLE}>
          <IoDownloadOutline style={{ fontSize: 16 }} aria-hidden="true" />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ink-body)',
            }}
          >
            Full history exported
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)', letterSpacing: '-0.01em' }}>
            247 records · yours to keep
          </span>
        </div>
      </div>
    </div>
  );
}

function HeroRecoveryCard() {
  return (
    <div
      style={{
        position: 'absolute',
        right: '8%',
        bottom: '15%',
        animation: 'ycFloatA 6.5s ease-in-out 0.2s infinite',
        zIndex: 2,
      }}
    >
      <div style={HERO_STAT_CARD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 26 }}>
          <span style={{ width: 4, height: '40%', background: '#99bdec', borderRadius: 2 }} />
          <span style={{ width: 4, height: '65%', background: '#6aa1eb', borderRadius: 2 }} />
          <span style={{ width: 4, height: '50%', background: '#3b87ec', borderRadius: 2 }} />
          <span style={{ width: 4, height: '90%', background: 'var(--blue)', borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ink-body)',
            }}
          >
            Recovery on track
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)', letterSpacing: '-0.01em' }}>
            Weight stable · 4 weeks
          </span>
        </div>
      </div>
    </div>
  );
}

function HeroFloatingCards() {
  return (
    <div data-hide-m="true" aria-hidden="true">
      <HeroAppointmentCard />
      <HeroMessageCard />
      <HeroExportCard />
      <HeroRecoveryCard />
    </div>
  );
}

type HeroMagnetRef = ReturnType<typeof useMagnet<HTMLAnchorElement>>;

function HeroHeading() {
  return (
    <h1 style={HERO_HEADING_STYLE}>
      <span
        style={{
          display: 'inline-block',
          opacity: 0,
          animation: 'ycWord 0.95s cubic-bezier(0.16,1,0.3,1) 0.1s both',
        }}
      >
        See
      </span>
      <span
        style={{
          display: 'inline-block',
          opacity: 0,
          animation: 'ycWord 0.95s cubic-bezier(0.16,1,0.3,1) 0.24s both',
        }}
      >
        the
      </span>
      <em
        style={{
          display: 'inline-block',
          fontStyle: 'italic',
          fontWeight: 480,
          color: 'var(--blue-text)',
          opacity: 0,
          animation: 'ycWord 0.95s cubic-bezier(0.16,1,0.3,1) 0.38s both',
        }}
      >
        <InkAnnotate type="circle" delay={1300}>
          whole
        </InkAnnotate>
      </em>
      <span
        style={{
          display: 'inline-block',
          opacity: 0,
          animation: 'ycWord 0.95s cubic-bezier(0.16,1,0.3,1) 0.52s both',
        }}
      >
        animal.
      </span>
    </h1>
  );
}

function HeroCtaButtons({
  primaryRef,
  starRef,
}: Readonly<{ primaryRef: HeroMagnetRef; starRef: HeroMagnetRef }>) {
  return (
    <div
      data-stack-m="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginTop: 40,
        opacity: 0,
        animation: 'ycHeroUp 1s cubic-bezier(0.16,1,0.3,1) 0.45s both',
      }}
    >
      <Link href="/signup" ref={primaryRef} style={CTA_PRIMARY_BUTTON_STYLE}>
        Get started free <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
      </Link>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        ref={starRef}
        data-star
        style={HERO_GITHUB_BUTTON_STYLE}
      >
        <IoLogoGithub style={{ fontSize: 18 }} aria-hidden="true" /> Star on GitHub
      </a>
    </div>
  );
}

function HeroSocialProof() {
  const stats = useGithubStats();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginTop: 30,
        opacity: 0,
        animation: 'ycHeroUp 1s cubic-bezier(0.16,1,0.3,1) 0.6s both',
      }}
    >
      <div style={{ display: 'flex' }}>
        {HERO_AVATARS.map((src, i) => (
          <span
            key={src}
            style={{
              display: 'inline-block',
              width: 40,
              height: 40,
              borderRadius: 9999,
              overflow: 'hidden',
              marginLeft: i === 0 ? 0 : -12,
              boxShadow: '0 0 0 2px var(--page)',
              background: '#e6e3e0',
              animation: `ycFloatA 4.5s ease-in-out ${(i * 0.45).toFixed(2)}s infinite`,
            }}
          >
            <Image
              src={src}
              alt="A companion cared for with Yosemite Crew"
              width={40}
              height={40}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </span>
        ))}
        <span style={HERO_AVATAR_BADGE_STYLE}>+9k</span>
      </div>
      <div style={{ textAlign: 'left' }}>
        <div
          style={{
            fontSize: 15.5,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--ink-body)',
          }}
        >
          <CountUp value={stats.repositoryClones ?? '·'} style={{ color: 'var(--ink)' }} />{' '}
          repository clones
        </div>
        <div style={{ fontSize: 13, letterSpacing: '-0.01em', color: 'var(--ink-6b)' }}>
          Clinics and developers running it in the open, no platform fees.
        </div>
      </div>
    </div>
  );
}

function HeroScrollHint() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'var(--ink-faint2)',
        opacity: 0,
        animation: 'ycHeroUp 1s cubic-bezier(0.16,1,0.3,1) 1.4s both',
      }}
    >
      <IoChevronDownOutline style={{ fontSize: 20 }} />
    </div>
  );
}

function Hero() {
  const parallaxRef = useParallax<HTMLElement>();
  const primaryRef = useMagnet<HTMLAnchorElement>();
  const starRef = useMagnet<HTMLAnchorElement>();

  return (
    <section ref={parallaxRef} id="top" data-hero style={HERO_SECTION_STYLE}>
      <HeroVideo src={HERO_VIDEOS.home} poster={HERO_POSTERS.home} position="center 50%" />

      {/* ambient glows — each on a parallax-depth layer so it drifts toward the cursor */}
      <HeroGlow
        depth="0.05"
        scrollSpeed="-0.05"
        color="var(--glow-b09)"
        box={{ top: -180, left: 'calc(50% - 630px)', width: 900, height: 620 }}
        animation="ycDrift 26s ease-in-out infinite alternate"
      />
      <HeroGlow
        depth="0.06"
        scrollSpeed="0.04"
        color="var(--glow-c10)"
        box={{ bottom: -220, right: -120, width: 760, height: 560 }}
        animation="ycDrift 34s ease-in-out 4s infinite alternate-reverse"
      />
      <HeroGlow
        depth="0.04"
        scrollSpeed="-0.03"
        color="var(--glow-p07)"
        box={{ bottom: -160, left: -140, width: 620, height: 480 }}
        animation="ycDrift 40s ease-in-out 2s infinite alternate"
      />

      <HeroFloatingCards />

      {/* hero copy */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: 1040,
        }}
      >
        <span
          style={{
            opacity: 0,
            animation: 'ycHeroUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.05s both',
          }}
        >
          <ReleasePill variant="latest" version="v2.0 beta" />
        </span>

        <HeroHeading />

        <p style={HERO_SUBTITLE_STYLE}>
          Most animals are cared for in slices, a vet here, a lab there, a note nobody opens.
          Yosemite Crew is the open-source operating system for animal health that puts the whole
          story on one screen: for the clinic, the pet parent, and whoever cares for them next.
        </p>

        <HeroCtaButtons primaryRef={primaryRef} starRef={starRef} />

        <HeroSocialProof />
      </div>

      {/* scroll hint */}
      <HeroScrollHint />
    </section>
  );
}

/* ─────────────────────────── COMPANIONS ─────────────────────────── */

type CompanionCardProps = Readonly<{
  src: string;
  alt: string;
  label: string;
  species: string;
}>;

function CompanionCard({ src, alt, label, species }: CompanionCardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 5',
          borderRadius: 24,
          overflow: 'hidden',
          background: 'var(--inset)',
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 900px) 100vw, 33vw"
          style={{
            objectFit: 'cover',
            filter: 'sepia(0.13) saturate(1.14) brightness(1.02) contrast(1.02)',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 2 }}>
        <span
          style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}
        >
          {label}
        </span>
        <span style={{ fontSize: 13, letterSpacing: '-0.01em', color: 'var(--ink-faint2)' }}>
          {species}
        </span>
      </div>
    </div>
  );
}

function Companions() {
  return (
    <section style={{ background: 'var(--page)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(72px, 9vw, 120px) 0',
        }}
      >
        <Reveal delay={0} style={{ maxWidth: 680, marginBottom: 'clamp(32px, 4vw, 48px)' }}>
          <Eyebrow color="var(--blue-text)">Every companion</Eyebrow>
          <h2
            style={{
              fontFamily: SERIF,
              margin: '18px 0 0',
              fontSize: 'clamp(28px, 3.6vw, 44px)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.045em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            Canine, equine, feline. One record for each.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <div
            data-grid-1-m="true"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}
          >
            <CompanionCard
              src={COMPANION_PHOTOS.dog}
              alt="A canine companion"
              label="Canine"
              species="dogs"
            />
            <CompanionCard
              src={COMPANION_PHOTOS.horse}
              alt="An equine companion"
              label="Equine"
              species="horses"
            />
            <CompanionCard
              src={COMPANION_PHOTOS.cat}
              alt="A feline companion"
              label="Feline"
              species="cats"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── MANIFESTO ─────────────────────────── */

function Manifesto() {
  return (
    <section style={{ position: 'relative', background: 'var(--spot)', overflow: 'hidden' }}>
      <Spotlight style={{ position: 'static' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -240,
            right: -180,
            width: 820,
            height: 620,
            background: 'radial-gradient(closest-side, var(--glow-b13), transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            width: 'min(980px, calc(100% - 48px))',
            margin: '0 auto',
            padding: 'clamp(96px, 13vw, 170px) 0',
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
            Why we build
          </Reveal>
          <Reveal delay={100} as="span" style={MANIFESTO_STATEMENT_STYLE}>
            Most software is built for the demo, with strong wifi, nothing on fire, everything
            gliding. A clinic lives on the worst afternoon: the outage, the crash, the connection
            that drops at exactly the wrong second.{' '}
            <span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#82afec',
              }}
            >
              We build for that afternoon.
            </span>{' '}
            The demo can take care of itself.
          </Reveal>
          <Reveal
            delay={200}
            style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 16 }}
          >
            <span style={{ height: 1, width: 56, background: '#454341' }} aria-hidden="true" />
            <span style={{ fontSize: 15, letterSpacing: '-0.01em', color: '#8f8984' }}>
              Offline-first · Desktop, web and mobile · Your data stays yours
            </span>
          </Reveal>
        </div>
      </Spotlight>
    </section>
  );
}

/* ─────────────────────────── PILLAR 1: PET BUSINESSES ─────────────────────────── */

type ScheduleRowProps = Readonly<{
  time: string;
  initial: string;
  avatarBg: string;
  avatarColor: string;
  name: string;
  detail: string;
  badgeLabel: string;
  badgeBg: string;
  badgeColor: string;
}>;

function ScheduleRow({
  time,
  initial,
  avatarBg,
  avatarColor,
  name,
  detail,
  badgeLabel,
  badgeBg,
  badgeColor,
}: ScheduleRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px',
        border: '1px solid var(--hairline)',
        borderRadius: 16,
        background: 'var(--screen)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--ink-faint)', width: 40, flex: 'none' }}>
        {time}
      </span>
      <span style={{ ...SCHEDULE_ROW_AVATAR_STYLE, background: avatarBg, color: avatarColor }}>
        {initial}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--ink-body)',
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: 12.5,
            color: 'var(--ink-faint)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {detail}
        </span>
      </div>
      <span
        style={{
          flex: 'none',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          padding: '5px 9px',
          borderRadius: 9999,
          background: badgeBg,
          color: badgeColor,
        }}
      >
        {badgeLabel}
      </span>
    </div>
  );
}

function PracticeCardHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid var(--inset)',
      }}
    >
      <WindowDots color="var(--hairline)" />
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color: 'var(--ink-faint)',
        }}
      >
        Today · Thursday 3 July
      </span>
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
        <span style={{ width: 7, height: 7, borderRadius: 9999, background: 'var(--success)' }} />
        {'Offline-ready'}
      </span>
    </div>
  );
}

function PracticeSchedule() {
  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--ink-body)',
          }}
        >
          Schedule
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
          12 visits · ↑ 2 from yesterday
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ScheduleRow
          time="08:30"
          initial="B"
          avatarBg="var(--blue-soft)"
          avatarColor="var(--blue)"
          name="Bella · Labrador Retriever"
          detail="Senior wellness · Dr. Weber"
          badgeLabel="CHECKED IN"
          badgeBg="var(--avatar-green-bg)"
          badgeColor="var(--code-str)"
        />
        <ScheduleRow
          time="09:00"
          initial="M"
          avatarBg="var(--avatar-violet-bg)"
          avatarColor="var(--avatar-violet-ink)"
          name="Miso · Domestic Shorthair"
          detail="Dental follow-up · Dr. Osei"
          badgeLabel="IN PROGRESS"
          badgeBg="var(--blue-soft)"
          badgeColor="var(--nav-active)"
        />
        <ScheduleRow
          time="09:30"
          initial="F"
          avatarBg="var(--avatar-green-bg)"
          avatarColor="var(--avatar-green-ink)"
          name="Fjord · Icelandic Horse"
          detail="Lameness exam · Dr. Weber · Yard visit"
          badgeLabel="UPCOMING"
          badgeBg="var(--inset)"
          badgeColor="var(--ink-muted)"
        />
        <ScheduleRow
          time="10:15"
          initial="O"
          avatarBg="var(--avatar-amber-bg)"
          avatarColor="var(--avatar-amber-ink)"
          name="Otto · Dachshund"
          detail="Vaccination · Nurse Blum"
          badgeLabel="REQUESTED"
          badgeBg="var(--avatar-amber-bg)"
          badgeColor="var(--avatar-amber-ink)"
        />
      </div>
    </div>
  );
}

function PetBusinessesPillar() {
  return (
    <section style={{ background: 'var(--band)' }}>
      <div
        data-grid-1-m="true"
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(88px, 11vw, 150px) 0',
          display: 'grid',
          gridTemplateColumns: '0.9fr 1.1fr',
          gap: 'clamp(40px, 5vw, 80px)',
          alignItems: 'center',
        }}
      >
        <PillarCopy
          eyebrow="For pet businesses"
          heading="Run the practice, not the software."
          body={
            <>
              Whether you run a clinic, a boarding kennel or a grooming salon, one system carries
              the day: appointments, records, invoicing and inventory, instead of six tabs and a
              notebook of workarounds. And because the database lives on your machine, a blinking
              router never takes the morning down.
            </>
          }
          linkHref="/pet-businesses"
          linkText="Explore the practice suite"
        />

        <Reveal delay={150} style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <div
            className="yc-card-lift"
            style={{
              width: '100%',
              maxWidth: 620,
              background: 'var(--screen)',
              border: '1px solid var(--hairline)',
              borderRadius: 24,
              boxShadow: '0 24px 60px var(--sh10)',
              overflow: 'hidden',
            }}
          >
            <PracticeCardHeader />
            <PracticeSchedule />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── PILLAR 2: PET PARENTS ─────────────────────────── */

type RecordRowProps = Readonly<{
  icon: ReactNode;
  text: string;
  meta: string;
}>;

function RecordRow({ icon, text, meta }: RecordRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={RECORD_ROW_ICON_STYLE}>{icon}</span>
      <span style={{ fontSize: 12.5, color: 'var(--ink-muted)', flex: 1 }}>{text}</span>
      <span style={{ fontSize: 12, color: 'var(--ink-faint2)' }}>{meta}</span>
    </div>
  );
}

type CompanionTileProps = Readonly<{
  initial: string;
  name: string;
  avatarBg: string;
  avatarColor: string;
  active?: boolean;
}>;

function CompanionTile({ initial, name, avatarBg, avatarColor, active }: CompanionTileProps) {
  return (
    <div
      style={{
        ...COMPANION_TILE_STYLE,
        border: active ? '1.5px solid var(--blue)' : '1px solid var(--hairline)',
      }}
    >
      <span style={{ ...COMPANION_TILE_AVATAR_STYLE, background: avatarBg, color: avatarColor }}>
        {initial}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: active ? 700 : 500,
          color: active ? 'var(--ink-body)' : 'var(--ink-muted)',
        }}
      >
        {name}
      </span>
    </div>
  );
}

function PhoneStatusBar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 22px 6px',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-body)' }}>9:41</span>
      <span style={{ width: 74, height: 20, borderRadius: 9999, background: '#1d1c1b' }} />
      <span
        style={{ display: 'flex', gap: 4, color: 'var(--ink-body)', fontSize: 12 }}
        aria-hidden="true"
      >
        ●●
      </span>
    </div>
  );
}

function PhoneNextVisitCard() {
  return (
    <div
      style={{
        background: 'var(--screen)',
        border: '1px solid var(--hairline)',
        borderRadius: 20,
        padding: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--ink-body)',
          }}
        >
          Next visit
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            padding: '4px 8px',
            borderRadius: 9999,
            background: 'var(--inset)',
            color: 'var(--ink-muted)',
          }}
        >
          UPCOMING
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={PHONE_CALENDAR_ICON_STYLE}>
          <IoCalendarOutline style={{ fontSize: 18 }} aria-hidden="true" />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-body)' }}>
            Sat 5 July · 09:00
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            Senior wellness · Dr. Weber
          </span>
        </div>
      </div>
    </div>
  );
}

function PhoneRecordsCard() {
  return (
    <div
      style={{
        background: 'var(--screen)',
        border: '1px solid var(--hairline)',
        borderRadius: 20,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--ink-body)',
        }}
      >
        Bella&apos;s records
      </span>
      <RecordRow
        icon={<IoDocumentTextOutline style={{ fontSize: 15 }} aria-hidden="true" />}
        text="Bloodwork panel, all clear"
        meta="Tue"
      />
      <RecordRow
        icon={<IoMedkitOutline style={{ fontSize: 15 }} aria-hidden="true" />}
        text="Carprofen 75mg · 1/day"
        meta="Ongoing"
      />
      <RecordRow
        icon={<IoImagesOutline style={{ fontSize: 15 }} aria-hidden="true" />}
        text="Hip X-ray · shared by clinic"
        meta="May"
      />
    </div>
  );
}

function PhoneBottomNav() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '10px 6px 4px',
        borderTop: '1px solid var(--inset)',
      }}
      aria-hidden="true"
    >
      <IoHome style={{ fontSize: 20, color: 'var(--blue)' }} />
      <IoCalendarOutline style={{ fontSize: 20, color: 'var(--ink-faint2)' }} />
      <IoChatbubbleOutline style={{ fontSize: 20, color: 'var(--ink-faint2)' }} />
      <IoPersonOutline style={{ fontSize: 20, color: 'var(--ink-faint2)' }} />
    </div>
  );
}

function PhoneMockup() {
  return (
    <div
      style={{
        width: 290,
        background: '#1d1c1b',
        borderRadius: 44,
        padding: 8,
        boxShadow: '0 30px 70px var(--sh16)',
      }}
    >
      <div style={{ background: 'var(--page)', borderRadius: 37, overflow: 'hidden' }}>
        <PhoneStatusBar />
        <div
          style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--ink)',
              }}
            >
              Your companions
            </span>
            <span style={PHONE_ADD_BUTTON_STYLE}>
              <IoAddOutline style={{ fontSize: 16 }} aria-hidden="true" />
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              {
                initial: 'B',
                name: 'Bella',
                avatarBg: 'var(--blue-soft)',
                avatarColor: 'var(--blue)',
                active: true,
              },
              {
                initial: 'F',
                name: 'Fjord',
                avatarBg: 'var(--avatar-green-bg)',
                avatarColor: 'var(--avatar-green-ink)',
              },
              {
                initial: 'M',
                name: 'Miso',
                avatarBg: 'var(--avatar-amber-bg)',
                avatarColor: 'var(--avatar-amber-ink)',
              },
            ].map((tile) => (
              <CompanionTile key={tile.name} {...tile} />
            ))}
          </div>
          <PhoneNextVisitCard />
          <PhoneRecordsCard />
          <PhoneBottomNav />
        </div>
      </div>
    </div>
  );
}

function PetParentsPillar() {
  return (
    <section style={{ background: 'var(--page)' }}>
      <div
        data-grid-1-m="true"
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(88px, 11vw, 150px) 0',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: 'clamp(40px, 5vw, 80px)',
          alignItems: 'center',
        }}
      >
        <Reveal
          delay={150}
          style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}
        >
          <PhoneMockup />
        </Reveal>
        <div data-order-first-m="true">
          <PillarCopy
            eyebrow="For pet parents"
            eyebrowAs="span"
            heading="The whole story, in your pocket."
            body={
              <>
                Cats, dogs and horses. Every record, every visit and every dose in one place, shared
                with everyone who helps care for them. Book across the businesses you are linked to,
                message your vet, and never again ask anyone to print four years of history page by
                page.
              </>
            }
            linkHref="/pet-parents"
            linkText="See the companion app"
          />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── PILLAR 3: DEVELOPERS ─────────────────────────── */

function DevApiHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid #302f2e',
      }}
    >
      <WindowDots color="#454341" />
      <span
        style={{
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          fontSize: 12,
          color: '#8f8984',
        }}
      >
        GET /fhir/Patient/bella
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#33a57d', letterSpacing: '0.06em' }}>
        200 OK
      </span>
    </div>
  );
}

function DevApiResponse() {
  return (
    <pre
      style={{
        margin: 0,
        padding: 24,
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        fontSize: 13.5,
        lineHeight: 1.7,
        color: '#d6d1cd',
        overflowX: 'auto',
      }}
    >
      <span style={{ color: '#8f8984' }}>{'{'}</span>
      {'\n  '}
      <span style={{ color: '#82afec' }}>&quot;resourceType&quot;</span>
      <span style={{ color: '#8f8984' }}>:</span>{' '}
      <span style={{ color: '#8acbb4' }}>&quot;Patient&quot;</span>
      <span style={{ color: '#8f8984' }}>,</span>
      {'\n  '}
      <span style={{ color: '#82afec' }}>&quot;id&quot;</span>
      <span style={{ color: '#8f8984' }}>:</span>{' '}
      <span style={{ color: '#8acbb4' }}>&quot;bella-2014&quot;</span>
      <span style={{ color: '#8f8984' }}>,</span>
      {'\n  '}
      <span style={{ color: '#82afec' }}>&quot;extension&quot;</span>
      <span style={{ color: '#8f8984' }}>: [{'{'}</span>
      {'\n    '}
      <span style={{ color: '#82afec' }}>&quot;url&quot;</span>
      <span style={{ color: '#8f8984' }}>:</span>{' '}
      <span style={{ color: '#8acbb4' }}>&quot;.../animal-species&quot;</span>
      <span style={{ color: '#8f8984' }}>,</span>
      {'\n    '}
      <span style={{ color: '#82afec' }}>&quot;valueCode&quot;</span>
      <span style={{ color: '#8f8984' }}>:</span>{' '}
      <span style={{ color: '#8acbb4' }}>&quot;canine&quot;</span>
      {'\n  '}
      <span style={{ color: '#8f8984' }}>{'}],'}</span>
      {'\n  '}
      <span style={{ color: '#82afec' }}>&quot;name&quot;</span>
      <span style={{ color: '#8f8984' }}>: [{'{'}</span>{' '}
      <span style={{ color: '#82afec' }}>&quot;text&quot;</span>
      <span style={{ color: '#8f8984' }}>:</span>{' '}
      <span style={{ color: '#8acbb4' }}>&quot;Bella&quot;</span>{' '}
      <span style={{ color: '#8f8984' }}>{'}],'}</span>
      {'\n  '}
      <span style={{ color: '#82afec' }}>&quot;managingOrganization&quot;</span>
      <span style={{ color: '#8f8984' }}>: {'{'}</span>
      {'\n    '}
      <span style={{ color: '#82afec' }}>&quot;display&quot;</span>
      <span style={{ color: '#8f8984' }}>:</span>{' '}
      <span style={{ color: '#8acbb4' }}>&quot;Alpenblick Clinic&quot;</span>
      {'\n  '}
      <span style={{ color: '#8f8984' }}>{'}'}</span>
      {'\n'}
      <span style={{ color: '#8f8984' }}>{'}'}</span>
    </pre>
  );
}

function DevPluginCard() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        margin: '0 20px 20px',
        padding: '14px 16px',
        background: '#302f2e',
        borderRadius: 16,
      }}
    >
      <span style={DEV_PLUGIN_ICON_STYLE}>
        <IoExtensionPuzzleOutline style={{ fontSize: 17 }} aria-hidden="true" />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#eae2d5',
          }}
        >
          AI Scribe · your plugin here
        </span>
        <span style={{ fontSize: 12, color: '#8f8984' }}>
          Publish to the marketplace in an afternoon
        </span>
      </div>
      <span style={{ fontSize: 12, color: '#82afec', fontWeight: 500 }}>Install</span>
    </div>
  );
}

function DevelopersPillar() {
  return (
    <section style={{ background: 'var(--band)' }}>
      <div
        data-grid-1-m="true"
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(88px, 11vw, 150px) 0',
          display: 'grid',
          gridTemplateColumns: '0.9fr 1.1fr',
          gap: 'clamp(40px, 5vw, 80px)',
          alignItems: 'center',
        }}
      >
        <PillarCopy
          eyebrow="For developers"
          heading="Build on an open spine."
          body={
            <>
              A FHIR-native API, a plugin marketplace, and a codebase you can actually read. Take an
              idea, whether it&apos;s an AI scribe, a triage agent or a smarter reminder, and put it
              in front of working clinics in hours, not quarters.
            </>
          }
          linkHref="/developers"
          linkText="Read the developer docs"
        />

        <Reveal
          delay={150}
          style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}
        >
          <div
            className="yc-card-lift"
            style={{
              width: '100%',
              maxWidth: 560,
              background: 'var(--spot)',
              borderRadius: 24,
              boxShadow: '0 24px 60px var(--sh18)',
              overflow: 'hidden',
            }}
          >
            <DevApiHeader />
            <DevApiResponse />
            <DevPluginCard />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── PRINCIPLES ─────────────────────────── */

type PrincipleCellProps = Readonly<{
  number: string;
  title: string;
  delay: number;
  padding: string;
  borderLeft?: boolean;
  children: ReactNode;
}>;

function PrincipleCell({
  number,
  title,
  delay,
  padding,
  borderLeft,
  children,
}: PrincipleCellProps) {
  return (
    <Reveal
      delay={delay}
      style={{
        padding,
        borderBottom: '1px solid var(--divider)',
        borderLeft: borderLeft ? '1px solid var(--divider)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-faint2)' }}>{number}</span>
      <h3
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: '-0.035em',
          color: 'var(--ink)',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 16,
          lineHeight: 1.65,
          letterSpacing: '-0.015em',
          color: 'var(--ink-muted)',
          textWrap: 'pretty',
        }}
      >
        {children}
      </p>
    </Reveal>
  );
}

function PrinciplesGrid() {
  return (
    <div
      data-grid-1-m="true"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 0,
        marginTop: 'clamp(48px, 6vw, 80px)',
        borderTop: '1px solid var(--divider)',
      }}
    >
      <PrincipleCell number="01" title="Leaving is free." delay={0} padding="40px 48px 40px 0">
        Everything exports: every record, every invoice, every note. A clinic can walk out tomorrow
        and take it all. The trust is real precisely because it costs us the lock-in.
      </PrincipleCell>
      <PrincipleCell
        number="02"
        title="No toll booth."
        delay={100}
        padding="40px 0 40px 48px"
        borderLeft
      >
        You pay your vet, and your statement says your vet.{' '}
        <strong
          style={{
            fontWeight: 700,
            color: 'var(--ink-body)',
            textDecoration: 'underline',
            textDecorationColor: 'var(--blue)',
            textDecorationThickness: 2,
            textUnderlineOffset: 3,
          }}
        >
          We take no cut of payments
        </strong>
        {
          ', because toll collectors stop making the product better, and we intend to keep making it better.'
        }
      </PrincipleCell>
      <PrincipleCell
        number="03"
        title="Built for the worst afternoon."
        delay={150}
        padding="40px 48px 40px 0"
      >
        Offline-first, with the database on your machine. When the wifi blinks mid-emergency,
        nothing you typed is lost, and the software keeps working whether the internet does or not.
      </PrincipleCell>
      <PrincipleCell
        number="04"
        title="Your data answers to your flag."
        delay={250}
        padding="40px 0 40px 48px"
        borderLeft
      >
        Records stay in the country where you practice, under laws you actually agreed to, not
        wherever cheap servers happened to have spare room that week.
      </PrincipleCell>
    </div>
  );
}

function Principles() {
  return (
    <section style={{ background: 'var(--inset)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(88px, 11vw, 150px) 0',
        }}
      >
        <Reveal delay={0} style={{ maxWidth: 760 }}>
          <Eyebrow color="var(--ink-faint)">Trust, the expensive kind</Eyebrow>
          <h2
            style={{
              fontFamily: SERIF,
              margin: '24px 0 0',
              fontSize: 'clamp(34px, 4.4vw, 56px)',
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: '-0.05em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            Anyone can say the words. We made them cost something.
          </h2>
          <p
            style={{
              margin: '24px 0 0',
              fontSize: 18,
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: 'var(--ink-muted)',
              textWrap: 'pretty',
            }}
          >
            Promises are free, so they prove nothing. These four are structural, written into the
            code, where we can&apos;t quietly take them back.
          </p>
        </Reveal>

        <PrinciplesGrid />

        <Reveal
          delay={0}
          style={{
            marginTop: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <p
            style={{ margin: 0, fontSize: 17, letterSpacing: '-0.02em', color: 'var(--ink-muted)' }}
          >
            None of this fits on a compliance badge. All of it is in the code, which is public.
          </p>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="yc-link"
            style={MARKETING_LINK_STYLE}
          >
            Read it on GitHub <IoArrowForwardOutline style={{ fontSize: 16 }} aria-hidden="true" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── BUILDING IN PUBLIC (metrics) ─────────────────────────── */

type MetricProps = Readonly<{
  value: string;
  label: string;
  source: string;
  delay: number;
}>;

function Metric({ value, label, source, delay }: MetricProps) {
  return (
    <Reveal
      delay={delay}
      style={{
        borderTop: '1px solid var(--hairline)',
        paddingTop: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <CountUp
        value={value}
        style={{
          fontSize: 'clamp(40px, 4.6vw, 60px)',
          fontWeight: 500,
          letterSpacing: '-0.05em',
          lineHeight: 1,
          color: 'var(--ink)',
        }}
      />
      <span
        style={{
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: 'var(--ink-body)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, letterSpacing: '-0.01em', color: 'var(--ink-faint2)' }}>
        {source}
      </span>
    </Reveal>
  );
}

function BuildingInPublic() {
  const stats = useGithubStats();
  return (
    <section style={{ background: 'var(--page)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(72px, 9vw, 120px) 0',
          borderBottom: '1px solid var(--inset)',
        }}
      >
        <Reveal
          delay={0}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: 620 }}>
            <Eyebrow color="var(--ink-faint)">Building in public</Eyebrow>
            <h2
              style={{
                fontFamily: SERIF,
                margin: '20px 0 0',
                fontSize: 'clamp(30px, 3.6vw, 44px)',
                fontWeight: 500,
                lineHeight: 1.12,
                letterSpacing: '-0.045em',
                color: 'var(--ink)',
                textWrap: 'balance',
              }}
            >
              Our numbers are public. Hiding them only delays fixing them.
            </h2>
          </div>
          <Link
            href="/insights"
            className="yc-link"
            style={{ ...MARKETING_LINK_STYLE, paddingBottom: 6 }}
          >
            See all insights <IoArrowForwardOutline style={{ fontSize: 16 }} aria-hidden="true" />
          </Link>
        </Reveal>

        <div
          data-grid-2-m="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'clamp(24px, 3vw, 48px)',
            marginTop: 'clamp(40px, 5vw, 64px)',
          }}
        >
          <Metric
            value={stats.repositoryClones ?? '·'}
            label="Repository clones"
            source="live via GitHub"
            delay={0}
          />
          <Metric
            value={stats.contributors ?? '·'}
            label="Contributors"
            source="live via GitHub"
            delay={80}
          />
          <Metric
            value={stats.discord ?? '·'}
            label="Discord members"
            source="live via Discord"
            delay={160}
          />
          <Metric
            value={stats.starsFull ?? '·'}
            label="Repo stars"
            source="live via GitHub"
            delay={240}
          />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── FINAL CTA ─────────────────────────── */

function FinalCta() {
  const primaryRef = useMagnet<HTMLAnchorElement>();
  const talkRef = useMagnet<HTMLAnchorElement>();
  return (
    <section
      id="cta"
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
      <div style={ctaBandContainerStyle('clamp(96px, 13vw, 170px) 0')}>
        <Reveal delay={0} as="span">
          <h2
            style={{
              fontFamily: SERIF,
              margin: 0,
              fontSize: 'clamp(40px, 5.6vw, 72px)',
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.055em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            Start tonight. Leave whenever.
          </h2>
        </Reveal>
        <Reveal delay={100} as="span" style={CTA_SUBTITLE_STYLE}>
          Self-host free forever, or let us run it pay-as-you-go. No contracts, no hidden fees, and
          under AGPL-3.0 you own the software.
        </Reveal>
        <Reveal delay={200}>
          <div
            data-stack-m="true"
            style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 40 }}
          >
            <Link href="/signup" ref={primaryRef} style={CTA_PRIMARY_BUTTON_STYLE}>
              Get started free <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
            </Link>
            <Link href="/contact-us" ref={talkRef} style={CTA_SECONDARY_BUTTON_STYLE}>
              Talk to us
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── PAGE ─────────────────────────── */

export function Home() {
  return (
    <>
      <Hero />
      <Companions />
      <Manifesto />
      <PetBusinessesPillar />
      <PetParentsPillar />
      <DevelopersPillar />
      <Principles />
      <BuildingInPublic />
      <FinalCta />
    </>
  );
}
