'use client';

import React from 'react';
import Link from 'next/link';
import {
  IoArrowForwardOutline,
  IoLogoGithub,
  IoGitBranchOutline,
  IoMicOutline,
  IoPulseOutline,
  IoCallOutline,
  IoAddOutline,
  IoHardwareChipOutline,
  IoRocketOutline,
  IoCardOutline,
  IoGitNetworkOutline,
  IoReceiptOutline,
  IoPeopleOutline,
} from 'react-icons/io5';

import { Reveal, Spotlight, Tilt, useMagnet, GITHUB_REPO_URL } from '@/app/features/marketing/site';

const NEWSREADER = 'var(--font-newsreader)';
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

/** Hero: headline with cyan em-word, terminal + FHIR response mock. */
function Hero() {
  const primaryRef = useMagnet<HTMLAnchorElement>();
  const ghostRef = useMagnet<HTMLAnchorElement>();

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #efe8dc 0%, #efe8dc 60%, #eae2d5 100%)',
        padding: '148px 24px 90px',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-160px',
          left: 'calc(50% - 620px)',
          width: '860px',
          height: '600px',
          background: 'radial-gradient(closest-side, rgba(37,123,237,0.10), transparent 70%)',
          pointerEvents: 'none',
          animation: 'ycDrift 30s ease-in-out infinite alternate',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '-220px',
          right: '-140px',
          width: '720px',
          height: '540px',
          background: 'radial-gradient(closest-side, rgba(92,225,230,0.09), transparent 70%)',
          pointerEvents: 'none',
          animation: 'ycDrift 38s ease-in-out 3s infinite alternate-reverse',
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
          gridTemplateColumns: '1fr 1fr',
          gap: 'clamp(36px, 5vw, 72px)',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
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
              style={{ width: '7px', height: '7px', borderRadius: '9999px', background: '#008f5d' }}
            />
            Developer portal
            <span
              style={{ width: '1px', height: '12px', background: '#d6d1cd', margin: '0 3px' }}
            />
            <span style={{ color: '#1d1c1b', fontWeight: 600 }}>Coming soon</span>
          </div>
          <h1
            style={{
              margin: '24px 0 0',
              fontFamily: NEWSREADER,
              fontSize: 'clamp(40px, 5vw, 76px)',
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
            <span
              style={{
                display: 'inline-block',
                opacity: 0,
                animation: 'ycWord 1.1s cubic-bezier(0.16,1,0.3,1) 0.1s both',
              }}
            >
              From
            </span>
            <span
              style={{
                display: 'inline-block',
                opacity: 0,
                animation: 'ycWord 1.1s cubic-bezier(0.16,1,0.3,1) 0.22s both',
              }}
            >
              idea
            </span>
            <span
              style={{
                display: 'inline-block',
                opacity: 0,
                animation: 'ycWord 1.1s cubic-bezier(0.16,1,0.3,1) 0.34s both',
              }}
            >
              to
            </span>
            <span
              style={{
                display: 'inline-block',
                opacity: 0,
                animation: 'ycWord 1.1s cubic-bezier(0.16,1,0.3,1) 0.46s both',
              }}
            >
              the
            </span>
            <span
              style={{
                display: 'inline-block',
                opacity: 0,
                animation: 'ycWord 1.1s cubic-bezier(0.16,1,0.3,1) 0.58s both',
              }}
            >
              clinic,
            </span>
            <em
              style={{
                display: 'inline-block',
                fontStyle: 'italic',
                fontWeight: 480,
                color: '#38ccd8',
                opacity: 0,
                animation: 'ycWord 1.1s cubic-bezier(0.16,1,0.3,1) 0.7s both',
              }}
            >
              in&nbsp;an&nbsp;afternoon.
            </em>
          </h1>
          <p
            style={{
              margin: '24px 0 0',
              maxWidth: '520px',
              fontSize: 'clamp(17px, 2vw, 20px)',
              lineHeight: 1.6,
              letterSpacing: '-0.025em',
              color: '#5c5956',
              opacity: 0,
              animation: 'ycHeroUp 1s cubic-bezier(0.16,1,0.3,1) 0.5s both',
              textWrap: 'pretty',
            }}
          >
            A FHIR-native API, a plugin marketplace, and a codebase you can actually read. Build an
            AI scribe, a triage agent or a smarter reminder, and put it in front of working clinics
            without a committee to die in.
          </p>
          <div
            data-stack-m="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginTop: '34px',
              opacity: 0,
              animation: 'ycHeroUp 1s cubic-bezier(0.16,1,0.3,1) 0.62s both',
            }}
          >
            <Link
              ref={primaryRef}
              href="/developers/signup"
              className="yc-btn-primary"
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
                padding: '16px 30px',
                borderRadius: '9999px',
                boxShadow: '0 10px 30px rgba(29,28,27,0.18)',
              }}
            >
              Read the docs{' '}
              <IoArrowForwardOutline aria-hidden="true" style={{ fontSize: '17px' }} />
            </Link>
            <a
              ref={ghostRef}
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(239,232,220,0.94)',
                color: '#302f2e',
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                padding: '16px 30px',
                borderRadius: '9999px',
                border: '1px solid #e5dccf',
              }}
            >
              <IoLogoGithub aria-hidden="true" style={{ fontSize: '18px' }} /> Clone the repo
            </a>
          </div>
        </div>

        {/* terminal + code */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative',
            opacity: 0,
            animation: 'ycRise 1.1s cubic-bezier(0.16,1,0.3,1) 0.4s both',
          }}
        >
          <div
            style={{
              background: '#1d1c1b',
              borderRadius: '20px',
              boxShadow: '0 30px 70px rgba(29,28,27,0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '13px 18px',
                borderBottom: '1px solid #302f2e',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '9999px',
                  background: '#454341',
                }}
              />
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '9999px',
                  background: '#454341',
                }}
              />
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '9999px',
                  background: '#454341',
                }}
              />
              <span
                style={{
                  marginLeft: '8px',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '12px',
                  color: '#8f8984',
                }}
              >
                zsh
              </span>
            </div>
            <pre
              style={{
                margin: 0,
                padding: '18px',
                fontFamily: MONO,
                fontSize: '13px',
                lineHeight: 1.7,
                color: '#d6d1cd',
              }}
            >
              <span style={{ color: '#54b492' }}>$</span> git clone yosemitecrew/Yosemite-Crew
              {'\n'}
              <span style={{ color: '#54b492' }}>$</span> bun install{' '}
              <span style={{ color: '#5c5956' }}>&amp;&amp;</span> bun run dev
              {'\n'}
              <span style={{ color: '#8f8984' }}>
                → PIMS live on :3000 &nbsp;·&nbsp; works offline
              </span>
              {'\n'}
              <span style={{ color: '#54b492' }}>$</span> yc plugins publish ./ai-scribe
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '15px',
                  background: '#d6d1cd',
                  verticalAlign: '-2px',
                  marginLeft: '2px',
                  animation: 'ycCaret 1.1s step-end infinite',
                }}
              />
            </pre>
          </div>
          <div
            style={{
              background: '#f7f3ec',
              border: '1px solid #e5dccf',
              borderRadius: '20px',
              boxShadow: '0 24px 60px rgba(29,28,27,0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '13px 18px',
                borderBottom: '1px solid #eae2d5',
              }}
            >
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '12.5px',
                  color: '#5c5956',
                }}
              >
                <span style={{ color: '#008f5d', fontWeight: 700 }}>GET</span> /fhir/Patient/bella
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#008f5d',
                  letterSpacing: '0.06em',
                }}
              >
                200 OK
              </span>
            </div>
            <pre
              style={{
                margin: 0,
                padding: '18px',
                fontFamily: MONO,
                fontSize: '12.5px',
                lineHeight: 1.65,
                color: '#5c5956',
                overflowX: 'auto',
              }}
            >
              <span style={{ color: '#a9a39e' }}>{'{'}</span>
              {'\n  '}
              <span style={{ color: '#38ccd8' }}>&quot;resourceType&quot;</span>:{' '}
              <span style={{ color: '#006642' }}>&quot;Patient&quot;</span>,{'\n  '}
              <span style={{ color: '#38ccd8' }}>&quot;species&quot;</span>:{' '}
              <span style={{ color: '#006642' }}>&quot;canine&quot;</span>,{' '}
              <span style={{ color: '#38ccd8' }}>&quot;name&quot;</span>:{' '}
              <span style={{ color: '#006642' }}>&quot;Bella&quot;</span>,{'\n  '}
              <span style={{ color: '#38ccd8' }}>&quot;managingOrg&quot;</span>:{' '}
              <span style={{ color: '#006642' }}>&quot;Alpenblick Clinic&quot;</span>
              {'\n'}
              <span style={{ color: '#a9a39e' }}>{'}'}</span>
            </pre>
          </div>
          <div
            data-hide-m="true"
            style={{
              position: 'absolute',
              bottom: '-22px',
              left: '-30px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '11px 15px',
              borderRadius: '16px',
              background: 'rgba(239,232,220,0.94)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(239,232,220,0.94)',
              boxShadow: '0 16px 44px rgba(29,28,27,0.12)',
              animation: 'ycFloatB 8s ease-in-out infinite',
            }}
          >
            <span
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '10px',
                background: '#e6f2ff',
                color: '#257bed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IoGitBranchOutline aria-hidden="true" style={{ fontSize: '16px' }} />
            </span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#302f2e' }}>AGPL-3.0</div>
              <div style={{ fontSize: '11px', color: '#8f8984' }}>Every line, public</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Dark editorial statement about the machine user. */
