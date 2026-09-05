'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  IoLogoGithub,
  IoArrowForwardOutline,
  IoPulseOutline,
  IoGitCommitOutline,
  IoPricetagOutline,
  IoCodeSlashOutline,
  IoStatsChartOutline,
  IoPeopleOutline,
  IoEyeOutline,
  IoLockClosedOutline,
  IoGitBranchOutline,
  IoGitNetworkOutline,
  IoAlertCircleOutline,
  IoDocumentTextOutline,
  IoTimeOutline,
} from 'react-icons/io5';
import {
  Reveal,
  Spotlight,
  HeroGlow,
  CountUp,
  InkAnnotate,
  GITHUB_REPO_URL,
  useGithubStats,
  useLatestRelease,
  useRepoInsights,
  type RepoLanguage,
  type RepoCommit,
  type RepoContributor,
  type RepoFacts,
} from '@/app/features/marketing/site';

const SERIF = 'var(--font-newsreader)';
const REPO_COMMITS_URL = `${GITHUB_REPO_URL}/commits`;
const REPO_RELEASES_URL = `${GITHUB_REPO_URL}/releases/latest`;

/* ---------- shared bits ---------- */

const LIVE_DOT_STYLE: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 9999,
  background: 'var(--success)',
  animation: 'ycLive 2.6s ease-out infinite',
};

const CARD_STYLE: CSSProperties = {
  background: 'var(--screen)',
  border: '1px solid var(--hairline)',
  borderRadius: 22,
  padding: 'clamp(24px, 3vw, 32px)',
  boxShadow: '0 1px 3px var(--sh05)',
};

const CARD_ICON_STYLE: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  background: 'var(--inset)',
  color: 'var(--blue-text)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
};

const CTA_PRIMARY_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: 'var(--cta)',
  color: 'var(--cta-text)',
  fontSize: 17,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '16px 30px',
  borderRadius: 9999,
  boxShadow: '0 10px 30px var(--sh18)',
};

const CTA_GHOST_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: 'var(--glass-95)',
  color: 'var(--ink-body)',
  fontSize: 17,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '16px 30px',
  borderRadius: 9999,
  border: '1px solid var(--hairline)',
};

const EYEBROW_STYLE: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-faint)',
};

const CARD_HEADING_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: 'var(--ink)',
};

const LIVE_TAG_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--success)',
};

function LiveTag() {
  return (
    <span style={LIVE_TAG_STYLE}>
      <span style={LIVE_DOT_STYLE} />
      {'Live'}
    </span>
  );
}

/* ---------- hero + live console ---------- */

function Heartbeat({ weeks }: Readonly<{ weeks: number[] | null }>) {
  if (!weeks || weeks.length === 0) {
    return (
      <div style={{ margin: 'auto', fontSize: 12.5, color: '#6b6155' }}>
        Reading the repository...
      </div>
    );
  }
  const max = Math.max(1, ...weeks);
  return (
    <>
      {weeks.map((value, index) => {
        const height = Math.max(5, Math.round((value / max) * 100));
        const isLast = index === weeks.length - 1;
        return (
          <span
            key={`${index}-${value}`}
            style={{
              flex: 1,
              minWidth: 2,
              height: `${height}%`,
              borderRadius: '2px 2px 1px 1px',
              background: 'linear-gradient(180deg,#5ce1e6,#257bed)',
              transformOrigin: 'bottom',
              animation: isLast ? 'ycBeat 1.8s ease-in-out infinite' : undefined,
            }}
          />
        );
      })}
    </>
  );
}

function MiniStat({ value, label }: Readonly<{ value: string; label: string }>) {
  return (
    <div>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: '-0.03em',
          color: '#f4efe6',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, letterSpacing: '-0.01em', color: '#8a8074', marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

const CONSOLE_LIVE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#6cd6a3',
};

const CONSOLE_COMMIT_BOX_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  marginTop: 18,
  padding: '12px 14px',
  borderRadius: 13,
  background: '#232120',
  border: '1px solid #302f2e',
};

