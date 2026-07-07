'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  IoPricetagOutline,
  IoCheckmark,
  IoAddOutline,
  IoArrowForwardOutline,
} from 'react-icons/io5';
import { Reveal, Spotlight, HeroGlow, useMagnet } from '@/app/features/marketing/site';

const CURRENCY = '€';
const BUSINESS_MONTHLY = '12';
const BUSINESS_YEARLY = '10';

const SERIF = 'var(--font-newsreader)';

type FeatureItem = { label: string; dot: string };

const FREE_FEATURES: FeatureItem[] = [
  { label: '120 appointments', dot: 'var(--success)' },
  { label: '200 observational tools', dot: 'var(--success)' },
  { label: 'Scheduler, templates & e-signing', dot: 'var(--success)' },
  { label: 'IDEXX + MSD Veterinary Manual', dot: 'var(--success)' },
  { label: 'Community & Discord support', dot: 'var(--success)' },
];

const BUSINESS_FEATURES: FeatureItem[] = [
  { label: 'Unlimited appointments & tools', dot: '#54b492' },
  { label: 'Team, rooms & departments', dot: '#54b492' },
  { label: 'Billing, invoicing & Stripe payments', dot: '#54b492' },
  { label: 'Financial reporting & analytics', dot: '#54b492' },
  { label: 'Dedicated Discord support', dot: '#54b492' },
];

const ENTERPRISE_FEATURES: FeatureItem[] = [
  { label: 'Everything in Business', dot: 'var(--success)' },
  { label: 'Multiple availability zones', dot: 'var(--success)' },
  { label: 'Setup, maintenance & backups', dot: 'var(--success)' },
  { label: 'Uptime guarantee & SLAs', dot: 'var(--success)' },
  { label: 'Priority support', dot: 'var(--success)' },
];

type FaqEntry = { q: string; a: string; open?: boolean };

const FAQS: FaqEntry[] = [
  {
    q: 'Is it really free?',
    a: 'Yes. If you host it yourself, it costs nothing and always will. The whole product is open source under AGPL-3.0, so you get every feature with no trial clock and no seat you have to unlock later.',
    open: true,
  },
  {
    q: 'How does billing work?',
    a: "On the Business plan you pay per active user, either monthly or yearly, and paying yearly saves you two months. There's no setup fee and no long contract, so you can change plan or cancel whenever you need. The Free plan stays free, and self-hosting is free without limits.",
  },
  {
    q: 'Do you take a cut of my payments?',
    a: 'No. When a pet parent pays you, the money goes to you, and their statement shows your clinic. We never sit in the middle of your payments and skim a percentage. Hosting is the only thing you ever pay us for.',
  },
  {
    q: 'Can I leave and take my data?',
    a: 'Any time, with all of it. Every record, invoice and note exports in a standard format, and because it is open source you can move to your own server and keep running the exact same software. Leaving is free by design.',
  },
  {
    q: 'Where does my data live?',
    a: 'In the country you practice in. Self-host and it sits on your hardware; choose Managed and we keep it in your region, under laws you actually agreed to, instead of wherever cheap servers happened to have room.',
  },
];

const HERO_WORDS = ['Host', 'it', 'free.', 'Or', 'pay', 'as', 'you'];

function FeatureRow({ item, color }: Readonly<{ item: FeatureItem; color: string }>) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        fontSize: '14.5px',
        color,
        letterSpacing: '-0.01em',
      }}
    >
      <IoCheckmark aria-hidden="true" style={{ fontSize: '18px', color: item.dot, flex: 'none' }} />
      {item.label}
    </div>
  );
}

function PlanBadgeHeader({
  label,
  labelColor,
  badge,
  badgeColor,
  badgeBg,
}: Readonly<{
  label: string;
  labelColor: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
}>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: labelColor,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: badgeColor,
          background: badgeBg,
          padding: '5px 11px',
          borderRadius: '9999px',
        }}
      >
        {badge}
      </span>
    </div>
  );
}

function PlanFeatureList({
  features,
  color,
  divider,
}: Readonly<{ features: FeatureItem[]; color: string; divider: string }>) {
  return (
    <>
      <div style={{ height: '1px', background: divider, margin: '24px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {features.map((item) => (
          <FeatureRow key={item.label} item={item} color={color} />
        ))}
      </div>
    </>
  );
}