function MachineUser() {
  return (
    <Spotlight style={{ background: '#1d1c1b', overflow: 'hidden' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-220px',
          right: '-160px',
          width: '780px',
          height: '600px',
          background: 'radial-gradient(closest-side, rgba(37,123,237,0.13), transparent 70%)',
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
        <Reveal delay={0}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#8f8984',
            }}
          >
            The user is changing
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
            For thirty years, good design meant hiding the machinery from a tired human. Soon most
            of the things using your software won&apos;t be people at all, and a machine wants the
            opposite: the structure naked, the fields exposed, the meaning spelled out.{' '}
            <span
              style={{
                fontFamily: NEWSREADER,
                fontStyle: 'italic',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#5ce1e6',
              }}
            >
              We built a warm face for the human and a clean, exposed spine for the machine.
            </span>
          </p>
        </Reveal>
      </div>
    </Spotlight>
  );
}

/** Feature 1: FHIR API, one animal many authorities + bundle.json mock. */
function FhirApiFeature() {
  return (
    <section style={{ background: '#efe8dc' }}>
      <div
        data-grid-1-m="true"
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
          display: 'grid',
          gridTemplateColumns: '0.95fr 1.05fr',
          gap: 'clamp(40px, 5vw, 80px)',
          alignItems: 'center',
        }}
      >
        <Reveal
          delay={0}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '18px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#257bed',
            }}
          >
            FHIR-native API
          </span>
          <h2
            style={{
              margin: 0,
              fontFamily: NEWSREADER,
              fontSize: 'clamp(30px, 3.6vw, 46px)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.045em',
              color: '#1d1c1b',
              textWrap: 'balance',
            }}
          >
            One animal, many authorities.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '17.5px',
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: '#5c5956',
              textWrap: 'pretty',
            }}
          >
            A rabies shot that counts for three years on one side of a border counts for one on the
            other, and a chip required in Madrid runs on a frequency scanners elsewhere can&apos;t
            read. Instead of forcing one true record, the API speaks FHIR and translates between the
            versions, so every system keeps its own truth and the animal still moves between them.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginTop: '4px',
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '13.5px',
                color: '#5c5956',
              }}
            >
              <span style={{ fontWeight: 700, color: '#008f5d', width: '46px' }}>GET</span>{' '}
              /fhir/Observation?patient=bella
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '13.5px',
                color: '#5c5956',
              }}
            >
              <span style={{ fontWeight: 700, color: '#257bed', width: '46px' }}>POST</span>{' '}
              /fhir/Appointment
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '13.5px',
                color: '#5c5956',
              }}
            >
              <span style={{ fontWeight: 700, color: '#af5e19', width: '46px' }}>SUB</span>{' '}
              /fhir/subscriptions
            </div>
          </div>
        </Reveal>
        <Reveal delay={150} style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            className="yc-card-lift"
            style={{
              width: '100%',
              maxWidth: '540px',
              background: '#1d1c1b',
              borderRadius: '22px',
              boxShadow: '0 24px 60px rgba(29,28,27,0.16)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: '1px solid #302f2e',
              }}
            >
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '12.5px',
                  color: '#8f8984',
                }}
              >
                bundle.json
              </span>
              <span style={{ display: 'flex', gap: '6px' }}>
                <span
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '9999px',
                    background: '#454341',
                  }}
                />
                <span
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '9999px',
                    background: '#454341',
                  }}
                />
              </span>
            </div>
            <pre
              style={{
                margin: 0,
                padding: '20px',
                fontFamily: MONO,
                fontSize: '12.5px',
                lineHeight: 1.7,
                color: '#d6d1cd',
                overflowX: 'auto',
              }}
            >
              <span style={{ color: '#8f8984' }}>{'{'}</span>
              {'\n  '}
              <span style={{ color: '#5ce1e6' }}>&quot;resourceType&quot;</span>:{' '}
              <span style={{ color: '#8acbb4' }}>&quot;Bundle&quot;</span>,{'\n  '}
              <span style={{ color: '#5ce1e6' }}>&quot;type&quot;</span>:{' '}
              <span style={{ color: '#8acbb4' }}>&quot;searchset&quot;</span>,{'\n  '}
              <span style={{ color: '#5ce1e6' }}>&quot;total&quot;</span>:{' '}
              <span style={{ color: '#f9ad6c' }}>3</span>,{'\n  '}
              <span style={{ color: '#5ce1e6' }}>&quot;entry&quot;</span>:{' '}
              <span style={{ color: '#8f8984' }}>[</span>
              {'\n    '}
              <span style={{ color: '#8f8984' }}>{'{'}</span>{' '}
              <span style={{ color: '#5ce1e6' }}>&quot;code&quot;</span>:{' '}
              <span style={{ color: '#8acbb4' }}>&quot;rabies-vax&quot;</span>,{'\n      '}
              <span style={{ color: '#5ce1e6' }}>&quot;validYears&quot;</span>:{' '}
              <span style={{ color: '#f9ad6c' }}>3</span>,{'\n      '}
              <span style={{ color: '#5ce1e6' }}>&quot;authority&quot;</span>:{' '}
              <span style={{ color: '#8acbb4' }}>&quot;EU&quot;</span>{' '}
              <span style={{ color: '#8f8984' }}>{'},'}</span>
              {'\n    '}
              <span style={{ color: '#8f8984' }}>{'{'}</span>{' '}
              <span style={{ color: '#5ce1e6' }}>&quot;code&quot;</span>:{' '}
              <span style={{ color: '#8acbb4' }}>&quot;rabies-vax&quot;</span>,{'\n      '}
              <span style={{ color: '#5ce1e6' }}>&quot;validYears&quot;</span>:{' '}
              <span style={{ color: '#f9ad6c' }}>1</span>,{'\n      '}
              <span style={{ color: '#5ce1e6' }}>&quot;authority&quot;</span>:{' '}
              <span style={{ color: '#8acbb4' }}>&quot;US&quot;</span>{' '}
              <span style={{ color: '#8f8984' }}>{'}'}</span>
              {'\n  '}
              <span style={{ color: '#8f8984' }}>]</span>
              {'\n'}
              <span style={{ color: '#8f8984' }}>{'}'}</span>
            </pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** FHIR-native resource chips. */