const CONSOLE_FLOAT_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: -20,
  left: -28,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '11px 15px',
  borderRadius: 16,
  background: 'var(--glass-95)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  border: '1px solid var(--glass-95)',
  boxShadow: '0 16px 44px var(--sh12)',
  animation: 'ycFloatB 8s ease-in-out infinite',
};

const CONSOLE_FLOAT_ICON_STYLE: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 10,
  background: 'var(--blue-soft)',
  color: 'var(--blue-text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function ConsoleHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '15px 20px',
        borderBottom: '1px solid #302f2e',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 12.5,
          color: '#d6d1cd',
        }}
      >
        <IoLogoGithub style={{ fontSize: 15, color: '#8a8074' }} aria-hidden="true" />
        YosemiteCrew / Yosemite-Crew
      </span>
      <span style={CONSOLE_LIVE_STYLE}>
        <span style={{ ...LIVE_DOT_STYLE, background: '#2bbd86' }} />
        {'Live'}
      </span>
    </div>
  );
}

function ConsoleHeartbeatPanel({ weeks }: Readonly<{ weeks: number[] | null }>) {
  return (
    <>
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
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#8a8074',
          }}
        >
          Commit activity
        </span>
        <span style={{ fontSize: 12, letterSpacing: '-0.01em', color: '#6b6155' }}>52 weeks</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 66 }}>
        <Heartbeat weeks={weeks} />
      </div>
    </>
  );
}

function ConsoleMiniStats({
  stars,
  forks,
  contributors,
}: Readonly<{ stars: string | null; forks: string | null; contributors: string | null }>) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginTop: 22,
        paddingTop: 20,
        borderTop: '1px solid #302f2e',
      }}
    >
      <MiniStat value={stars ?? '—'} label="Stars" />
      <MiniStat value={forks ?? '—'} label="Forks" />
      <MiniStat value={contributors ?? '—'} label="Contributors" />
    </div>
  );
}

function ConsoleLastCommit({ lastCommit }: Readonly<{ lastCommit: RepoCommit | undefined }>) {
  return (
    <div style={CONSOLE_COMMIT_BOX_STYLE}>
      <IoGitCommitOutline
        style={{ fontSize: 16, color: '#5ce1e6', flex: 'none' }}
        aria-hidden="true"
      />
      <span
        style={{
          fontSize: 12.5,
          letterSpacing: '-0.01em',
          color: '#a89e90',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {lastCommit
          ? `${lastCommit.message}  ·  ${lastCommit.when}`
          : 'Fetching the latest commit...'}
      </span>
    </div>
  );
}

function ConsoleFloatBadge() {
  return (
    <div data-hero-float="true" style={CONSOLE_FLOAT_STYLE}>
      <span style={CONSOLE_FLOAT_ICON_STYLE}>
        <IoPulseOutline style={{ fontSize: 16 }} aria-hidden="true" />
      </span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-body)' }}>No cache</div>
        <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Pulled on every visit</div>
      </div>
    </div>
  );
}

function LiveConsole() {
  // Live (uncached) read: this console's copy promises no cache / every visit.
  const stats = useGithubStats({ live: true });
  const repo = useRepoInsights();
  const lastCommit = repo.commits?.[0];
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          background: 'var(--spot)',
          borderRadius: 22,
          boxShadow: '0 30px 80px var(--sh22)',
          overflow: 'hidden',
        }}
      >
        <ConsoleHeader />
        <div style={{ padding: '22px 22px 24px' }}>
          <ConsoleHeartbeatPanel weeks={repo.heartbeat} />
          <ConsoleMiniStats
            stars={stats.stars}
            forks={repo.forks}
            contributors={stats.contributors}
          />
          <ConsoleLastCommit lastCommit={lastCommit} />
        </div>
      </div>
      <ConsoleFloatBadge />
    </div>
  );
}

