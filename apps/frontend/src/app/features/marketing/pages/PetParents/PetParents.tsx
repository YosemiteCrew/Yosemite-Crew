'use client';

import { type CSSProperties, type ReactNode } from 'react';
import {
  IoCellular,
  IoBatteryFull,
  IoCalendarOutline,
  IoMedkitOutline,
  IoShieldCheckmarkOutline,
  IoHome,
  IoChatbubbleOutline,
  IoPersonOutline,
  IoShareOutline,
  IoLogoApple,
  IoLogoGooglePlaystore,
  IoGitNetworkOutline,
  IoPeopleOutline,
  IoChatbubblesOutline,
  IoNotificationsOutline,
  IoPulseOutline,
  IoWalletOutline,
  IoFolderOpenOutline,
  IoArrowForwardOutline,
} from 'react-icons/io5';
import { type IconType } from 'react-icons';
import Link from 'next/link';
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
  APP_STORE_URL,
  PLAY_STORE_URL,
} from '@/app/features/marketing/site';

const HEADING_FONT = 'var(--font-newsreader)';
const EASE = 'cubic-bezier(0.16,1,0.3,1)';

/* ---------- Hero ---------- */

interface Companion {
  letter: string;
  name: string;
  border: string;
  avatarBg: string;
  avatarColor: string;
  nameWeight: number;
  nameColor: string;
}

const COMPANIONS: readonly Companion[] = [
  {
    letter: 'B',
    name: 'Bella',
    border: '1.5px solid var(--blue)',
    avatarBg: 'var(--blue-soft)',
    avatarColor: 'var(--blue)',
    nameWeight: 700,
    nameColor: 'var(--ink-body)',
  },
  {
    letter: 'F',
    name: 'Fjord',
    border: '1px solid var(--hairline)',
    avatarBg: 'var(--avatar-green-bg)',
    avatarColor: '#006642',
    nameWeight: 500,
    nameColor: 'var(--ink-muted)',
  },
  {
    letter: 'M',
    name: 'Miso',
    border: '1px solid var(--hairline)',
    avatarBg: 'var(--avatar-amber-bg)',
    avatarColor: 'var(--avatar-amber-ink)',
    nameWeight: 500,
    nameColor: 'var(--ink-muted)',
  },
];

function CompanionCard({
  letter,
  name,
  border,
  avatarBg,
  avatarColor,
  nameWeight,
  nameColor,
}: Readonly<Companion>) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '12px 8px',
        background: 'var(--screen)',
        border,
        borderRadius: 18,
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: 9999,
          background: avatarBg,
          color: avatarColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        {letter}
      </span>
      <span style={{ fontSize: 12, fontWeight: nameWeight, color: nameColor }}>{name}</span>
    </div>
  );
}

interface Reminder {
  icon: IconType;
  iconBg: string;
  iconColor: string;
  text: string;
}

const REMINDERS: readonly Reminder[] = [
  {
    icon: IoMedkitOutline,
    iconBg: 'var(--avatar-amber-bg)',
    iconColor: 'var(--avatar-amber-ink)',
    text: 'Carprofen, this evening',
  },
  {
    icon: IoShieldCheckmarkOutline,
    iconBg: 'var(--avatar-green-bg)',
    iconColor: '#006642',
    text: 'Fjord, vaccine due in 9 days',
  },
];

function ReminderRow({ icon: Icon, iconBg, iconColor, text }: Readonly<Reminder>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
        <Icon style={{ fontSize: 15 }} aria-hidden="true" />
      </span>
      <span style={{ fontSize: 12.5, color: 'var(--ink-muted)', flex: 1 }}>{text}</span>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 9999,
          border: '2px solid var(--divider)',
        }}
      />
    </div>
  );
}

