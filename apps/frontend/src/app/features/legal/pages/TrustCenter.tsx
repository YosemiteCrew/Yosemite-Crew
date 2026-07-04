'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  IoCheckmark,
  IoCreateOutline,
  IoSwapHorizontalOutline,
  IoFingerPrintOutline,
  IoRibbonOutline,
  IoMedkitOutline,
} from 'react-icons/io5';
import { LegalDoc } from '@/app/features/marketing/site';
import {
  trustCenterData,
  type Certification,
  type SecurityPillar,
  type Subprocessor,
} from './trustCenterData';

const { hero, toc, approachBadges, certifications, securityPillars, subProcessors } =
  trustCenterData;

const CARD_BG = '#faf7f1';

const CERT_ICONS = {
  'create-outline': IoCreateOutline,
  'swap-horizontal-outline': IoSwapHorizontalOutline,
  'finger-print-outline': IoFingerPrintOutline,
  'ribbon-outline': IoRibbonOutline,
  'medkit-outline': IoMedkitOutline,
} as const;

const H2_STYLE: CSSProperties = { fontFamily: 'var(--font-newsreader)' };

const getStatusPillStyle = (status: Certification['status']): CSSProperties => {
  const compliant = status === 'COMPLIANT';
  return {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: compliant ? '#006642' : '#af5e19',
    background: compliant ? '#e6f4ef' : '#fef3e9',
    padding: '4px 10px',
    borderRadius: 9999,
    whiteSpace: 'nowrap',
  };
};

function CertBadge({ cert }: Readonly<{ cert: Certification }>) {
  if (cert.badge) {
    return (
      <Image
        src={cert.badge}
        alt={cert.name}
        width={80}
        height={38}
        unoptimized
        style={{ height: 38, width: 'auto', objectFit: 'contain' }}
      />
    );
  }
  const Icon = cert.icon ? CERT_ICONS[cert.icon as keyof typeof CERT_ICONS] : undefined;
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: 11,
        background: cert.iconBg,
        color: cert.iconColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      {Icon ? <Icon size={21} aria-hidden /> : null}
    </span>
  );
}

function CertCard({ cert }: Readonly<{ cert: Certification }>) {
  return (
    <div
      style={{
        border: '1px solid #e5dccf',
        borderRadius: 18,
        padding: 20,
        background: CARD_BG,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minHeight: 40,
        }}
      >
        <CertBadge cert={cert} />
        <span style={getStatusPillStyle(cert.status)}>{cert.status}</span>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: '#1d1c1b' }}>
          {cert.name}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: '#8f8984', marginTop: 5 }}>
          {cert.description}
        </div>
      </div>
    </div>
  );
}

function PillarCard({ pillar }: Readonly<{ pillar: SecurityPillar }>) {
  return (
    <div
      style={{ border: '1px solid #e5dccf', borderRadius: 20, padding: 24, background: CARD_BG }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#1d1c1b',
          marginBottom: 14,
        }}
      >
        {pillar.title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {pillar.items.map((item) => (
          <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <IoCheckmark
              size={16}
              aria-hidden
              style={{ color: '#008f5d', flex: 'none', marginTop: 2 }}
            />
            <span style={{ fontSize: 14, lineHeight: 1.5, color: '#5c5956' }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubprocessorRow({ sub, first }: Readonly<{ sub: Subprocessor; first: boolean }>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 20px',
        borderTop: first ? undefined : '1px solid #e6ded1',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: '#1d1c1b' }}>
          {sub.name}
        </span>
        <span style={{ fontSize: 13, color: '#8f8984' }}>{sub.service}</span>
      </div>
      <span style={{ fontSize: 13, color: '#5c5956', whiteSpace: 'nowrap' }}>{sub.location}</span>
    </div>
  );
}

const TrustCenter = () => {
  return (
    <LegalDoc
      eyebrow={hero.eyebrow}
      title={hero.title}
      subtitle={hero.subtitle}
      meta={hero.meta}
      toc={toc}
    >
      <section id="approach">
        <h2 style={H2_STYLE}>Our approach to trust</h2>
        <p>
          A wall of badges is what a market builds after trust has failed. Real trust is built from
          evidence, so alongside the certifications below, the protections that matter most are
          structural: everything exports, records can&apos;t be quietly altered, and the whole
          codebase is public for anyone to audit.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
            alignItems: 'center',
            margin: '24px 0 4px',
          }}
        >
          {approachBadges.map((badge) => (
            <Image
              key={badge.alt}
              src={badge.src}
              alt={badge.alt}
              width={96}
              height={46}
              unoptimized
              style={{ height: 46, width: 'auto' }}
            />
          ))}
        </div>
      </section>

      <section id="certifications">
        <h2 style={H2_STYLE}>Certifications and standards</h2>
        <p>
          Where we hold a certification we say so, and where one is on the roadmap we say that too.
        </p>
        <div
          data-cert-grid="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: 14,
            margin: '8px 0 4px',
          }}
        >
          {certifications.map((cert) => (
            <CertCard key={cert.name} cert={cert} />
          ))}
        </div>
      </section>

      <section id="controls">
        <h2 style={H2_STYLE}>Security controls</h2>
        <p>Five layers, from how the company is run to how the code encrypts a record.</p>
        <div
          data-pillar-grid="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            margin: '8px 0 4px',
          }}
        >
          {securityPillars.map((pillar) => (
            <PillarCard key={pillar.title} pillar={pillar} />
          ))}
        </div>
      </section>

      <section id="residency">
        <h2 style={H2_STYLE}>Data residency and encryption</h2>
        <p>
          Your records stay in your region, under laws you agreed to. Self-host and the data never
          leaves your hardware; on our cloud it is hosted on AWS in Luxembourg and Google Cloud in
          the EU. Data is encrypted with AES-256 at rest and TLS 1.3 in transit.
        </p>
      </section>

      <section id="subprocessors">
        <h2 style={H2_STYLE}>Subprocessors</h2>
        <p>We keep the list short and current, and bind each with a data-processing agreement.</p>
        <div
          style={{
            border: '1px solid #e5dccf',
            borderRadius: 20,
            overflow: 'hidden',
            maxWidth: 700,
          }}
        >
          {subProcessors.map((sub, index) => (
            <SubprocessorRow key={sub.name} sub={sub} first={index === 0} />
          ))}
        </div>
      </section>

      <section id="resources">
        <h2 style={H2_STYLE}>Resources</h2>
        <p>
          Our SOC 2 Type I report (2025), ISO 27001 certificate and penetration-test summary are
          available under NDA. The Data Processing Agreement is part of our{' '}
          <Link href="/terms-and-conditions">terms</Link>.
        </p>
      </section>

      <section id="disclosure">
        <h2 style={H2_STYLE}>Responsible disclosure</h2>
        <p>
          Found a vulnerability? Email{' '}
          <a href="mailto:security@yosemitecrew.com">security@yosemitecrew.com</a> before disclosing
          publicly and we will work with you to fix it and credit you. Because the code is open,
          researchers can inspect it directly. Live status is at{' '}
          <a href="https://yosemite-crew.openstatus.dev/" target="_blank" rel="noopener">
            our status page
          </a>
          .
        </p>
      </section>
    </LegalDoc>
  );
};

export default TrustCenter;