const HERO_HEADING_STYLE: CSSProperties = {
  margin: '24px 0 0',
  fontFamily: SERIF,
  fontSize: 'clamp(40px, 5.2vw, 78px)',
  fontWeight: 500,
  lineHeight: 1.03,
  letterSpacing: '-0.06em',
  color: 'var(--ink)',
  textWrap: 'balance',
};

const HERO_GRID_STYLE: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1200px, 100%)',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: '1.02fr 0.98fr',
  gap: 'clamp(36px, 5vw, 76px)',
  alignItems: 'center',
};

const HERO_BADGE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  borderRadius: 9999,
  border: '1px solid var(--hairline)',
  background: 'var(--glass-95)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  color: 'var(--ink-muted)',
};

function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, var(--page) 0%, var(--page) 62%, var(--band) 100%)',
        padding: '150px 24px 96px',
      }}
    >
      <HeroGlow
        color="var(--glow-b10)"
        scrollSpeed="-0.05"
        box={{ top: -170, left: 'calc(50% - 640px)', width: 880, height: 620 }}
        animation="ycDrift 30s ease-in-out infinite alternate"
      />
      <HeroGlow
        color="var(--glow-c09)"
        scrollSpeed="0.04"
        box={{ bottom: -220, right: -150, width: 720, height: 540 }}
        animation="ycDrift 38s ease-in-out 3s infinite alternate-reverse"
      />
      <div data-grid-1-m="true" style={HERO_GRID_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={HERO_BADGE_STYLE}>
            <span style={LIVE_DOT_STYLE} />
            {'Building in public'}
            <span style={{ width: 1, height: 12, background: 'var(--divider)', margin: '0 3px' }} />
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Updated live</span>
          </div>
          <h1 style={HERO_HEADING_STYLE}>
            We build in the open.{' '}
            <em
              style={{
                display: 'inline-block',
                fontStyle: 'italic',
                fontWeight: 480,
                color: 'var(--blue-text)',
              }}
            >
              <InkAnnotate type="underline" delay={1200}>
                Numbers included.
              </InkAnnotate>
            </em>
          </h1>
          <p
            style={{
              margin: '26px 0 0',
              maxWidth: 520,
              fontSize: 'clamp(17px, 2vw, 20px)',
              lineHeight: 1.6,
              letterSpacing: '-0.025em',
              color: 'var(--ink-muted)',
              textWrap: 'pretty',
            }}
          >
            Most companies keep their numbers private. We publish ours: every clone, contributor and
            commit. Public numbers keep us honest, and the open in open source was never meant to
            stop at the code.
          </p>
          <div
            data-stack-m="true"
            style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 34 }}
          >
            <Link href="/signup" style={CTA_PRIMARY_STYLE}>
              Create free account{' '}
              <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
            </Link>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={CTA_GHOST_STYLE}
            >
              <IoLogoGithub style={{ fontSize: 18 }} aria-hidden="true" /> View the repo
            </a>
          </div>
        </div>
        <LiveConsole />
      </div>
    </section>
  );
}

/* ---------- live four-stat band ---------- */

interface BandStat {
  key: string;
  value: string | null;
  label: string;
  desc: string;
  accent: boolean;
  delay: number;
}

function StatCell({ stat }: Readonly<{ stat: BandStat }>) {
  return (
    <Reveal
      delay={stat.delay}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        borderLeft: `2px solid ${stat.accent ? 'var(--blue)' : 'var(--divider)'}`,
        paddingLeft: 22,
      }}
    >
      <CountUp
        value={stat.value ?? '—'}
        style={{
          fontFamily: SERIF,
          fontSize: 'clamp(46px, 6vw, 82px)',
          fontWeight: 500,
          lineHeight: 0.9,
          letterSpacing: '-0.04em',
          color: 'var(--ink)',
        }}
      />
      <span
        style={{
          marginTop: 8,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ink-body)',
        }}
      >
        {stat.label}
      </span>
      <span
        style={{
          fontSize: 13.5,
          lineHeight: 1.5,
          letterSpacing: '-0.01em',
          color: 'var(--ink-faint)',
        }}
      >
        {stat.desc}
      </span>
    </Reveal>
  );
}

