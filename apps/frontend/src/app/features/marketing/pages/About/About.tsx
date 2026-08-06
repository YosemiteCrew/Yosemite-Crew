'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import {
  IoExitOutline,
  IoWalletOutline,
  IoCloudOfflineOutline,
  IoLocationOutline,
  IoDocumentLockOutline,
  IoPeopleOutline,
  IoLogoGithub,
  IoLogoDiscord,
  IoLogoLinkedin,
} from 'react-icons/io5';
import {
  Reveal,
  Spotlight,
  CountUp,
  HeroGlow,
  InkAnnotate,
  useGithubStats,
  useGithubContributors,
  type GithubContributor,
  ABOUT_ORIGIN_PHOTO,
  GITHUB_REPO_URL,
  GITHUB_STAR_CTA_STYLE,
  DISCORD_INVITE_URL,
} from '@/app/features/marketing/site';

const SERIF = 'var(--font-newsreader)';
const CONTRIBUTORS_URL = `${GITHUB_REPO_URL}/graphs/contributors`;

const eyebrowStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

const sectionHeadingStyle: CSSProperties = {
  margin: '22px 0 0',
  fontFamily: SERIF,
  fontSize: 'clamp(30px, 4vw, 50px)',
  fontWeight: 500,
  lineHeight: 1.1,
  letterSpacing: '-0.05em',
  color: 'var(--ink)',
  textWrap: 'balance',
};

const communityPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  textDecoration: 'none',
  padding: '9px 16px',
  borderRadius: '9999px',
  border: '1px solid var(--hairline)',
  background: 'var(--screen)',
  color: 'var(--ink-body)',
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '-0.01em',
  transition: 'border-color 200ms',
};

const HERO_WORD_STYLE: CSSProperties = {
  display: 'inline-block',
  opacity: 0,
};

const HERO_INNER_STYLE: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(900px, 100%)',
  margin: '0 auto',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const HERO_BADGE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  borderRadius: '9999px',
  border: '1px solid var(--hairline)',
  background: 'var(--glass-95)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '-0.01em',
  color: 'var(--ink-muted)',
  opacity: 0,
  animation: 'ycHeroUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.05s both',
};

const HERO_H1_STYLE: CSSProperties = {
  margin: '26px 0 0',
  fontFamily: SERIF,
  fontSize: 'clamp(42px, 6vw, 84px)',
  fontWeight: 500,
  lineHeight: 1.03,
  letterSpacing: '-0.06em',
  color: 'var(--ink)',
  textWrap: 'balance',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  columnGap: '0.24em',
};

const HERO_LEAD_STYLE: CSSProperties = {
  margin: '26px 0 0',
  maxWidth: '620px',
  fontSize: 'clamp(17px, 2vw, 21px)',
  lineHeight: 1.6,
  letterSpacing: '-0.025em',
  color: 'var(--ink-muted)',
  opacity: 0,
  animation: 'ycHeroUp 1s cubic-bezier(0.16,1,0.3,1) 0.5s both',
  textWrap: 'pretty',
};

const BELIEF_ICON_STYLE: CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '13px',
  background: 'var(--pill-raised)',
  color: 'var(--blue)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const CREW_SLOT_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, var(--inset) 0%, var(--hairline) 100%)',
  color: 'var(--ink-faint2)',
  fontFamily: SERIF,
  fontSize: '38px',
  fontWeight: 500,
  letterSpacing: '-0.02em',
  filter: 'sepia(0.12) saturate(1.12) brightness(1.02) contrast(1.02)',
};

const CTA_INNER_STYLE: CSSProperties = {
  width: 'min(880px, calc(100% - 48px))',
  margin: '0 auto',
  padding: 'clamp(88px, 12vw, 150px) 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  position: 'relative',
};

const CTA_GHOST_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  background: 'transparent',
  color: '#eae2d5',
  fontSize: '17px',
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '16px 32px',
  borderRadius: '9999px',
  border: '1px solid #454341',
  transition: 'border-color 200ms, background 200ms',
};

/* ---------------------------------------------------------------- HERO */