function FhirNative() {
  const resources = [
    'Patient',
    'Encounter',
    'Observation',
    'MedicationRequest',
    'DiagnosticReport',
    'Immunization',
  ];
  return (
    <section style={{ background: '#efe8dc' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
        }}
      >
        <Reveal delay={0} style={{ maxWidth: '800px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#257bed',
            }}
          >
            Speaks the language of health data
          </span>
          <h2
            style={{
              margin: '22px 0 0',
              fontFamily: NEWSREADER,
              fontSize: 'clamp(30px, 4vw, 50px)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.05em',
              color: '#1d1c1b',
              textWrap: 'balance',
            }}
          >
            FHIR-native, all the way down.
          </h2>
          <p
            style={{
              margin: '20px 0 0',
              fontSize: '18px',
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: '#5c5956',
              textWrap: 'pretty',
            }}
          >
            Records are not trapped in a shape only we understand. Animals, visits, labs and
            medications are modelled as FHIR resources, the same standard human health systems run
            on, so your integrations read clean, typed data instead of reverse-engineering a private
            format. Interoperability is the default, not a paid add-on.
          </p>
        </Reveal>
        <Reveal
          delay={120}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginTop: 'clamp(36px, 5vw, 56px)',
          }}
        >
          {resources.map((name) => (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                background: '#f7f3ec',
                border: '1px solid #e5dccf',
                borderRadius: '14px',
                padding: '12px 16px',
              }}
            >
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: '#1d1c1b',
                }}
              >
                {name}
              </span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