function StatBand() {
  // Live (uncached) read: the band eyebrow reads "The numbers, right now".
  const stats = useGithubStats({ live: true });
  const cells: BandStat[] = [
    {
      key: 'repositoryClones',
      value: stats.repositoryClones,
      label: 'Repository clones',
      desc: 'Clone events from GitHub traffic. Not installs, not people.',
      accent: true,
      delay: 0,
    },
    {
      key: 'contributors',
      value: stats.contributors,
      label: 'Contributors',
      desc: 'Accounts credited with commits, bots excluded.',
      accent: false,
      delay: 90,
    },
    {
      key: 'discord',
      value: stats.discord,
      label: 'Discord members',
      desc: 'Builders and pet pros in the community.',
      accent: false,
      delay: 180,
    },
    {
      key: 'stars',
      value: stats.starsFull,
      label: 'GitHub stars',
      desc: 'Developers who bookmarked the project.',
      accent: false,
      delay: 270,
    },
  ];
  return (
    <section
      style={{
        background: 'var(--band)',
        borderTop: '1px solid var(--hairline)',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(64px, 8vw, 104px) 0',
        }}
      >
        <Reveal
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 'clamp(36px, 5vw, 56px)',
          }}
        >
          <span style={EYEBROW_STYLE}>The numbers, right now</span>
          <span style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
          <LiveTag />
        </Reveal>
        <div
          data-grid-2-m="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'clamp(24px, 3vw, 44px)',
          }}
        >
          {cells.map((stat) => (
            <StatCell key={stat.key} stat={stat} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- manifesto ---------- */

const MANIFESTO_LINE_STYLE: CSSProperties = {
  display: 'block',
  margin: '30px 0 0',
  fontSize: 'clamp(24px, 3.4vw, 42px)',
  fontWeight: 500,
  lineHeight: 1.34,
  letterSpacing: '-0.035em',
  color: '#eae2d5',
  textWrap: 'pretty',
};

function Manifesto() {
  return (
    <Spotlight style={{ position: 'static' }}>
      <section style={{ position: 'relative', background: 'var(--spot)', overflow: 'hidden' }}>
        <HeroGlow
          color="var(--glow-b13)"
          parallax={false}
          box={{ top: -220, right: -160, width: 780, height: 600 }}
        />
        <div
          style={{
            width: 'min(980px, calc(100% - 48px))',
            margin: '0 auto',
            padding: 'clamp(88px, 12vw, 160px) 0',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Reveal style={EYEBROW_STYLE}>Why we publish</Reveal>
          <Reveal as="span" delay={100} style={MANIFESTO_LINE_STYLE}>
            What you measure is what you actually care about. So we measure in public, the good
            months and the messy ones, because hiding a number only delays the fix and quietly picks
            who gets to see the truth.{' '}
            <span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#5ce1e6',
              }}
            >
              If you build in the open, it should not stop at the code.
            </span>
          </Reveal>
        </div>
      </section>
    </Spotlight>
  );
}

/* ---------- repository pulse ---------- */

function LanguagesCard({ languages }: Readonly<{ languages: RepoLanguage[] | null }>) {
  return (
    <Reveal style={CARD_STYLE}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <span style={CARD_HEADING_STYLE}>
          <span style={CARD_ICON_STYLE}>
            <IoCodeSlashOutline style={{ fontSize: 17 }} aria-hidden="true" />
          </span>
          {'What it is written in'}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 16,
          borderRadius: 9999,
          overflow: 'hidden',
          background: 'var(--inset)',
        }}
      >
        {languages ? (
          languages.map((lang) => (
            <span
              key={lang.name}
              title={lang.name}
              style={{ width: `${lang.pct.toFixed(2)}%`, background: lang.color }}
            />
          ))
        ) : (
          <span style={{ flex: 1, background: 'var(--divider)', opacity: 0.5 }} />
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 20 }}>
        {languages ? (
          languages.map((lang) => (
            <span
              key={lang.name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 13,
                letterSpacing: '-0.01em',
                color: 'var(--ink-muted)',
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 9999, background: lang.color }} />
              {lang.name} <span style={{ color: 'var(--ink-faint)' }}>{lang.pct.toFixed(1)}%</span>
            </span>
          ))
        ) : (
          <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Reading languages...</span>
        )}
      </div>
    </Reveal>
  );
}

