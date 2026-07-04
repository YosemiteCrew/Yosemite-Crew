'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  IoPricetagOutline,
  IoCheckmark,
  IoAddOutline,
  IoArrowForwardOutline,
} from 'react-icons/io5';
import { Reveal, Spotlight, useMagnet } from '@/app/features/marketing/site';

const CURRENCY = '€';
const BUSINESS_MONTHLY = '12';
const BUSINESS_YEARLY = '10';

const SERIF = 'var(--font-newsreader)';

type FeatureItem = { label: string; dot: string };

const FREE_FEATURES: FeatureItem[] = [
  { label: '120 appointments', dot: '#008f5d' },
  { label: '200 observational tools', dot: '#008f5d' },
  { label: 'Scheduler, templates & e-signing', dot: '#008f5d' },
  { label: 'IDEXX + MSD Veterinary Manual', dot: '#008f5d' },
  { label: 'Community & Discord support', dot: '#008f5d' },
];

const BUSINESS_FEATURES: FeatureItem[] = [
  { label: 'Unlimited appointments & tools', dot: '#54b492' },
  { label: 'Team, rooms & departments', dot: '#54b492' },
  { label: 'Billing, invoicing & Stripe payments', dot: '#54b492' },
  { label: 'Financial reporting & analytics', dot: '#54b492' },
  { label: 'Dedicated Discord support', dot: '#54b492' },
];

const ENTERPRISE_FEATURES: FeatureItem[] = [
  { label: 'Everything in Business', dot: '#008f5d' },
  { label: 'Multiple availability zones', dot: '#008f5d' },
  { label: 'Setup, maintenance & backups', dot: '#008f5d' },
  { label: 'Uptime guarantee & SLAs', dot: '#008f5d' },
  { label: 'Priority support', dot: '#008f5d' },
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
    color: active ? '#f7f3ec' : '#5c5956',
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
          background: '#f7f3ec',
          border: '1px solid #e5dccf',
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
          color: '#257bed',
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
        background: '#f7f3ec',
        border: '1px solid #e5dccf',
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
          color: '#8f8984',
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
            color: '#1d1c1b',
          }}
        >
          {CURRENCY}0
        </span>
        <span style={{ fontSize: '16px', color: '#8f8984' }}>forever</span>
      </div>
      <p
        style={{
          margin: '0 0 22px',
          fontSize: '15px',
          lineHeight: 1.55,
          letterSpacing: '-0.01em',
          color: '#5c5956',
        }}
      >
        For a new or small practice finding its feet, on us.
      </p>
      <Link
        ref={btnRef}
        href="/signup"
        style={{
          textDecoration: 'none',
          textAlign: 'center',
          background: '#f7f3ec',
          color: '#302f2e',
          fontSize: '15px',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          padding: '13px 22px',
          borderRadius: '9999px',
          border: '1px solid #d6d1cd',
          transition: 'border-color 200ms, background 200ms',
        }}
      >
        Get started free
      </Link>
      <div style={{ height: '1px', background: '#eae2d5', margin: '24px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {FREE_FEATURES.map((item) => (
          <FeatureRow key={item.label} item={item} color="#5c5956" />
        ))}
      </div>
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
        background: '#1d1c1b',
        border: '1px solid #1d1c1b',
        borderRadius: '28px',
        padding: '32px',
        boxShadow: '0 30px 70px rgba(29,28,27,0.22)',
        position: 'relative',
        transform: 'translateY(-8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#82afec',
          }}
        >
          Business
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#1d1c1b',
            background: '#82afec',
            padding: '5px 11px',
            borderRadius: '9999px',
          }}
        >
          RECOMMENDED
        </span>
      </div>
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
      <div style={{ height: '1px', background: '#302f2e', margin: '24px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {BUSINESS_FEATURES.map((item) => (
          <FeatureRow key={item.label} item={item} color="#d6d1cd" />
        ))}
      </div>
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
        background: '#f7f3ec',
        border: '1px solid #e5dccf',
        borderRadius: '28px',
        padding: '32px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#8f8984',
          }}
        >
          Enterprise
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#8f8984',
            background: '#eae2d5',
            padding: '5px 11px',
            borderRadius: '9999px',
          }}
        >
          COMING SOON
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '20px 0 4px' }}>
        <span
          style={{
            fontSize: '34px',
            fontWeight: 500,
            letterSpacing: '-0.04em',
            color: '#1d1c1b',
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
          color: '#5c5956',
        }}
      >
        Scalability, control and security for larger multi-site groups.
      </p>
      <Link
        ref={btnRef}
        href="/contact-us"
        style={{
          textDecoration: 'none',
          textAlign: 'center',
          background: '#f7f3ec',
          color: '#302f2e',
          fontSize: '15px',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          padding: '13px 22px',
          borderRadius: '9999px',
          border: '1px solid #d6d1cd',
          transition: 'border-color 200ms',
        }}
      >
        Notify me
      </Link>
      <div style={{ height: '1px', background: '#eae2d5', margin: '24px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {ENTERPRISE_FEATURES.map((item) => (
          <FeatureRow key={item.label} item={item} color="#5c5956" />
        ))}
      </div>
    </Reveal>
  );
}