function Hero() {
  return (
    <section
      data-hero
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, var(--page) 0%, var(--page) 65%, var(--inset) 100%)',
        padding: '152px 24px 100px',
      }}
    >
      <HeroGlow
        parallax={false}
        color="var(--glow-b08)"
        scrollSpeed="-0.04"
        box={{ top: '-160px', left: 'calc(50% - 420px)', width: '840px', height: '560px' }}
        animation="ycDrift 34s ease-in-out infinite alternate"
      />
      <div style={HERO_INNER_STYLE}>
        <div style={HERO_BADGE_STYLE}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '9999px',
              background: 'var(--success)',
            }}
          />
          {'About us'}
        </div>
        <h1 style={HERO_H1_STYLE}>
          <span
            style={{
              ...HERO_WORD_STYLE,
              animation: 'ycWord 0.95s cubic-bezier(0.16,1,0.3,1) 0.1s both',
            }}
          >
            We
          </span>
          <span
            style={{
              ...HERO_WORD_STYLE,
              animation: 'ycWord 0.95s cubic-bezier(0.16,1,0.3,1) 0.22s both',
            }}
          >
            build
          </span>
          <span
            style={{
              ...HERO_WORD_STYLE,
              animation: 'ycWord 0.95s cubic-bezier(0.16,1,0.3,1) 0.34s both',
            }}
          >
            the
          </span>
          <span
            style={{
              ...HERO_WORD_STYLE,
              animation: 'ycWord 0.95s cubic-bezier(0.16,1,0.3,1) 0.46s both',
            }}
          >
            layer
          </span>
          <em
            style={{
              display: 'inline-block',
              fontStyle: 'italic',
              fontWeight: 480,
              color: 'var(--blue-text)',
              opacity: 0,
              animation: 'ycWord 0.95s cubic-bezier(0.16,1,0.3,1) 0.58s both',
            }}
          >
            <InkAnnotate type="circle" delay={1500}>
              underneath.
            </InkAnnotate>
          </em>
        </h1>
        <p style={HERO_LEAD_STYLE}>
          Not another app for the grieving pet parent, with a dog&apos;s face on the loading screen.
          The boring layer underneath, where the vet, the nurse, the lab and the next clinic all see
          the same animal at the same moment, while there&apos;s still time.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- ORIGIN */

function Origin() {
  return (
    <Spotlight style={{ background: 'var(--spot)', overflow: 'hidden' }}>
      <section data-screen-label="Origin">
        <HeroGlow
          parallax={false}
          color="var(--glow-b12)"
          box={{ top: '-200px', right: '-160px', width: '780px', height: '600px' }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: 'min(1000px, calc(100% - 48px))',
            margin: '0 auto',
            padding: 'clamp(96px, 11vw, 140px) 0 0',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '3 / 2',
              borderRadius: '28px',
              overflow: 'hidden',
              background: 'rgba(239,232,220,0.06)',
            }}
          >
            <Image
              src={ABOUT_ORIGIN_PHOTO}
              alt="A clinic team caring for a companion"
              fill
              sizes="(max-width: 900px) 100vw, 520px"
              style={{
                objectFit: 'cover',
                filter: 'sepia(0.13) saturate(1.14) brightness(1.02) contrast(1.02)',
              }}
            />
          </div>
        </div>
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: 'min(920px, calc(100% - 48px))',
            margin: '0 auto',
            padding: 'clamp(40px, 6vw, 72px) 0 clamp(88px, 12vw, 170px)',
          }}
        >
          <Reveal delay={0} style={{ ...eyebrowStyle, color: '#8f8984' }}>
            Where this started
          </Reveal>
          <Reveal
            as="div"
            delay={100}
            style={{
              margin: '30px 0 0',
              fontSize: 'clamp(22px, 3vw, 36px)',
              fontWeight: 500,
              lineHeight: 1.42,
              letterSpacing: '-0.03em',
              color: '#eae2d5',
              textWrap: 'pretty',
            }}
          >
            Everyone in this industry walks in carrying the same dog. He is eleven, he is slowing
            down, and three weeks before he dies a vet runs careful hands along his belly and finds
            nothing, because the bloodwork is in another system and the scan is on a disc in a
            drawer.
          </Reveal>
          <Reveal
            as="div"
            delay={200}
            style={{
              margin: '28px 0 0',
              fontSize: 'clamp(18px, 2.1vw, 22px)',
              lineHeight: 1.6,
              letterSpacing: '-0.02em',
              color: '#a9a39e',
              textWrap: 'pretty',
            }}
          >
            Each person who saw him saw a slice, and the slices never met, so the thing growing in
            him grew in the gaps between screens. He didn&apos;t die for lack of an app.{' '}
            <span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#eae2d5',
              }}
            >
              He died because the clinic couldn&apos;t see him.
            </span>{' '}
            So we built the thing that puts the pieces together instead.
          </Reveal>
        </div>
      </section>
    </Spotlight>
  );
}