const RELEASE_CARD_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 20,
  flex: 1,
  minWidth: 0,
  background: 'var(--spot)',
  borderRadius: 22,
  padding: 'clamp(24px, 3vw, 32px)',
  boxShadow: '0 20px 50px var(--sh16)',
  overflow: 'hidden',
  position: 'relative',
};

const RELEASE_LABEL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#8a8074',
};

function LatestReleaseCard() {
  // Live (uncached) read: this card sits under the "nothing is cached" copy.
  const release = useLatestRelease({ live: true });
  return (
    <Reveal delay={120} style={{ display: 'flex' }}>
      <a
        href={release.url ?? REPO_RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={RELEASE_CARD_STYLE}
      >
        <HeroGlow
          color="var(--glow-b20)"
          parallax={false}
          box={{ top: -90, right: -70, width: 300, height: 300 }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={RELEASE_LABEL_STYLE}>
            <IoPricetagOutline style={{ fontSize: 15, color: '#5ce1e6' }} aria-hidden="true" />
            Latest release
          </span>
          <IoArrowForwardOutline style={{ fontSize: 16, color: '#8a8074' }} aria-hidden="true" />
        </div>
        <div style={{ position: 'relative' }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 'clamp(30px, 4vw, 44px)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              color: '#f4efe6',
            }}
          >
            {release.tag ?? 'Loading...'}
          </div>
          <div style={{ marginTop: 8, fontSize: 13.5, letterSpacing: '-0.01em', color: '#a89e90' }}>
            {release.date
              ? `Published ${release.date} on GitHub Releases.`
              : 'Tagged and published on GitHub Releases.'}
          </div>
        </div>
      </a>
    </Reveal>
  );
}

const COMMIT_AVATAR_STYLE: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 9999,
  flex: 'none',
  background: 'var(--inset)',
  color: 'var(--ink-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
};

const COMMIT_MESSAGE_STYLE: CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: '-0.015em',
  color: 'var(--ink)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function CommitRow({ commit, isLast }: Readonly<{ commit: RepoCommit; isLast: boolean }>) {
  return (
    <a
      href={commit.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '13px 0',
        textDecoration: 'none',
        borderBottom: isLast ? undefined : '1px solid var(--hairline)',
      }}
    >
      {commit.avatar ? (
        <Image
          src={commit.avatar}
          alt=""
          width={26}
          height={26}
          style={{ borderRadius: 9999, flex: 'none', objectFit: 'cover' }}
        />
      ) : (
        <span style={COMMIT_AVATAR_STYLE}>{commit.login.slice(0, 1).toUpperCase()}</span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={COMMIT_MESSAGE_STYLE}>{commit.message}</span>
        <span
          style={{
            display: 'block',
            fontSize: 12.5,
            letterSpacing: '-0.01em',
            color: 'var(--ink-faint)',
            marginTop: 2,
          }}
        >
          {commit.login} · {commit.when}
        </span>
      </span>
      <span
        style={{
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 12,
          color: 'var(--ink-faint)',
          background: 'var(--inset)',
          padding: '4px 9px',
          borderRadius: 7,
          flex: 'none',
        }}
      >
        {commit.sha}
      </span>
    </a>
  );
}

/**
 * The sha identifies the row, but `parseCommits` hands back `''` when GitHub
 * omits one, so fall back to the rest of the row's content rather than to its
 * position - the list is replaced wholesale when the fetch resolves.
 */
const commitKey = (commit: RepoCommit) =>
  commit.sha || `${commit.url}|${commit.when}|${commit.message}`;