interface PluginRowProps {
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: 'install' | 'installed';
}

function PluginRow({ iconBg, iconColor, icon, title, desc, cta }: Readonly<PluginRowProps>) {
  return (
    <div
      style={{
        background: '#f7f3ec',
        border: '1px solid #e5dccf',
        borderRadius: '18px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        boxShadow: '0 8px 24px rgba(29,28,27,0.06)',
      }}
    >
      <span
        style={{
          flex: 'none',
          width: '44px',
          height: '44px',
          borderRadius: '13px',
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
        <div
          style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: '#1d1c1b' }}
        >
          {title}
        </div>
        <div style={{ fontSize: '12.5px', color: '#8f8984' }}>{desc}</div>
      </div>
      {cta === 'install' ? (
        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#ffffff',
            background: '#302f2e',
            padding: '7px 14px',
            borderRadius: '9999px',
          }}
        >
          Install
        </span>
      ) : (
        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#302f2e',
            border: '1px solid #e5dccf',
            padding: '7px 14px',
            borderRadius: '9999px',
          }}
        >
          Installed
        </span>
      )}
    </div>
  );
}

/** Feature 2: marketplace, reversed layout. */
function Marketplace() {
  return (
    <section style={{ background: '#e8e0d2' }}>
      <div
        data-grid-1-m="true"
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
          display: 'grid',
          gridTemplateColumns: '1.05fr 0.95fr',
          gap: 'clamp(40px, 5vw, 80px)',
          alignItems: 'center',
        }}
      >
        <Reveal delay={150} style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <PluginRow
              iconBg="#e6f2ff"
              iconColor="#257bed"
              icon={<IoMicOutline aria-hidden="true" style={{ fontSize: '20px' }} />}
              title="AI Scribe"
              desc="Turns the consult into a SOAP note"
              cta="install"
            />
            <PluginRow
              iconBg="#e6f4ef"
              iconColor="#006642"
              icon={<IoPulseOutline aria-hidden="true" style={{ fontSize: '20px' }} />}
              title="Triage Agent"
              desc="Sorts the inbox before the vet reads it"
              cta="installed"
            />
            <PluginRow
              iconBg="#fef3e9"
              iconColor="#af5e19"
              icon={<IoCallOutline aria-hidden="true" style={{ fontSize: '20px' }} />}
              title="Voice Reminders"
              desc="Calls pet parents about overdue vaccines"
              cta="install"
            />
            <div
              style={{
                border: '1.5px dashed #d6d1cd',
                borderRadius: '18px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <span
                style={{
                  flex: 'none',
                  width: '44px',
                  height: '44px',
                  borderRadius: '13px',
                  background: '#eae2d5',
                  color: '#8f8984',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IoAddOutline aria-hidden="true" style={{ fontSize: '22px' }} />
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#5c5956',
                  }}
                >
                  Your plugin here
                </div>
                <div style={{ fontSize: '12.5px', color: '#a9a39e' }}>Publish in an afternoon</div>
              </div>
            </div>
          </div>
        </Reveal>
        <div data-order-first-m="true">
          <Reveal
            delay={0}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '18px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#257bed',
              }}
            >
              Plugin marketplace
            </span>
            <h2
              style={{
                margin: 0,
                fontFamily: NEWSREADER,
                fontSize: 'clamp(30px, 3.6vw, 46px)',
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: '-0.045em',
                color: '#1d1c1b',
                textWrap: 'balance',
              }}
            >
              Publish once. Reach every clinic.
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '17.5px',
                lineHeight: 1.65,
                letterSpacing: '-0.02em',
                color: '#5c5956',
                textWrap: 'pretty',
              }}
            >
              It works the way WordPress plugins do. You build against the API, publish to the
              marketplace, and any clinic running Yosemite Crew installs your work with one click.
              The distribution is already there, so the only thing between your idea and a paying
              practice is the building.
            </p>
            <Link
              href="/developers/signup"
              className="yc-link"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                color: '#257bed',
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                marginTop: '4px',
              }}
            >
              Open the developer portal{' '}
              <IoArrowForwardOutline aria-hidden="true" style={{ fontSize: '16px' }} />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