function BillingToggle({
  yearly,
  onSelect,
}: Readonly<{ yearly: boolean; onSelect: (v: boolean) => void }>) {
  const btnStyle = (active: boolean): React.CSSProperties => ({
    cursor: 'pointer',
    fontFamily: 'inherit',
    border: 'none',
    borderRadius: '9999px',
    padding: '9px 22px',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    transition: 'color 200ms, background 200ms',
    background: active ? '#1d1c1b' : 'transparent',
    color: active ? '#f7f3ec' : 'var(--ink-muted)',
  });

  return (
    <Reveal
      delay={0}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        marginBottom: 'clamp(36px, 4vw, 52px)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '5px',
          background: 'var(--screen)',
          border: '1px solid var(--hairline)',
          borderRadius: '9999px',
        }}
      >
        <button type="button" onClick={() => onSelect(false)} style={btnStyle(!yearly)}>
          Monthly
        </button>
        <button type="button" onClick={() => onSelect(true)} style={btnStyle(yearly)}>
          Yearly
        </button>
      </div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--blue-text)',
        }}
      >
        <IoPricetagOutline aria-hidden="true" style={{ fontSize: '14px' }} />
        Save 2 months billing yearly
      </div>
    </Reveal>
  );
}

function FreePlanCard() {
  const btnRef = useMagnet<HTMLAnchorElement>();
  return (
    <Reveal
      delay={0}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--screen)',
        border: '1px solid var(--hairline)',
        borderRadius: '28px',
        padding: '32px',
      }}
    >
      <div
        style={{
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}
      >
        Free
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '20px 0 4px' }}>
        <span
          style={{
            fontSize: '52px',
            fontWeight: 500,
            letterSpacing: '-0.05em',
            color: 'var(--ink)',
          }}
        >
          {CURRENCY}0
        </span>
        <span style={{ fontSize: '16px', color: 'var(--ink-faint)' }}>forever</span>
      </div>
      <p
        style={{
          margin: '0 0 22px',
          fontSize: '15px',
          lineHeight: 1.55,
          letterSpacing: '-0.01em',
          color: 'var(--ink-muted)',
        }}
      >
        For a new or small practice finding its feet, on us.
      </p>
      <Link
        ref={btnRef}
        href="/signup"
        data-btn-invert
        style={{
          textDecoration: 'none',
          textAlign: 'center',
          background: 'var(--screen)',
          color: 'var(--ink-body)',
          fontSize: '15px',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          padding: '13px 22px',
          borderRadius: '9999px',
          border: '1px solid var(--divider)',
          transition: 'border-color 200ms, background 200ms',
        }}
      >
        Get started free
      </Link>
      <PlanFeatureList features={FREE_FEATURES} color="var(--ink-muted)" divider="var(--inset)" />
    </Reveal>
  );
}

function BusinessPlanCard({ price, period }: Readonly<{ price: string; period: string }>) {
  const btnRef = useMagnet<HTMLAnchorElement>();
  return (
    <Reveal
      delay={100}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--spot)',
        border: '1px solid var(--spot)',
        borderRadius: '28px',
        padding: '32px',
        boxShadow: '0 30px 70px var(--sh22)',
        position: 'relative',
        transform: 'translateY(-8px)',
      }}
    >
      <PlanBadgeHeader
        label="Business"
        labelColor="#82afec"
        badge="RECOMMENDED"
        badgeColor="#1d1c1b"
        badgeBg="#82afec"
      />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '20px 0 4px' }}>
        <span
          style={{
            fontSize: '52px',
            fontWeight: 500,
            letterSpacing: '-0.05em',
            color: '#ffffff',
          }}
        >
          {CURRENCY}
          {price}
        </span>
      </div>
      <div style={{ fontSize: '14px', color: '#a9a39e', marginBottom: '18px' }}>{period}</div>
      <p
        style={{
          margin: '0 0 22px',
          fontSize: '15px',
          lineHeight: 1.55,
          letterSpacing: '-0.01em',
          color: '#d6d1cd',
        }}
      >
        Flexible growth for a practice that needs to scale on demand.
      </p>
      <Link
        ref={btnRef}
        href="/signup"
        style={{
          textDecoration: 'none',
          textAlign: 'center',
          background: '#f7f3ec',
          color: '#1d1c1b',
          fontSize: '15px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          padding: '13px 22px',
          borderRadius: '9999px',
          transition: 'background 200ms',
        }}
      >
        Get started
      </Link>
      <PlanFeatureList features={BUSINESS_FEATURES} color="#d6d1cd" divider="#302f2e" />
    </Reveal>
  );
}