function CommitsCard({ commits }: Readonly<{ commits: RepoCommit[] | null }>) {
  return (
    <Reveal style={CARD_STYLE}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <span style={CARD_HEADING_STYLE}>
          <span style={CARD_ICON_STYLE}>
            <IoGitCommitOutline style={{ fontSize: 17 }} aria-hidden="true" />
          </span>
          {'Latest commits'}
        </span>
        <a
          href={REPO_COMMITS_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: 'var(--blue-text)',
            textDecoration: 'none',
          }}
        >
          History
        </a>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {commits ? (
          commits.map((commit, index) => (
            <CommitRow
              key={commitKey(commit)}
              commit={commit}
              isLast={index === commits.length - 1}
            />
          ))
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '8px 0' }}>
            Reading recent commits...
          </div>
        )}
      </div>
    </Reveal>
  );
}

const FACT_ROWS: ReadonlyArray<{ icon: ReactNode; label: string; key: keyof RepoFacts }> = [
  {
    icon: <IoGitNetworkOutline style={{ fontSize: 16 }} aria-hidden="true" />,
    label: 'Forks',
    key: 'forks',
  },
  {
    icon: <IoAlertCircleOutline style={{ fontSize: 16 }} aria-hidden="true" />,
    label: 'Open issues & PRs',
    key: 'issues',
  },
  {
    icon: <IoEyeOutline style={{ fontSize: 16 }} aria-hidden="true" />,
    label: 'Watching',
    key: 'watching',
  },
  {
    icon: <IoDocumentTextOutline style={{ fontSize: 16 }} aria-hidden="true" />,
    label: 'License',
    key: 'license',
  },
  {
    icon: <IoTimeOutline style={{ fontSize: 16 }} aria-hidden="true" />,
    label: 'Last push',
    key: 'lastPush',
  },
];

function RepoFactsCard({ facts }: Readonly<{ facts: RepoFacts | null }>) {
  return (
    <div style={{ ...CARD_STYLE, padding: 'clamp(24px, 3vw, 30px)' }}>
      <span style={{ ...CARD_HEADING_STYLE, marginBottom: 16 }}>
        <span style={CARD_ICON_STYLE}>
          <IoStatsChartOutline style={{ fontSize: 17 }} aria-hidden="true" />
        </span>
        {'Repository facts'}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 16 }}>
        {facts ? (
          FACT_ROWS.map((row, index) => (
            <div
              key={row.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '11px 0',
                borderBottom:
                  index < FACT_ROWS.length - 1 ? '1px solid var(--hairline)' : undefined,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 14,
                  letterSpacing: '-0.01em',
                  color: 'var(--ink-muted)',
                }}
              >
                <span style={{ color: 'var(--ink-faint)', display: 'inline-flex' }}>
                  {row.icon}
                </span>
                {row.label}
              </span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--ink)',
                }}
              >
                {facts[row.key]}
              </span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '6px 0' }}>
            Reading repository...
          </div>
        )}
      </div>
    </div>
  );
}

function ContributorsCard({ contributors }: Readonly<{ contributors: RepoContributor[] | null }>) {
  return (
    <div style={{ ...CARD_STYLE, padding: 'clamp(24px, 3vw, 30px)' }}>
      <span style={CARD_HEADING_STYLE}>
        <span style={CARD_ICON_STYLE}>
          <IoPeopleOutline style={{ fontSize: 17 }} aria-hidden="true" />
        </span>
        {'The people'}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 18 }}>
        {contributors ? (
          contributors.map((person) => (
            <a
              key={person.login}
              href={person.url}
              target="_blank"
              rel="noopener noreferrer"
              title={person.login}
              style={{
                display: 'block',
                width: 38,
                height: 38,
                borderRadius: 9999,
                overflow: 'hidden',
                border: '2px solid var(--screen)',
                boxShadow: '0 0 0 1px var(--hairline)',
              }}
            >
              <Image
                src={person.avatar}
                alt={person.login}
                width={38}
                height={38}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </a>
          ))
        ) : (
          <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Loading contributors...</span>
        )}
      </div>
      <p
        style={{
          margin: '16px 0 0',
          fontSize: 13.5,
          lineHeight: 1.55,
          letterSpacing: '-0.01em',
          color: 'var(--ink-muted)',
        }}
      >
        Every avatar is a real person who has merged work into Yosemite Crew.
      </p>
    </div>
  );
}