function HeroFloatCard({
  position,
  animation,
  avatar,
  title,
  subtitle,
}: Readonly<{
  position: CSSProperties;
  animation: string;
  avatar: ReactNode;
  title: string;
  subtitle: string;
}>) {
  return (
    <div
      data-hero-float="true"
      style={{
        position: 'absolute',
        ...position,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 15px',
        borderRadius: 16,
        background: 'var(--glass-93)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid var(--glass-95)',
        boxShadow: '0 16px 44px var(--sh12)',
        animation,
      }}
    >
      {avatar}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-body)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{subtitle}</div>
      </div>
    </div>
  );
}

function HeroPhone() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        position: 'relative',
        opacity: 0,
        animation: `ycRise 1.1s ${EASE} 0.4s both`,
      }}
    >
      <div
        style={{
          width: 300,
          background: '#1d1c1b',
          borderRadius: 46,
          padding: 8,
          boxShadow: '0 40px 90px var(--sh20)',
        }}
      >
        <div style={{ background: 'var(--page)', borderRadius: 39, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 24px 6px',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-body)' }}>9:41</span>
            <span style={{ width: 78, height: 22, borderRadius: 9999, background: '#1d1c1b' }} />
            <span style={{ display: 'flex', gap: 4, color: 'var(--ink-body)' }}>
              <IoCellular style={{ fontSize: 12 }} aria-hidden="true" />
              <IoBatteryFull style={{ fontSize: 14 }} aria-hidden="true" />
            </span>
          </div>
          <div
            style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div>
              <div style={{ fontSize: 13, color: 'var(--ink-faint)', letterSpacing: '-0.01em' }}>
                Good morning, Lena
              </div>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: 'var(--ink)',
                }}
              >
                Your companions
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {COMPANIONS.map((companion) => (
                <CompanionCard key={companion.letter} {...companion} />
              ))}
            </div>
            <div
              style={{
                background: 'var(--screen)',
                border: '1px solid var(--hairline)',
                borderRadius: 20,
                padding: 15,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
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
                  Next appointment
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--blue)',
                    background: 'var(--blue-soft)',
                    borderRadius: 9999,
                    padding: '3px 9px',
                  }}
                >
                  UPCOMING
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    flex: 'none',
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    background: 'var(--blue-soft)',
                    color: 'var(--blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IoCalendarOutline style={{ fontSize: 18 }} aria-hidden="true" />
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-body)' }}>
                    Sat 5 July, 09:00
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                    Bella · Dr. Weber · Alpenblick
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                background: 'var(--screen)',
                border: '1px solid var(--hairline)',
                borderRadius: 20,
                padding: 15,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
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
                Reminders
              </span>
              {REMINDERS.map((reminder) => (
                <ReminderRow key={reminder.text} {...reminder} />
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                padding: '8px 6px 2px',
                borderTop: '1px solid var(--inset)',
              }}
            >
              <IoHome style={{ fontSize: 20, color: 'var(--blue)' }} aria-hidden="true" />
              <IoCalendarOutline
                style={{ fontSize: 20, color: 'var(--ink-faint2)' }}
                aria-hidden="true"
              />
              <IoChatbubbleOutline
                style={{ fontSize: 20, color: 'var(--ink-faint2)' }}
                aria-hidden="true"
              />
              <IoPersonOutline
                style={{ fontSize: 20, color: 'var(--ink-faint2)' }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
      <HeroFloatCard
        position={{ top: '12%', left: -40 }}
        animation="ycFloatA 7s ease-in-out infinite"
        avatar={
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9999,
              background: 'var(--blue-soft)',
              color: 'var(--blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            SW
          </span>
        }
        title="Dr. Weber"
        subtitle="Bloodwork came back clear"
      />
      <HeroFloatCard
        position={{ bottom: '14%', right: -34 }}
        animation="ycFloatB 8.5s ease-in-out 1s infinite"
        avatar={
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: 'var(--avatar-green-bg)',
              color: '#006642',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IoShareOutline style={{ fontSize: 15 }} aria-hidden="true" />
          </span>
        }
        title="Sent to the new clinic"
        subtitle="One tap, whole history"
      />
    </div>
  );
}

