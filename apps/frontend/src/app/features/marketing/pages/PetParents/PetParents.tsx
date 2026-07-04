'use client';

import { type CSSProperties } from 'react';
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
  Reveal,
  Spotlight,
  ReleasePill,
  useMagnet,
  HERO_VIDEOS,
  APP_STORE_URL,
  PLAY_STORE_URL,
} from '@/app/features/marketing/site';

const HEADING_FONT = 'var(--font-newsreader)';
const EASE = 'cubic-bezier(0.16,1,0.3,1)';

/* ---------- Hero ---------- */

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
          boxShadow: '0 40px 90px rgba(29,28,27,0.2)',
        }}
      >
        <div style={{ background: '#efe8dc', borderRadius: 39, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 24px 6px',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#302f2e' }}>9:41</span>
            <span style={{ width: 78, height: 22, borderRadius: 9999, background: '#1d1c1b' }} />
            <span style={{ display: 'flex', gap: 4, color: '#302f2e' }}>
              <IoCellular style={{ fontSize: 12 }} aria-hidden="true" />
              <IoBatteryFull style={{ fontSize: 14 }} aria-hidden="true" />
            </span>
          </div>
          <div
            style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div>
              <div style={{ fontSize: 13, color: '#8f8984', letterSpacing: '-0.01em' }}>
                Good morning, Lena
              </div>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: '#1d1c1b',
                }}
              >
                Your companions
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 8px',
                  background: '#f7f3ec',
                  border: '1.5px solid #257bed',
                  borderRadius: 18,
                }}
              >
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 9999,
                    background: '#e6f2ff',
                    color: '#257bed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  B
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#302f2e' }}>Bella</span>
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 8px',
                  background: '#f7f3ec',
                  border: '1px solid #e5dccf',
                  borderRadius: 18,
                }}
              >
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 9999,
                    background: '#e6f4ef',
                    color: '#006642',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  F
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#5c5956' }}>Fjord</span>
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 8px',
                  background: '#f7f3ec',
                  border: '1px solid #e5dccf',
                  borderRadius: 18,
                }}
              >
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 9999,
                    background: '#fef3e9',
                    color: '#af5e19',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  M
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#5c5956' }}>Miso</span>
              </div>
            </div>
            <div
              style={{
                background: '#f7f3ec',
                border: '1px solid #e5dccf',
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
                    color: '#302f2e',
                  }}
                >
                  Next appointment
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: '#257bed',
                    background: '#e6f2ff',
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
                    background: '#e6f2ff',
                    color: '#257bed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IoCalendarOutline style={{ fontSize: 18 }} aria-hidden="true" />
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#302f2e' }}>
                    Sat 5 July, 09:00
                  </div>
                  <div style={{ fontSize: 12, color: '#8f8984' }}>
                    Bella · Dr. Weber · Alpenblick
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                background: '#f7f3ec',
                border: '1px solid #e5dccf',
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
                  color: '#302f2e',
                }}
              >
                Reminders
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    flex: 'none',
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    background: '#fef3e9',
                    color: '#af5e19',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IoMedkitOutline style={{ fontSize: 15 }} aria-hidden="true" />
                </span>
                <span style={{ fontSize: 12.5, color: '#5c5956', flex: 1 }}>
                  Carprofen, this evening
                </span>
                <span
                  style={{ width: 18, height: 18, borderRadius: 9999, border: '2px solid #d6d1cd' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    flex: 'none',
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    background: '#e6f4ef',
                    color: '#006642',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IoShieldCheckmarkOutline style={{ fontSize: 15 }} aria-hidden="true" />
                </span>
                <span style={{ fontSize: 12.5, color: '#5c5956', flex: 1 }}>
                  Fjord, vaccine due in 9 days
                </span>
                <span
                  style={{ width: 18, height: 18, borderRadius: 9999, border: '2px solid #d6d1cd' }}
                />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                padding: '8px 6px 2px',
                borderTop: '1px solid #eae2d5',
              }}
            >
              <IoHome style={{ fontSize: 20, color: '#257bed' }} aria-hidden="true" />
              <IoCalendarOutline style={{ fontSize: 20, color: '#a9a39e' }} aria-hidden="true" />
              <IoChatbubbleOutline style={{ fontSize: 20, color: '#a9a39e' }} aria-hidden="true" />
              <IoPersonOutline style={{ fontSize: 20, color: '#a9a39e' }} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      <div
        data-hero-float="true"
        style={{
          position: 'absolute',
          top: '12%',
          left: -40,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 15px',
          borderRadius: 16,
          background: 'rgba(239,232,220,0.93)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(239,232,220,0.94)',
          boxShadow: '0 16px 44px rgba(29,28,27,0.12)',
          animation: 'ycFloatA 7s ease-in-out infinite',
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9999,
            background: '#e6f2ff',
            color: '#257bed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          SW
        </span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#302f2e' }}>Dr. Weber</div>
          <div style={{ fontSize: 11, color: '#8f8984' }}>Bloodwork came back clear</div>
        </div>
      </div>
      <div
        data-hero-float="true"
        style={{
          position: 'absolute',
          bottom: '14%',
          right: -34,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 15px',
          borderRadius: 16,
          background: 'rgba(239,232,220,0.93)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(239,232,220,0.94)',
          boxShadow: '0 16px 44px rgba(29,28,27,0.12)',
          animation: 'ycFloatB 8.5s ease-in-out 1s infinite',
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: '#e6f4ef',
            color: '#006642',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IoShareOutline style={{ fontSize: 15 }} aria-hidden="true" />
        </span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#302f2e' }}>
            Sent to the new clinic
          </div>
          <div style={{ fontSize: 11, color: '#8f8984' }}>One tap, whole history</div>
        </div>
      </div>
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

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #efe8dc 0%, #efe8dc 55%, #eae2d5 100%)',
        padding: '140px 24px 90px',
      }}
    >
      <HeroVideo src={HERO_VIDEOS.petParents} />
      <div
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
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -140,
          right: 'calc(50% - 640px)',
          width: 820,
          height: 580,
          background: 'radial-gradient(closest-side, rgba(244,121,190,0.10), transparent 70%)',
          pointerEvents: 'none',
          animation: 'ycDrift 32s ease-in-out infinite alternate',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -200,
          left: -120,
          width: 720,
          height: 540,
          background: 'radial-gradient(closest-side, rgba(37,123,237,0.08), transparent 70%)',
          pointerEvents: 'none',
          animation: 'ycDrift 40s ease-in-out 3s infinite alternate-reverse',
        }}
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
              color: '#1d1c1b',
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
                    color: '#ff90d4',
                    opacity: 0,
                    animation: `ycWord 1.1s ${EASE} ${word.delay} both`,
                  }}
                >
                  {word.text}
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
              color: '#423f3c',
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
              style={appBadgeStyle}
            >
              <IoLogoApple style={{ fontSize: 26 }} aria-hidden="true" />
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                <span style={{ fontSize: 10, letterSpacing: '0.02em', color: '#a9a39e' }}>
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
              style={appBadgeStyle}
            >
              <IoLogoGooglePlaystore style={{ fontSize: 23 }} aria-hidden="true" />
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                <span style={{ fontSize: 10, letterSpacing: '0.02em', color: '#a9a39e' }}>
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
  background: '#1d1c1b',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: 16,
  boxShadow: '0 10px 26px rgba(29,28,27,0.16)',
  transition: 'background 200ms, transform 200ms',
};