function EnterprisePlanCard() {
  const btnRef = useMagnet<HTMLAnchorElement>();
  return (
    <Reveal
      delay={200}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--screen)',
        border: '1px solid var(--hairline)',
        borderRadius: '28px',
        padding: '32px',
      }}
    >
      <PlanBadgeHeader
        label="Enterprise"
        labelColor="var(--ink-faint)"
        badge="COMING SOON"
        badgeColor="var(--ink-faint)"
        badgeBg="var(--inset)"
      />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '20px 0 4px' }}>
        <span
          style={{
            fontSize: '34px',
            fontWeight: 500,
            letterSpacing: '-0.04em',
            color: 'var(--ink)',
          }}
        >
          Coming soon
        </span>
      </div>
      <p
        style={{
          margin: '0 0 22px',
          fontSize: '15px',
          lineHeight: 1.55,
          letterSpacing: '-0.01em',
          color: 'var(--ink-muted)',
        }}
      >
        Scalability, control and security for larger multi-site groups.
      </p>
      <Link
        ref={btnRef}
        href="/contact-us"
        data-btn-invert
        style={{
          textDecoration: 'none',
          textAlign: 'center',
          background: 'var(--screen)',
          color: 'var(--ink-body)',
          fontSize: '15px',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          padding: '13px 22px',
          borderRadius: '9999px',
          border: '1px solid var(--divider)',
          transition: 'border-color 200ms',
        }}
      >
        Notify me
      </Link>
      <PlanFeatureList
        features={ENTERPRISE_FEATURES}
        color="var(--ink-muted)"
        divider="var(--inset)"
      />
    </Reveal>
  );
}

function FaqRow({ entry }: Readonly<{ entry: FaqEntry }>) {
  return (
    <details
      className="yc-faq"
      open={entry.open}
      style={{ borderTop: '1px solid var(--hairline)', padding: '22px 0' }}
    >
      <summary
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          cursor: 'pointer',
          listStyle: 'none',
          fontSize: '19px',
          fontWeight: 600,
          letterSpacing: '-0.025em',
          color: 'var(--ink)',
        }}
      >
        {entry.q}
        <IoAddOutline
          className="yc-faq-icon"
          aria-hidden="true"
          style={{
            fontSize: '22px',
            color: 'var(--ink-faint)',
            flex: 'none',
            transition: 'transform 250ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </summary>
      <p
        style={{
          margin: '14px 0 0',
          fontSize: '16px',
          lineHeight: 1.65,
          letterSpacing: '-0.01em',
          color: 'var(--ink-muted)',
          maxWidth: '620px',
        }}
      >
        {entry.a}
      </p>
    </details>
  );
}