const HERO_WORDS: ReadonlyArray<{ text: string; em?: boolean; delay: string }> = [
  { text: 'Your', delay: '0.1s' },
  { text: "companion's", delay: '0.22s' },
  { text: 'whole', em: true, delay: '0.34s' },
  { text: 'story.', delay: '0.46s' },
];

function Hero() {
  const appleRef = useMagnet<HTMLAnchorElement>();
  const playRef = useMagnet<HTMLAnchorElement>();
  const parallaxRef = useParallax<HTMLElement>();

  return (
    <section
      ref={parallaxRef}
      data-hero
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, var(--page) 0%, var(--page) 55%, var(--inset) 100%)',
        padding: '140px 24px 90px',
      }}
    >
      <HeroVideo src={HERO_VIDEOS.petParents} poster={HERO_POSTERS.petParents} />
      <div
        data-hero-scrim
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'radial-gradient(74% 72% at 32% 50%, rgba(239,232,220,0.95) 0%, rgba(239,232,220,0.66) 38%, rgba(239,232,220,0.12) 72%, rgba(239,232,220,0) 86%), linear-gradient(180deg, rgba(239,232,220,0.6) 0%, rgba(239,232,220,0.3) 46%, rgba(239,232,220,0.06) 74%, rgba(239,232,220,0) 92%)',
        }}
      />
      <HeroGlow
        color="var(--glow-p10)"
        scrollSpeed="-0.05"
        box={{ top: -140, right: 'calc(50% - 640px)', width: 820, height: 580 }}
        animation="ycDrift 32s ease-in-out infinite alternate"
        depth="0.05"
      />
      <HeroGlow
        color="var(--glow-b08)"
        scrollSpeed="0.04"
        box={{ bottom: -200, left: -120, width: 720, height: 540 }}
        animation="ycDrift 40s ease-in-out 3s infinite alternate-reverse"
        depth="0.06"
      />
      <div
        data-grid-1-m="true"
        style={{
          position: 'relative',
          zIndex: 2,
          width: 'min(1200px, 100%)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.05fr 0.95fr',
          gap: 'clamp(32px, 5vw, 72px)',
          alignItems: 'center',
        }}
      >
        <div
          data-center-m="true"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
        >
          <ReleasePill variant="mobile" label="Mobile app" version="v1.2 beta" />
          <h1
            style={{
              fontFamily: HEADING_FONT,
              margin: '24px 0 0',
              fontSize: 'clamp(42px, 5.6vw, 82px)',
              fontWeight: 500,
              lineHeight: 1.04,
              letterSpacing: '-0.06em',
              color: 'var(--ink)',
              textWrap: 'balance',
              display: 'flex',
              flexWrap: 'wrap',
              columnGap: '0.24em',
            }}
          >
            {HERO_WORDS.map((word) =>
              word.em ? (
                <em
                  key={word.text}
                  style={{
                    display: 'inline-block',
                    fontStyle: 'italic',
                    fontWeight: 480,
                    color: 'var(--pink)',
                    opacity: 0,
                    animation: `ycWord 1.1s ${EASE} ${word.delay} both`,
                  }}
                >
                  <InkAnnotate type="circle" delay={1750}>
                    {word.text}
                  </InkAnnotate>
                </em>
              ) : (
                <span
                  key={word.text}
                  style={{
                    display: 'inline-block',
                    opacity: 0,
                    animation: `ycWord 1.1s ${EASE} ${word.delay} both`,
                  }}
                >
                  {word.text}
                </span>
              )
            )}
          </h1>
          <p
            style={{
              margin: '24px 0 0',
              maxWidth: 520,
              fontSize: 'clamp(17px, 2vw, 20px)',
              lineHeight: 1.6,
              letterSpacing: '-0.025em',
              color: 'var(--ink-soft)',
              textShadow: '0 1px 16px rgba(239,232,220,0.94), 0 1px 3px rgba(239,232,220,0.85)',
              opacity: 0,
              animation: `ycHeroUp 1s ${EASE} 0.5s both`,
              textWrap: 'pretty',
            }}
          >
            Cats, dogs and horses, every visit and every dose on one timeline. The years of notes
            that keep a companion alive finally live somewhere you can reach, instead of in your
            head and a folder in a drawer.
          </p>
          <div
            data-stack-m="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 34,
              opacity: 0,
              animation: `ycHeroUp 1s ${EASE} 0.62s both`,
            }}
          >
            <a
              ref={appleRef}
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener"
              data-appbadge
              style={appBadgeStyle}
            >
              <IoLogoApple style={{ fontSize: 26 }} aria-hidden="true" />
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                <span style={{ fontSize: 10, letterSpacing: '0.02em', color: 'var(--dl-btn-sub)' }}>
                  Download on the
                </span>
                <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>
                  App Store
                </span>
              </span>
            </a>
            <a
              ref={playRef}
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener"
              data-appbadge
              style={appBadgeStyle}
            >
              <IoLogoGooglePlaystore style={{ fontSize: 23 }} aria-hidden="true" />
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                <span style={{ fontSize: 10, letterSpacing: '0.02em', color: 'var(--dl-btn-sub)' }}>
                  Get it on
                </span>
                <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>
                  Google Play
                </span>
              </span>
            </a>
          </div>
        </div>
        <HeroPhone />
      </div>
    </section>
  );
}