interface EconColumnProps {
  index: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay: number;
}

function EconColumn({ index, icon, title, desc, delay }: Readonly<EconColumnProps>) {
  return (
    <Reveal delay={delay} style={{ borderTop: '1px solid #35322f', paddingTop: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            fontFamily: NEWSREADER,
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: '27px',
            color: '#82afec',
          }}
        >
          {index}
        </span>
        {icon}
      </div>
      <div
        style={{
          marginTop: '14px',
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '-0.025em',
          color: '#eae2d5',
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: '8px',
          fontSize: '14.5px',
          lineHeight: 1.6,
          letterSpacing: '-0.01em',
          color: '#a9a39e',
        }}
      >
        {desc}
      </div>
    </Reveal>
  );
}

/** Economics: 0% platform cut, comparison bars, editorial row. Stays BLUE, not cyan. */
function Economics() {
  return (
    <Spotlight style={{ background: '#1d1c1b', overflow: 'hidden' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-200px',
          left: '-160px',
          width: '760px',
          height: '580px',
          background: 'radial-gradient(closest-side, rgba(37,123,237,0.12), transparent 70%)',
          pointerEvents: 'none',
          animation: 'ycDrift 34s ease-in-out infinite alternate',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '-220px',
          right: '-160px',
          width: '680px',
          height: '520px',
          background: 'radial-gradient(closest-side, rgba(130,175,236,0.08), transparent 70%)',
          pointerEvents: 'none',
          animation: 'ycDrift 42s ease-in-out 3s infinite alternate-reverse',
        }}
      />
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(88px, 11vw, 152px) 0',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Reveal delay={0}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#8f8984',
            }}
          >
            The economics
          </div>
        </Reveal>
        <Reveal delay={60}>
          <h2
            style={{
              margin: '20px 0 0',
              maxWidth: '20ch',
              fontFamily: NEWSREADER,
              fontSize: 'clamp(30px, 4vw, 56px)',
              fontWeight: 500,
              lineHeight: 1.06,
              letterSpacing: '-0.05em',
              color: '#eae2d5',
              textWrap: 'balance',
            }}
          >
            Bring your own AI. Sell to every clinic.{' '}
            <span
              style={{
                fontFamily: NEWSREADER,
                fontStyle: 'italic',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#82afec',
              }}
            >
              Keep all of it.
            </span>
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p
            style={{
              margin: '22px 0 0',
              maxWidth: '62ch',
              fontSize: '18px',
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: '#a9a39e',
              textWrap: 'pretty',
            }}
          >
            Most platforms rent you their model, then take a cut of everything you earn on top of
            it. We do neither. Point your own Claude or Codex subscription at the API, build
            whatever you want, and sell it straight to the practices that need it.
          </p>
        </Reveal>

        <Reveal delay={150}>
          <Tilt
            max={3}
            style={{
              position: 'relative',
              marginTop: 'clamp(40px, 5vw, 64px)',
              background: 'linear-gradient(160deg, #232120 0%, #1a1918 100%)',
              border: '1px solid #35322f',
              borderRadius: '28px',
              padding: 'clamp(28px, 3.4vw, 48px)',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '-120px',
                right: '-80px',
                width: '380px',
                height: '380px',
                background: 'radial-gradient(closest-side, rgba(37,123,237,0.20), transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div
              data-grid-1-m="true"
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: '1fr 1.25fr',
                gap: 'clamp(28px, 4vw, 60px)',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
                  <span
                    style={{
                      fontFamily: NEWSREADER,
                      fontWeight: 500,
                      fontSize: 'clamp(72px, 9vw, 118px)',
                      lineHeight: 0.82,
                      letterSpacing: '-0.04em',
                      color: '#ffffff',
                    }}
                  >
                    0%
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      lineHeight: 1.25,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: '#82afec',
                    }}
                  >
                    platform
                    <br />
                    cut
                  </span>
                </div>
                <div
                  style={{
                    marginTop: '22px',
                    fontSize: '20px',
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    color: '#eae2d5',
                  }}
                >
                  What you charge is what you keep.
                </div>
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '15px',
                    lineHeight: 1.6,
                    letterSpacing: '-0.01em',
                    color: '#a9a39e',
                    maxWidth: '42ch',
                  }}
                >
                  Clinics pay you directly through the marketplace. No revenue share, no platform
                  tax, and no tokens resold back to you.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#6f6a66',
                  }}
                >
                  What the developer keeps on every sale
                </div>
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: '9px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        color: '#d6d1cd',
                      }}
                    >
                      App stores &amp; SaaS platforms
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#8f8984' }}>
                      70&ndash;85%
                    </span>
                  </div>
                  <div
                    style={{
                      height: '40px',
                      borderRadius: '12px',
                      background: '#2c2926',
                      border: '1px solid #35322f',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: '77%',
                        background:
                          'repeating-linear-gradient(135deg, #4a4643 0 10px, #423e3b 10px 20px)',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '0.01em',
                        color: '#a9a39e',
                      }}
                    >
                      they take 15&ndash;30%
                    </span>
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: '9px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        color: '#eae2d5',
                      }}
                    >
                      Yosemite Crew marketplace
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#82afec' }}>
                      100%
                    </span>
                  </div>
                  <div
                    style={{
                      height: '40px',
                      borderRadius: '12px',
                      background: '#2c2926',
                      border: '1px solid #2f6fc0',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: '100%',
                        background: 'linear-gradient(90deg, #257bed 0%, #257bed 100%)',
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background:
                            'linear-gradient(180deg, rgba(255,255,255,0.18), transparent 55%)',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '0.01em',
                        color: '#ffffff',
                      }}
                    >
                      every euro is yours
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Tilt>
        </Reveal>

        <div
          data-grid-1-m="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'clamp(24px, 3vw, 44px)',
            marginTop: 'clamp(36px, 4vw, 56px)',
          }}
        >
          <EconColumn
            index="01"
            delay={0}
            icon={
              <IoHardwareChipOutline
                aria-hidden="true"
                style={{ fontSize: '19px', color: '#6f6a66' }}
              />
            }
            title="Bring your own model"
            desc="Point your own Claude or Codex subscription at the API and build headless PIMs and agents on your own keys. We never sit between you and the model."
          />
          <EconColumn
            index="02"
            delay={90}
            icon={
              <IoRocketOutline aria-hidden="true" style={{ fontSize: '19px', color: '#6f6a66' }} />
            }
            title="Sell to every clinic"
            desc="Ship an AI scribe, a voice agent or a triage bot to the marketplace. One publish reaches every practice already running the platform."
          />
          <EconColumn
            index="03"
            delay={180}
            icon={
              <IoCardOutline aria-hidden="true" style={{ fontSize: '19px', color: '#6f6a66' }} />
            }
            title="Paid direct"
            desc="Clinics pay you directly for what you build. Next to the cut every app store takes, keeping all of it is the whole point."
          />
        </div>
      </div>
    </Spotlight>
  );
}