function HeroSection() {
  return (
    <section
      data-hero
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, var(--page) 0%, var(--page) 65%, var(--inset) 100%)',
        padding: '148px 24px 60px',
      }}
    >
      <HeroGlow
        parallax={false}
        color="var(--glow-b09)"
        box={{ top: '-160px', left: 'calc(50% - 400px)', width: '800px', height: '560px' }}
        animation="ycDrift 32s ease-in-out infinite alternate"
      />
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: 'min(760px, 100%)',
          margin: '0 auto',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '9999px',
            border: '1px solid var(--hairline)',
            background: 'var(--glass-95)',
            backdropFilter: 'blur(40px)',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: 'var(--ink-muted)',
            opacity: 0,
            animation: 'ycHeroUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.05s both',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '9999px',
              background: 'var(--success)',
            }}
          />
          {'No contracts. No platform fees.'}
        </div>
        <h1
          style={{
            margin: '26px 0 0',
            fontFamily: SERIF,
            fontSize: 'clamp(42px, 6vw, 82px)',
            fontWeight: 500,
            lineHeight: 1.03,
            letterSpacing: '-0.06em',
            color: 'var(--ink)',
            textWrap: 'balance',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            columnGap: '0.24em',
          }}
        >
          {HERO_WORDS.map((word, i) => (
            <React.Fragment key={word}>
              <span
                style={{
                  display: 'inline-block',
                  opacity: 0,
                  animation: `ycWord 1.1s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.12}s both`,
                }}
              >
                {word}
              </span>{' '}
            </React.Fragment>
          ))}
          <em
            style={{
              display: 'inline-block',
              fontStyle: 'italic',
              fontWeight: 480,
              color: 'var(--blue-text)',
              opacity: 0,
              animation: 'ycWord 1.1s cubic-bezier(0.16,1,0.3,1) 0.94s both',
            }}
          >
            grow.
          </em>
        </h1>
        <p
          style={{
            margin: '24px 0 0',
            maxWidth: '560px',
            fontSize: 'clamp(17px, 2vw, 20px)',
            lineHeight: 1.6,
            letterSpacing: '-0.025em',
            color: 'var(--ink-muted)',
            opacity: 0,
            animation: 'ycHeroUp 1s cubic-bezier(0.16,1,0.3,1) 0.5s both',
            textWrap: 'pretty',
          }}
        >
          Run it yourself for nothing, or let us host it and pay only for what you use. Either way
          there are no long contracts, no cut of your payments, and under the AGPL-3.0 license you
          own the software.
        </p>
      </div>
    </section>
  );
}

function PlansSection() {
  const [yearly, setYearly] = useState(false);
  const businessPrice = yearly ? BUSINESS_YEARLY : BUSINESS_MONTHLY;
  const businessPeriod = yearly ? 'per user / month, billed yearly' : 'per user / month';

  return (
    <section style={{ background: 'var(--inset)' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(48px, 6vw, 80px) 0 clamp(72px, 9vw, 110px)',
        }}
      >
        <BillingToggle yearly={yearly} onSelect={setYearly} />
        <div
          data-price-grid="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            alignItems: 'stretch',
          }}
        >
          <FreePlanCard />
          <BusinessPlanCard price={businessPrice} period={businessPeriod} />
          <EnterprisePlanCard />
        </div>
        <Reveal
          delay={0}
          as="span"
          style={{
            display: 'block',
            margin: '32px auto 0',
            maxWidth: '620px',
            textAlign: 'center',
            fontSize: '14px',
            lineHeight: 1.6,
            letterSpacing: '-0.01em',
            color: 'var(--ink-faint)',
          }}
        >
          Every plan is the full product, and we{' '}
          <em
            style={{
              fontStyle: 'normal',
              fontWeight: 700,
              color: 'var(--ink-body)',
              textDecoration: 'underline',
              textDecorationColor: 'var(--blue-text)',
              textDecorationThickness: '2px',
              textUnderlineOffset: '3px',
            }}
          >
            never
          </em>{' '}
          take a cut of what your clients pay you. Prefer to run it yourself? Self-hosting is free
          forever under AGPL-3.0.
        </Reveal>
      </div>
    </section>
  );
}

function NoFeeSection() {
  return (
    <Spotlight style={{ background: 'var(--spot)', overflow: 'hidden' }}>
      <section style={{ position: 'relative', background: 'var(--spot)', overflow: 'hidden' }}>
        <HeroGlow
          parallax={false}
          color="var(--glow-b12)"
          box={{ bottom: '-220px', right: '-160px', width: '780px', height: '600px' }}
        />
        <div
          style={{
            width: 'min(980px, calc(100% - 48px))',
            margin: '0 auto',
            padding: 'clamp(88px, 12vw, 160px) 0',
          }}
        >
          <Reveal
            delay={0}
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#8f8984',
            }}
          >
            Why we take no cut
          </Reveal>
          <Reveal
            delay={100}
            as="span"
            style={{
              display: 'block',
              margin: '30px 0 0',
              fontSize: 'clamp(24px, 3.4vw, 42px)',
              fontWeight: 500,
              lineHeight: 1.34,
              letterSpacing: '-0.035em',
              color: '#eae2d5',
              textWrap: 'pretty',
            }}
          >
            The day you start taking a slice of money you didn&apos;t create, you become a toll
            collector, and toll collectors stop making the product better and start making the toll
            bigger. We would rather spend our years making the thing better, so we charge for
            hosting and nothing else.{' '}
            <span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#82afec',
              }}
            >
              You pay your vet, and your statement says your vet.
            </span>
          </Reveal>
        </div>
      </section>
    </Spotlight>
  );
}