const appBadgeStyle: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  background: 'var(--dl-btn)',
  color: 'var(--dl-btn-text)',
  padding: '12px 20px',
  borderRadius: 16,
  boxShadow: '0 10px 26px var(--sh16)',
  transition: 'background 200ms, transform 200ms',
};

/* ---------- Story (dark) ---------- */

function Story() {
  return (
    <Spotlight style={{ position: 'relative', background: 'var(--spot)', overflow: 'hidden' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -220,
          left: -160,
          width: 780,
          height: 600,
          background: 'radial-gradient(closest-side, var(--glow-p12), transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          width: 'min(980px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(88px, 12vw, 160px) 0',
        }}
      >
        <Reveal delay={0}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#8f8984',
            }}
          >
            Whose history is it, anyway
          </div>
        </Reveal>
        <Reveal delay={100}>
          <p
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
            When Germaine moved from the UK to Barcelona, his new vet needed Preemo&apos;s records,
            and the old clinic could only print them, page by page, because the software had no way
            to hand them over. Four years of careful notes about keeping one dog well, locked inside
            a company Germaine never chose.{' '}
            <span
              style={{
                fontFamily: HEADING_FONT,
                fontStyle: 'italic',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#ff90d4',
              }}
            >
              Your companion is yours. The record of their life should be too.
            </span>{' '}
            Here, it always exports.
          </p>
        </Reveal>
      </div>
    </Spotlight>
  );
}

/* ---------- Features grid ---------- */

interface Feature {
  icon: IconType;
  title: string;
  body: string;
  delay: number;
}