interface ProofCardProps {
  icon: React.ReactNode;
  title: string;
  desc: React.ReactNode;
  delay: number;
}

function ProofCard({ icon, title, desc, delay }: Readonly<ProofCardProps>) {
  return (
    <Reveal
      delay={delay}
      style={{
        background: '#f7f3ec',
        border: '1px solid #e5dccf',
        borderRadius: '20px',
        padding: '24px',
      }}
    >
      <span
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: '#eae2d5',
          color: '#302f2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
        }}
      >
        {icon}
      </span>
      <div
        style={{
          fontSize: '16px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#1d1c1b',
          marginBottom: '6px',
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: '14px', lineHeight: 1.55, color: '#5c5956' }}>{desc}</div>
    </Reveal>
  );
}

/** Open source / proof. */
function OpenSource() {
  return (
    <section style={{ background: '#eae2d5' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) 0',
        }}
      >
        <Reveal delay={0} style={{ maxWidth: '720px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#8f8984',
            }}
          >
            Why it&apos;s open
          </span>
          <h2
            style={{
              margin: '22px 0 0',
              fontFamily: NEWSREADER,
              fontSize: 'clamp(30px, 4vw, 50px)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.05em',
              color: '#1d1c1b',
              textWrap: 'balance',
            }}
          >
            Read every line. Change any of it. Leave with all of it.
          </h2>
          <p
            style={{
              margin: '20px 0 0',
              fontSize: '18px',
              lineHeight: 1.65,
              letterSpacing: '-0.02em',
              color: '#5c5956',
              textWrap: 'pretty',
            }}
          >
            Anyone can say they put you first, and because the words cost nothing, they prove
            nothing. The only way to prove you won&apos;t trap someone is to make trapping them
            impossible. So the whole thing is AGPL-3.0, every record exports, and you can{' '}
            <strong
              style={{
                fontWeight: 700,
                color: '#302f2e',
                textDecoration: 'underline',
                textDecorationColor: '#257bed',
                textDecorationThickness: '2px',
                textUnderlineOffset: '3px',
              }}
            >
              fork it and walk
            </strong>
            . That costs us the lock-in every investor wanted us to keep, which is exactly why
            it&apos;s worth believing.
          </p>
        </Reveal>
        <div
          data-grid-2-m="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '20px',
            marginTop: 'clamp(40px, 5vw, 64px)',
          }}
        >
          <ProofCard
            delay={0}
            icon={<IoLogoGithub aria-hidden="true" style={{ fontSize: '20px' }} />}
            title="The whole repo"
            desc="Frontend, backend and mobile, all public, all readable."
          />
          <ProofCard
            delay={80}
            icon={<IoGitNetworkOutline aria-hidden="true" style={{ fontSize: '20px' }} />}
            title="FHIR standard"
            desc="Built on the health-data standard, not a private schema you'd have to reverse."
          />
          <ProofCard
            delay={160}
            icon={<IoReceiptOutline aria-hidden="true" style={{ fontSize: '20px' }} />}
            title="Audit trail"
            desc="If a dose was given, the system can prove it. If it isn't written down, it didn't happen."
          />
          <ProofCard
            delay={240}
            icon={<IoPeopleOutline aria-hidden="true" style={{ fontSize: '20px' }} />}
            title="A real community"
            desc="Contributors, a Discord and issues that get answered by people who wrote the code."
          />
        </div>
      </div>
    </section>
  );
}