const PULSE_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.15fr 0.85fr',
  gap: 20,
};

const PULSE_HEADING_STYLE: CSSProperties = {
  margin: '22px 0 0',
  fontFamily: SERIF,
  fontSize: 'clamp(30px, 4vw, 52px)',
  fontWeight: 500,
  lineHeight: 1.08,
  letterSpacing: '-0.05em',
  color: 'var(--ink)',
  textWrap: 'balance',
};

function RepositoryPulse() {
  const repo = useRepoInsights();
  return (
    <section style={{ background: 'var(--page)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
        }}
      >
        <Reveal style={{ maxWidth: 760 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--blue-text)',
            }}
          >
            Live from GitHub
          </span>
          <h2 style={PULSE_HEADING_STYLE}>The repository, in real time.</h2>
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
            Everything below is read straight from the public repo the moment this page loads.
            Nothing is curated, nothing is cached. If a commit landed an hour ago, it is here.
          </p>
        </Reveal>

        <div
          data-grid-1-m="true"
          style={{ ...PULSE_GRID_STYLE, marginTop: 'clamp(40px, 5vw, 60px)' }}
        >
          <LanguagesCard languages={repo.languages} />
          <LatestReleaseCard />
        </div>

        <div data-grid-1-m="true" style={{ ...PULSE_GRID_STYLE, marginTop: 20 }}>
          <CommitsCard commits={repo.commits} />
          <Reveal delay={120} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <RepoFactsCard facts={repo.facts} />
            <ContributorsCard contributors={repo.contributors} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- principles ---------- */

interface Principle {
  icon: ReactNode;
  title: string;
  body: string;
  delay: number;
}

const PRINCIPLES: readonly Principle[] = [
  {
    icon: <IoEyeOutline style={{ fontSize: 22 }} aria-hidden="true" />,
    title: 'Honest by default',
    body: 'A number anyone can check is a number you cannot quietly massage. Publishing removes the temptation to round up in our own favour.',
    delay: 0,
  },
  {
    icon: <IoLockClosedOutline style={{ fontSize: 22 }} aria-hidden="true" />,
    title: 'Sovereignty first',
    body: "We share totals, never records. Every figure here comes from the public repository and the community, and none of it from a clinic's data or a pet parent's account.",
    delay: 90,
  },
  {
    icon: <IoGitBranchOutline style={{ fontSize: 22 }} aria-hidden="true" />,
    title: 'Open all the way down',
    body: 'The code is AGPL-3.0 and the metrics sit right beside it. Read the source, then read the numbers the source produced. Same repo, same truth.',
    delay: 180,
  },
];

const PRINCIPLE_ICON_STYLE: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 13,
  background: 'var(--blue-soft)',
  color: 'var(--blue-text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 18,
};

const PRINCIPLES_HEADING_STYLE: CSSProperties = {
  margin: '22px 0 0',
  fontFamily: SERIF,
  fontSize: 'clamp(30px, 4vw, 50px)',
  fontWeight: 500,
  lineHeight: 1.1,
  letterSpacing: '-0.05em',
  color: 'var(--ink)',
  textWrap: 'balance',
};

function PrincipleCard({ principle }: Readonly<{ principle: Principle }>) {
  return (
    <Reveal
      delay={principle.delay}
      style={{
        background: 'var(--screen)',
        border: '1px solid var(--hairline)',
        borderRadius: 22,
        padding: 30,
      }}
    >
      <span style={PRINCIPLE_ICON_STYLE}>{principle.icon}</span>
      <h3
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: 'var(--ink)',
        }}
      >
        {principle.title}
      </h3>
      <p
        style={{
          margin: '10px 0 0',
          fontSize: 15,
          lineHeight: 1.6,
          letterSpacing: '-0.015em',
          color: 'var(--ink-muted)',
          textWrap: 'pretty',
        }}
      >
        {principle.body}
      </p>
    </Reveal>
  );
}