/* ------------------------------------------------------------- BELIEFS */

interface Belief {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  delay: number;
}

const BELIEFS: Belief[] = [
  {
    icon: <IoExitOutline aria-hidden="true" style={{ fontSize: '21px' }} />,
    title: 'Leaving is free',
    body: (
      <>
        The only way to prove you won&apos;t trap someone is to make trapping them impossible.
        Everything exports, and you can fork the whole thing and walk.
      </>
    ),
    delay: 0,
  },
  {
    icon: <IoWalletOutline aria-hidden="true" style={{ fontSize: '21px' }} />,
    title: 'No toll booth',
    body: (
      <>
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
          We take no cut of your payments
        </strong>
        {
          ". The day you tax money you didn't create, you stop making the product better and start making the toll bigger."
        }
      </>
    ),
    delay: 80,
  },
  {
    icon: <IoCloudOfflineOutline aria-hidden="true" style={{ fontSize: '21px' }} />,
    title: 'Built for the worst afternoon',
    body: (
      <>
        Most software is built for the demo. A clinic lives on the outage and the crash, so the
        database sits on your machine and keeps working offline.
      </>
    ),
    delay: 160,
  },
  {
    icon: <IoLocationOutline aria-hidden="true" style={{ fontSize: '21px' }} />,
    title: 'Your data answers to your flag',
    body: (
      <>
        Records stay in the country you practice in, under laws you actually agreed to, not wherever
        a provider found cheap electricity that week.
      </>
    ),
    delay: 0,
  },
  {
    icon: <IoDocumentLockOutline aria-hidden="true" style={{ fontSize: '21px' }} />,
    title: "If it isn't written down, it didn't happen",
    body: (
      <>
        The rule at the heart of regulated medicine. Trust is built out of evidence, so if a dose
        was given, the system can prove it.
      </>
    ),
    delay: 80,
  },
  {
    icon: <IoPeopleOutline aria-hidden="true" style={{ fontSize: '21px' }} />,
    title: 'Small on purpose',
    body: (
      <>
        Headcount is not progress. We keep the team small so an idea reaches a clinic&apos;s screen
        in an afternoon, with no committee for it to die in.
      </>
    ),
    delay: 160,
  },
];