/** Closing CTA. */
function ClosingCta() {
  const ghRef = useMagnet<HTMLAnchorElement>();
  const portalRef = useMagnet<HTMLAnchorElement>();
  return (
    <Spotlight style={{ background: '#1d1c1b', overflow: 'hidden' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '900px',
          height: '500px',
          background: 'radial-gradient(closest-side, rgba(37,123,237,0.14), transparent 70%)',
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
              fontFamily: NEWSREADER,
              fontSize: 'clamp(36px, 5.2vw, 66px)',
              fontWeight: 500,
              lineHeight: 1.06,
              letterSpacing: '-0.055em',
              color: '#eae2d5',
              textWrap: 'balance',
            }}
          >
            Clone it tonight.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p
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
            Read the source, run it locally in one command, and ship your first plugin to a real
            clinic before the week is out.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <div
            data-stack-m="true"
            style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '36px' }}
          >
            <a
              ref={ghRef}
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: '#f7f3ec',
                color: '#1d1c1b',
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                padding: '16px 32px',
                borderRadius: '9999px',
                transition: 'background 200ms',
              }}
            >
              <IoLogoGithub aria-hidden="true" style={{ fontSize: '18px' }} /> Star on GitHub
            </a>
            <Link
              ref={portalRef}
              href="/developers/signup"
              style={{
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
              }}
            >
              Developer portal{' '}
              <IoArrowForwardOutline aria-hidden="true" style={{ fontSize: '17px' }} />
            </Link>
          </div>
        </Reveal>
      </div>
    </Spotlight>
  );
}

export function DevelopersPage() {
  return (
    <>
      <Hero />
      <MachineUser />
      <FhirApiFeature />
      <FhirNative />
      <Marketplace />
      <Economics />
      <OpenSource />
      <ClosingCta />
    </>
  );
}

export default DevelopersPage;