function FaqSection() {
  return (
    <section style={{ background: 'var(--page)' }}>
      <div
        data-grid-1-m="true"
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
          display: 'grid',
          gridTemplateColumns: '0.8fr 1.2fr',
          gap: 'clamp(40px, 5vw, 80px)',
        }}
      >
        <Reveal delay={0} style={{ alignSelf: 'flex-start' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--blue-text)',
            }}
          >
            Questions
          </span>
          <h2
            style={{
              margin: '20px 0 0',
              fontFamily: SERIF,
              fontSize: 'clamp(28px, 3.6vw, 44px)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.045em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            The honest answers.
          </h2>
          <p
            style={{
              margin: '18px 0 0',
              fontSize: '16px',
              lineHeight: 1.6,
              letterSpacing: '-0.01em',
              color: 'var(--ink-muted)',
            }}
          >
            Still unsure?{' '}
            <Link href="/contact-us" style={{ color: 'var(--blue-text)', textDecoration: 'none' }}>
              Talk to a human.
            </Link>
          </p>
        </Reveal>
        <Reveal delay={100} style={{ display: 'flex', flexDirection: 'column' }}>
          {FAQS.map((entry) => (
            <FaqRow key={entry.q} entry={entry} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function CtaSection() {
  const primaryRef = useMagnet<HTMLAnchorElement>();
  const secondaryRef = useMagnet<HTMLAnchorElement>();
  return (
    <section style={{ position: 'relative', background: 'var(--inset)', overflow: 'hidden' }}>
      <HeroGlow
        parallax={false}
        color="var(--glow-b07)"
        box={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '900px',
          height: '500px',
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
              margin: 0,
              fontFamily: SERIF,
              fontSize: 'clamp(36px, 5.2vw, 66px)',
              fontWeight: 500,
              lineHeight: 1.06,
              letterSpacing: '-0.055em',
              color: 'var(--ink)',
              textWrap: 'balance',
            }}
          >
            Start free. Grow when you&apos;re ready.
          </h2>
        </Reveal>
        <Reveal
          delay={100}
          as="span"
          style={{
            display: 'block',
            margin: '22px 0 0',
            maxWidth: '560px',
            fontSize: '18px',
            lineHeight: 1.65,
            letterSpacing: '-0.02em',
            color: 'var(--ink-muted)',
            textWrap: 'pretty',
          }}
        >
          Spin it up yourself tonight, or let us host it in minutes. No card, no contract, and you
          can leave with everything whenever you want.
        </Reveal>
        <Reveal delay={200} style={{ marginTop: '36px' }}>
          <div data-stack-m="true" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link
              ref={primaryRef}
              href="/signup"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'var(--cta)',
                color: 'var(--cta-text)',
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                padding: '16px 32px',
                borderRadius: '9999px',
                boxShadow: '0 10px 30px var(--sh18)',
                transition: 'background 200ms',
              }}
            >
              Get started free{' '}
              <IoArrowForwardOutline aria-hidden="true" style={{ fontSize: '17px' }} />
            </Link>
            <Link
              ref={secondaryRef}
              href="/contact-us"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'var(--screen)',
                color: 'var(--ink-body)',
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                padding: '16px 32px',
                borderRadius: '9999px',
                border: '1px solid var(--hairline)',
                transition: 'border-color 200ms',
              }}
            >
              Talk to us
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <>
      <style>{`
        .yc-faq[open] .yc-faq-icon { transform: rotate(45deg); }
        .yc-faq summary::-webkit-details-marker { display: none; }
        @media (max-width: 960px) {
          [data-price-grid] { grid-template-columns: 1fr !important; max-width: 460px; margin-left: auto; margin-right: auto; }
        }
      `}</style>
      <HeroSection />
      <PlansSection />
      <NoFeeSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}

export default Pricing;