function Principles() {
  return (
    <section style={{ background: 'var(--inset)', borderTop: '1px solid var(--hairline)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
        }}
      >
        <Reveal style={{ maxWidth: 720 }}>
          <span style={EYEBROW_STYLE}>What the numbers stand for</span>
          <h2 style={PRINCIPLES_HEADING_STYLE}>Transparency is a habit, not a page.</h2>
        </Reveal>
        <div
          data-grid-1-m="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            marginTop: 'clamp(40px, 5vw, 60px)',
          }}
        >
          {PRINCIPLES.map((principle) => (
            <PrincipleCard key={principle.title} principle={principle} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- final CTA ---------- */

const FINAL_CTA_WRAP_STYLE: CSSProperties = {
  width: 'min(880px, calc(100% - 48px))',
  margin: '0 auto',
  padding: 'clamp(88px, 12vw, 150px) 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  position: 'relative',
};

const FINAL_CTA_HEADING_STYLE: CSSProperties = {
  margin: 0,
  fontFamily: SERIF,
  fontSize: 'clamp(36px, 5.2vw, 66px)',
  fontWeight: 500,
  lineHeight: 1.06,
  letterSpacing: '-0.055em',
  color: '#eae2d5',
  textWrap: 'balance',
};

const FINAL_CTA_LEAD_STYLE: CSSProperties = {
  display: 'block',
  margin: '22px 0 0',
  maxWidth: 560,
  fontSize: 18,
  lineHeight: 1.65,
  letterSpacing: '-0.02em',
  color: 'var(--ink-faint2)',
  textWrap: 'pretty',
};

const FINAL_CTA_GHOST_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: 'transparent',
  color: '#eae2d5',
  fontSize: 17,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '16px 32px',
  borderRadius: 9999,
  border: '1px solid #454341',
};

function FinalCta() {
  return (
    <Spotlight style={{ position: 'static' }}>
      <section style={{ position: 'relative', background: 'var(--spot)', overflow: 'hidden' }}>
        <HeroGlow
          color="var(--glow-b14)"
          parallax={false}
          box={{
            top: '50%',
            left: '50%',
            width: 900,
            height: 500,
            transform: 'translate(-50%,-50%)',
          }}
        />
        <div style={FINAL_CTA_WRAP_STYLE}>
          <Reveal>
            <h2 style={FINAL_CTA_HEADING_STYLE}>
              Read the numbers.{' '}
              <span
                style={{
                  fontFamily: SERIF,
                  fontStyle: 'italic',
                  fontWeight: 500,
                  color: '#82afec',
                }}
              >
                Then read the code.
              </span>
            </h2>
          </Reveal>
          <Reveal as="span" delay={100} style={FINAL_CTA_LEAD_STYLE}>
            Same repository, nothing hidden behind it. Clone it, run it locally, and see for
            yourself what the numbers are made of.
          </Reveal>
          <Reveal
            delay={200}
            data-stack-m="true"
            style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 36 }}
          >
            <Link
              href="/signup"
              style={{
                ...CTA_PRIMARY_STYLE,
                background: 'var(--screen)',
                color: 'var(--ink)',
                boxShadow: 'none',
              }}
            >
              Create free account{' '}
              <IoArrowForwardOutline style={{ fontSize: 17 }} aria-hidden="true" />
            </Link>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={FINAL_CTA_GHOST_STYLE}
            >
              <IoLogoGithub style={{ fontSize: 18 }} aria-hidden="true" /> Star on GitHub
            </a>
          </Reveal>
        </div>
      </section>
    </Spotlight>
  );
}

export function Insights() {
  return (
    <>
      <Hero />
      <StatBand />
      <Manifesto />
      <RepositoryPulse />
      <Principles />
      <FinalCta />
    </>
  );
}