function FaqRow({ entry }: Readonly<{ entry: FaqEntry }>) {
  return (
    <details
      className="yc-faq"
      open={entry.open}
      style={{ borderTop: '1px solid #e5dccf', padding: '22px 0' }}
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
          color: '#1d1c1b',
        }}
      >
        {entry.q}
        <IoAddOutline
          className="yc-faq-icon"
          aria-hidden="true"
          style={{
            fontSize: '22px',
            color: '#8f8984',
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
          color: '#5c5956',
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
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #efe8dc 0%, #efe8dc 65%, #eae2d5 100%)',
        padding: '148px 24px 60px',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-160px',
          left: 'calc(50% - 400px)',
          width: '800px',
          height: '560px',
          background: 'radial-gradient(closest-side, rgba(37,123,237,0.09), transparent 70%)',
          pointerEvents: 'none',
          animation: 'ycDrift 32s ease-in-out infinite alternate',
        }}
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
            border: '1px solid #e5dccf',
            background: 'rgba(239,232,220,0.94)',
            backdropFilter: 'blur(40px)',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: '#5c5956',
            opacity: 0,
            animation: 'ycHeroUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.05s both',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '9999px',
              background: '#008f5d',
            }}
          />
          No contracts. No platform fees.
        </div>
        <h1
          style={{
            margin: '26px 0 0',
            fontFamily: SERIF,
            fontSize: 'clamp(42px, 6vw, 82px)',
            fontWeight: 500,
            lineHeight: 1.03,
            letterSpacing: '-0.06em',
            color: '#1d1c1b',
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
              color: '#257bed',
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
            color: '#5c5956',
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
    <section style={{ background: '#eae2d5' }}>
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
            color: '#8f8984',
          }}
        >
          Every plan is the full product, and we{' '}
          <em
            style={{
              fontStyle: 'normal',
              fontWeight: 700,
              color: '#302f2e',
              textDecoration: 'underline',
              textDecorationColor: '#257bed',
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
    <Spotlight style={{ background: '#1d1c1b', overflow: 'hidden' }}>
      <section style={{ position: 'relative', background: '#1d1c1b', overflow: 'hidden' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '-220px',
            right: '-160px',
            width: '780px',
            height: '600px',
            background: 'radial-gradient(closest-side, rgba(37,123,237,0.12), transparent 70%)',
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
    <section style={{ background: '#efe8dc' }}>
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
              color: '#257bed',
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
              color: '#1d1c1b',
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
              color: '#5c5956',
            }}
          >
            Still unsure?{' '}
            <Link href="/contact-us" style={{ color: '#257bed', textDecoration: 'none' }}>
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
    <section style={{ position: 'relative', background: '#eae2d5', overflow: 'hidden' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '900px',
          height: '500px',
          background: 'radial-gradient(closest-side, rgba(37,123,237,0.07), transparent 70%)',
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
              margin: 0,
              fontFamily: SERIF,
              fontSize: 'clamp(36px, 5.2vw, 66px)',
              fontWeight: 500,
              lineHeight: 1.06,
              letterSpacing: '-0.055em',
              color: '#1d1c1b',
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
            color: '#5c5956',
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
                background: '#302f2e',
                color: '#ffffff',
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                padding: '16px 32px',
                borderRadius: '9999px',
                boxShadow: '0 10px 30px rgba(29,28,27,0.18)',
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
                background: '#f7f3ec',
                color: '#302f2e',
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                padding: '16px 32px',
                borderRadius: '9999px',
                border: '1px solid #e5dccf',
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