function BeliefCard({ belief }: Readonly<{ belief: Belief }>) {
  return (
    <Reveal
      delay={belief.delay}
      style={{
        background: 'var(--inset)',
        borderRadius: '24px',
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <span style={BELIEF_ICON_STYLE}>{belief.icon}</span>
      <div
        style={{
          fontSize: '19px',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: 'var(--ink)',
        }}
      >
        {belief.title}
      </div>
      <div
        style={{
          fontSize: '15px',
          lineHeight: 1.6,
          color: 'var(--ink-muted)',
          letterSpacing: '-0.01em',
        }}
      >
        {belief.body}
      </div>
    </Reveal>
  );
}

function Beliefs() {
  return (
    <section style={{ background: 'var(--page)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
        }}
      >
        <Reveal
          delay={0}
          style={{
            maxWidth: '680px',
            marginBottom: 'clamp(40px, 5vw, 64px)',
          }}
        >
          <span style={{ ...eyebrowStyle, color: 'var(--blue-text)' }}>What we believe</span>
          <h2 style={sectionHeadingStyle}>Six things we won&apos;t quietly walk back.</h2>
        </Reveal>
        <div
          data-grid-2-m="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
          }}
        >
          {BELIEFS.map((belief) => (
            <BeliefCard key={belief.title} belief={belief} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------- BUILDING IN PUBLIC */

interface LiveStat {
  value: string;
  label: string;
  source: string;
  delay: number;
}

function StatColumn({ stat }: Readonly<{ stat: LiveStat }>) {
  return (
    <Reveal
      delay={stat.delay}
      style={{
        borderTop: '1px solid var(--divider)',
        paddingTop: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <CountUp
        value={stat.value}
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
          fontSize: '15px',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: 'var(--ink-body)',
        }}
      >
        {stat.label}
      </span>
      <span
        style={{
          fontSize: '13px',
          letterSpacing: '-0.01em',
          color: 'var(--ink-faint2)',
        }}
      >
        {stat.source}
      </span>
    </Reveal>
  );
}

function BuildingInPublic() {
  const stats = useGithubStats();
  const columns: LiveStat[] = [
    {
      value: stats.selfHosters ?? '·',
      label: 'Self-hosters',
      source: 'live via GitHub',
      delay: 0,
    },
    {
      value: stats.contributors ?? '·',
      label: 'Contributors',
      source: 'live via GitHub',
      delay: 80,
    },
    {
      value: stats.discord ?? '·',
      label: 'Discord members',
      source: 'live via Discord',
      delay: 160,
    },
    {
      value: stats.starsFull ?? '·',
      label: 'Repo stars',
      source: 'live via GitHub',
      delay: 240,
    },
  ];

  return (
    <section style={{ background: 'var(--inset)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
        }}
      >
        <Reveal delay={0} style={{ maxWidth: '720px' }}>
          <span style={{ ...eyebrowStyle, color: 'var(--ink-faint)' }}>Building in public</span>
          <h2 style={sectionHeadingStyle}>
            Most companies keep their numbers private. We don&apos;t.
          </h2>
          <p
            style={{
              margin: '20px 0 0',
              fontSize: '18px',
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: 'var(--ink-muted)',
              textWrap: 'pretty',
            }}
          >
            When numbers are public, you see what&apos;s working and what isn&apos;t, and it pushes
            better decisions. Some months are messy, and that&apos;s part of it, because hiding a
            bad month only delays fixing it. These update live from GitHub and Discord.
          </p>
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
          {columns.map((stat) => (
            <StatColumn key={stat.label} stat={stat} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------ CONTRIBUTORS */

interface CrewMember {
  name: string;
  role: string;
  href: string;
  delay: number;
  slotId?: string;
  avatarSrc?: string;
}

const CORE_TEAM: CrewMember[] = [
  {
    name: 'Ankit Upadhyay',
    role: 'Founder and contributor',
    href: 'https://www.linkedin.com/in/aupyay/',
    slotId: 'crew-ankit',
    delay: 0,
  },
  {
    name: 'Harshvardhan Parmar',
    role: 'Contributor',
    href: 'https://www.linkedin.com/in/harshvardhan-parmar/',
    slotId: 'crew-harshvardhan',
    delay: 80,
  },
  {
    name: 'Sneha',
    role: 'Contributor',
    href: 'https://www.linkedin.com/in/snehadevc/',
    slotId: 'crew-sneha',
    delay: 160,
  },
  {
    name: 'Vallirani Ravulapati',
    role: 'Contributor',
    href: 'https://www.linkedin.com/in/vallirani-ravulapati/',
    slotId: 'crew-vallirani',
    delay: 240,
  },
];

function ProfileCard({
  name,
  role,
  href,
  delay,
  icon,
  ariaLabel,
  slotId,
  avatarSrc,
}: Readonly<{
  name: string;
  role: string;
  href: string;
  delay: number;
  icon: ReactNode;
  ariaLabel: string;
  slotId?: string;
  avatarSrc?: string;
}>) {
  return (
    <Reveal delay={delay} as="span">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="yc-crew-card"
        aria-label={ariaLabel}
        style={{
          textDecoration: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          transition: 'transform 350ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div
          style={{
            position: 'relative',
            aspectRatio: '1 / 1',
            borderRadius: '22px',
            overflow: 'hidden',
            background: 'var(--inset)',
            border: '1px solid var(--hairline)',
            boxShadow: '0 18px 40px var(--sh08)',
          }}
        >
          {avatarSrc ? (
            <Image
              src={avatarSrc}
              alt=""
              fill
              sizes="(max-width: 900px) 50vw, 25vw"
              style={{
                objectFit: 'cover',
                filter: 'sepia(0.05) saturate(1.02) brightness(1.02) contrast(1.02)',
              }}
            />
          ) : (
            <span data-slot={slotId} aria-hidden="true" style={CREW_SLOT_STYLE}>
              {name.charAt(0)}
            </span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--ink)',
              }}
            >
              {name}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--ink-faint)' }}>{role}</div>
          </div>
          <span style={{ flex: 'none', color: 'var(--blue)' }} aria-hidden="true">
            {icon}
          </span>
        </div>
      </a>
    </Reveal>
  );
}

function LiveContributorCard({
  contributor,
  delay,
}: Readonly<{ contributor: GithubContributor; delay: number }>) {
  return (
    <ProfileCard
      name={contributor.login}
      role="GitHub contributor"
      href={contributor.href}
      delay={delay}
      icon={<IoLogoGithub aria-hidden="true" style={{ fontSize: '18px' }} />}
      ariaLabel={`${contributor.login}, GitHub contributor, on GitHub`}
      avatarSrc={contributor.avatarSrc}
    />
  );
}

function CommunityPill({
  href,
  icon,
  label,
}: Readonly<{ href: string; icon: ReactNode; label: string }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="yc-community-pill"
      style={communityPillStyle}
    >
      {icon}
      {label}
    </a>
  );
}

function TheCrew() {
  const contributors = useGithubContributors();

  return (
    <section style={{ background: 'var(--page)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
        }}
      >
        <Reveal
          delay={0}
          style={{
            maxWidth: '760px',
            marginBottom: 'clamp(44px, 5vw, 68px)',
          }}
        >
          <span style={{ ...eyebrowStyle, color: 'var(--blue-text)' }}>Our contributors</span>
          <h2 style={sectionHeadingStyle}>Everyone who helped build Yosemite Crew.</h2>
          <p
            style={{
              margin: '20px 0 0',
              fontSize: '18px',
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: 'var(--ink-muted)',
              textWrap: 'pretty',
            }}
          >
            No gates, no egos. We started with a small founding group, and the product kept growing
            because contributors showed up with issues, pull requests, design feedback, and hard
            questions in the open. As Yosemite Crew moves toward a nonprofit future, we want this
            page to name the people who helped make it real, not just the original team.
          </p>
        </Reveal>
        <div
          data-grid-2-m="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'clamp(16px, 2vw, 26px)',
          }}
        >
          {CORE_TEAM.map((member) => (
            <ProfileCard
              key={member.name}
              name={member.name}
              role={member.role}
              href={member.href}
              delay={member.delay}
              icon={<IoLogoLinkedin aria-hidden="true" style={{ fontSize: '18px' }} />}
              ariaLabel={`${member.name}, ${member.role}, on LinkedIn`}
              slotId={member.slotId}
            />
          ))}
        </div>
        <Reveal
          delay={120}
          style={{
            marginTop: 'clamp(36px, 4vw, 52px)',
            paddingTop: '28px',
            borderTop: '1px solid #e0d8ce',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
            }}
          >
            Live GitHub contributors
          </div>
          <p
            style={{
              margin: '14px 0 0',
              fontSize: '16px',
              lineHeight: 1.6,
              letterSpacing: '-0.01em',
              color: 'var(--ink-muted)',
              textWrap: 'pretty',
            }}
          >
            This list loads directly from GitHub, so the roster stays current as the project grows.
          </p>
        </Reveal>
        <div
          data-grid-2-m="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'clamp(16px, 2vw, 26px)',
            marginTop: '20px',
          }}
        >
          {contributors ? (
            contributors.map((contributor, index) => (
              <LiveContributorCard
                key={contributor.login}
                contributor={contributor}
                delay={index * 40}
              />
            ))
          ) : (
            <div
              style={{
                fontSize: '16px',
                lineHeight: 1.6,
                color: 'var(--ink-muted)',
              }}
            >
              Loading contributors...
            </div>
          )}
        </div>
        <Reveal
          delay={0}
          style={{
            marginTop: 'clamp(36px, 4vw, 52px)',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            flexWrap: 'wrap',
            paddingTop: '28px',
            borderTop: '1px solid #e0d8ce',
          }}
        >
          <span
            style={{
              fontSize: '15px',
              letterSpacing: '-0.01em',
              color: 'var(--ink-muted)',
            }}
          >
            And the wider community that keeps it moving.
          </span>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <CommunityPill
              href={CONTRIBUTORS_URL}
              icon={<IoLogoGithub aria-hidden="true" style={{ fontSize: '16px' }} />}
              label="Contributors on GitHub"
            />
            <CommunityPill
              href={DISCORD_INVITE_URL}
              icon={<IoLogoDiscord aria-hidden="true" style={{ fontSize: '16px' }} />}
              label="Join the Discord"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- COMPANY */

interface EntityFact {
  label: string;
  value: ReactNode;
}

const ENTITY_FACTS: EntityFact[] = [
  {
    label: 'Legal entity',
    value: <>DuneXploration UG (haftungsbeschränkt)</>,
  },
  {
    label: 'Based in',
    value: (
      <>
        Am Finther Weg 7
        <br />
        55127 Mainz, Germany
      </>
    ),
  },
  {
    label: 'Licence',
    value: <>AGPL-3.0 · you own the software</>,
  },
  {
    label: 'Registered',
    value: (
      <>
        Amtsgericht Mainz HRB 52778
        <br />
        VAT DE367920596
      </>
    ),
  },
];

function Company() {
  return (
    <section style={{ background: 'var(--band)' }}>
      <div
        data-grid-1-m="true"
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(72px, 9vw, 120px) 0',
          display: 'grid',
          gridTemplateColumns: '0.8fr 1.2fr',
          gap: 'clamp(40px, 5vw, 80px)',
          alignItems: 'center',
        }}
      >
        <Reveal delay={0}>
          <span style={{ ...eyebrowStyle, color: 'var(--blue-text)' }}>The company</span>
          <h2
            style={{
              margin: '20px 0 0',
              fontFamily: SERIF,
              fontSize: 'clamp(28px, 3.4vw, 42px)',
              fontWeight: 500,
              lineHeight: 1.12,
              letterSpacing: '-0.045em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            Made in Mainz, owned by no one else.
          </h2>
          <p
            style={{
              margin: '18px 0 0',
              fontSize: '16px',
              lineHeight: 1.65,
              letterSpacing: '-0.01em',
              color: 'var(--ink-muted)',
            }}
          >
            Yosemite Crew is built so that nobody can cleanly buy it, and for once, that&apos;s
            exactly the point.
          </p>
        </Reveal>
        <Reveal
          delay={100}
          style={{
            background: 'var(--inset)',
            borderRadius: '28px',
            padding: 'clamp(28px, 3.4vw, 44px)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '28px',
          }}
        >
          {ENTITY_FACTS.map((fact) => (
            <div key={fact.label}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-faint2)',
                  marginBottom: '8px',
                }}
              >
                {fact.label}
              </div>
              <div
                style={{
                  fontSize: '15.5px',
                  lineHeight: 1.5,
                  color: 'var(--ink-body)',
                  letterSpacing: '-0.01em',
                }}
              >
                {fact.value}
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- CTA */

function ClosingCta() {
  return (
    <Spotlight style={{ background: 'var(--spot)', overflow: 'hidden' }}>
      <section data-screen-label="CTA">
        <HeroGlow
          parallax={false}
          color="var(--glow-b14)"
          box={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '900px',
            height: '500px',
          }}
        />
        <div style={CTA_INNER_STYLE}>
          <Reveal as="div" delay={0}>
            <h2
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: 'clamp(36px, 5.2vw, 66px)',
                fontWeight: 500,
                lineHeight: 1.06,
                letterSpacing: '-0.055em',
                color: '#eae2d5',
                textWrap: 'balance',
              }}
            >
              Help us build the layer underneath.
            </h2>
          </Reveal>
          <Reveal
            as="div"
            delay={100}
            style={{
              margin: '22px 0 0',
              maxWidth: '560px',
              fontSize: '18px',
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: '#a9a39e',
              textWrap: 'pretty',
            }}
          >
            Run it, contribute to it, or just tell us where it falls short. The whole thing is in
            the open, and it gets better because people in the room care whether it does.
          </Reveal>
          <Reveal
            delay={200}
            data-stack-m="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginTop: '36px',
            }}
          >
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="yc-cta-solid"
              style={GITHUB_STAR_CTA_STYLE}
            >
              <IoLogoGithub aria-hidden="true" style={{ fontSize: '18px' }} />
              Star on GitHub
            </a>
            <Link href="/contact-us" className="yc-cta-ghost" style={CTA_GHOST_STYLE}>
              Talk to us
            </Link>
          </Reveal>
        </div>
      </section>
    </Spotlight>
  );
}

/* ---------------------------------------------------------------- PAGE */

export function About() {
  return (
    <>
      <Hero />
      <Origin />
      <Beliefs />
      <BuildingInPublic />
      <TheCrew />
      <Company />
      <ClosingCta />
    </>
  );
}