/* ---------- Story (dark) ---------- */

function Story() {
  return (
    <Spotlight style={{ position: 'relative', background: '#1d1c1b', overflow: 'hidden' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -220,
          left: -160,
          width: 780,
          height: 600,
          background: 'radial-gradient(closest-side, rgba(244,121,190,0.12), transparent 70%)',
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
        background: '#eae2d5',
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
          background: '#f7f3ec',
          color: '#257bed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon style={{ fontSize: 22 }} aria-hidden="true" />
      </span>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', color: '#1d1c1b' }}>
        {feature.title}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: '#5c5956', letterSpacing: '-0.01em' }}>
        {feature.body}
      </div>
    </Reveal>
  );
}

function Features() {
  return (
    <section style={{ background: '#efe8dc' }}>
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
              color: '#257bed',
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
              color: '#1d1c1b',
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
    <section style={{ position: 'relative', background: '#eae2d5', overflow: 'hidden' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 900,
          height: 500,
          background: 'radial-gradient(closest-side, rgba(244,121,190,0.08), transparent 70%)',
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
              color: '#1d1c1b',
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
              color: '#5c5956',
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
                boxShadow: '0 10px 30px rgba(29,28,27,0.18)',
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
                background: '#f7f3ec',
                color: '#302f2e',
                fontSize: 17,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                padding: '16px 32px',
                borderRadius: 9999,
                border: '1px solid #e5dccf',
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