const FEATURES: readonly Feature[] = [
  {
    icon: IoGitNetworkOutline,
    title: 'Everyone who cares for them, in one place',
    body: 'Link your vet, groomer, boarder and sitter to the same profile. Every visit and every note lands on one timeline, whoever did the work.',
    delay: 0,
  },
  {
    icon: IoPeopleOutline,
    title: 'Share the care with your household',
    body: 'Add a partner, a kid, a dog walker or a co-parent. Everyone looking after them sees the same record, the same reminders, the same vet thread.',
    delay: 80,
  },
  {
    icon: IoCalendarOutline,
    title: 'Book without the phone call',
    body: 'See the real openings at the businesses you are linked to, and take the time you want instead of waiting on hold.',
    delay: 160,
  },
  {
    icon: IoChatbubblesOutline,
    title: 'Ask your vet, keep the thread',
    body: 'Send the photo of the limp, get the results back, and keep it in one conversation instead of scattered across email and voicemail.',
    delay: 0,
  },
  {
    icon: IoNotificationsOutline,
    title: "Reminders you don't hold in your head",
    body: 'Doses, vaccines and rechecks arrive on time, so the whole schedule stops living in your memory and a folder in a drawer.',
    delay: 80,
  },
  {
    icon: IoShieldCheckmarkOutline,
    title: 'Report a reaction, protect the next animal',
    body: 'If a medicine or vaccine goes wrong, report it in a few taps. It reaches the people who track drug safety, so one bad day helps keep the next animal well.',
    delay: 160,
  },
  {
    icon: IoPulseOutline,
    title: 'Notice trouble sooner',
    body: 'Guided check-ins for pain, mobility and appetite turn a vague off day into something you can show the vet, a trend instead of a guess.',
    delay: 0,
  },
  {
    icon: IoWalletOutline,
    title: 'See what they really cost',
    body: "Log vet bills, food and insurance against each companion, so the year's spend is a number you can see instead of a shoebox of receipts.",
    delay: 80,
  },
  {
    icon: IoFolderOpenOutline,
    title: 'Every document in one drawer',
    body: 'Insurance papers, lab results, pedigree and adoption records, kept together and searchable instead of scattered across email and a kitchen shelf.',
    delay: 160,
  },
];

function FeatureCard({ feature }: Readonly<{ feature: Feature }>) {
  const Icon = feature.icon;
  return (
    <Reveal
      delay={feature.delay}
      className="yc-card-lift"
      style={{
        background: 'var(--inset)',
        borderRadius: 26,
        padding: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <span
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          background: 'var(--pill-raised)',
          color: 'var(--blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon style={{ fontSize: 22 }} aria-hidden="true" />
      </span>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
        {feature.title}
      </div>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: 'var(--ink-muted)',
          letterSpacing: '-0.01em',
        }}
      >
        {feature.body}
      </div>
    </Reveal>
  );
}

function Features() {
  return (
    <section style={{ background: 'var(--page)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
        }}
      >
        <Reveal delay={0} style={{ maxWidth: 680, marginBottom: 'clamp(40px, 5vw, 64px)' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--blue)',
            }}
          >
            What you can do
          </span>
          <h2
            style={{
              fontFamily: HEADING_FONT,
              margin: '22px 0 0',
              fontSize: 'clamp(30px, 4vw, 50px)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.05em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            Less chasing. More knowing.
          </h2>
        </Reveal>
        <div
          data-grid-2-m="true"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}
        >
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA ---------- */

function Cta() {
  const primaryRef = useMagnet<HTMLAnchorElement>();
  const secondaryRef = useMagnet<HTMLAnchorElement>();

  return (
    <section style={{ position: 'relative', background: 'var(--inset)', overflow: 'hidden' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 900,
          height: 500,
          background: 'radial-gradient(closest-side, var(--glow-p08), transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          width: 'min(880px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(88px, 12vw, 150px) 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <Reveal delay={0}>
          <h2
            style={{
              fontFamily: HEADING_FONT,
              margin: 0,
              fontSize: 'clamp(36px, 5.2vw, 66px)',
              fontWeight: 500,
              lineHeight: 1.06,
              letterSpacing: '-0.055em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            Get the app. Keep the record.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p
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
            Start with one companion and add the rest. It is free for pet parents, and everything
            you put in comes back out whenever you ask.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <div
            data-stack-m="true"
            style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 36 }}
          >
            <Link
              ref={primaryRef}
              href="/signup"
              className="yc-btn-primary"
              style={{
                fontSize: 17,
                padding: '16px 32px',
                borderRadius: 9999,
                boxShadow: '0 10px 30px var(--sh18)',
              }}
            >
              Get the app <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
            </Link>
            <Link
              ref={secondaryRef}
              href="/pet-businesses"
              style={{
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
              }}
            >
              I run a clinic
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Page ---------- */

export function PetParents() {
  return (
    <>
      <Hero />
      <Story />
      <Features />
      <Cta />
    </>
  );
}
