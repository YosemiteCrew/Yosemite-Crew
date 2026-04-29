'use client';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { Container } from 'react-bootstrap';
import { motion, Variants, useInView } from 'framer-motion';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

import './Footer.css';

const PLATFORM_STATUS_URL = 'https://yosemite-crew.openstatus.dev/';
const PLATFORM_STATUS_API_URL = 'https://api.openstatus.dev/public/status/yosemite-crew';

type PlatformStatus =
  | 'operational'
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage'
  | 'under_maintenance'
  | 'unknown'
  | 'incident';

type PlatformStatusState = {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
};

const platformStatusByValue: Record<PlatformStatus, PlatformStatusState> = {
  operational: { label: 'All systems operational', tone: 'success' },
  degraded_performance: { label: 'Degraded performance', tone: 'warning' },
  partial_outage: { label: 'Partial outage', tone: 'danger' },
  major_outage: { label: 'Major outage', tone: 'danger' },
  under_maintenance: { label: 'Under maintenance', tone: 'warning' },
  unknown: { label: 'Status unavailable', tone: 'neutral' },
  incident: { label: 'Active incident', tone: 'danger' },
};

const getPlatformStatusState = (status: unknown): PlatformStatusState => {
  if (typeof status !== 'string') return platformStatusByValue.unknown;
  return platformStatusByValue[status as PlatformStatus] ?? platformStatusByValue.unknown;
};

const footerLinks = [
  {
    title: 'Developers',
    links: [
      {
        label: 'Developer portal',
        href: '/developers/signup',
      },
      {
        label: 'Contributing',
        href: 'https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/CONTRIBUTING.md',
      },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Discord', href: 'https://discord.gg/yosemitecrew' },
      {
        label: 'GitHub',
        href: 'https://github.com/YosemiteCrew/Yosemite-Crew',
      },
      { label: 'Insights', href: '/insights' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Terms and conditions', href: '/terms-and-conditions' },
      { label: 'Privacy policy', href: '/privacy-policy' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Trust Center', href: '/trust-center' },
    ],
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.18,
    },
  },
};

const ftDivVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const Footer = () => {
  const footerRef = useRef(null);
  const inView = useInView(footerRef, { once: true, margin: '-100px' });
  const [platformStatus, setPlatformStatus] = useState<PlatformStatusState>(
    platformStatusByValue.unknown
  );

  useEffect(() => {
    let isMounted = true;

    globalThis
      .fetch(PLATFORM_STATUS_API_URL)
      .then((response) => {
        if (!response.ok) return { status: 'unknown' };
        return response.json() as Promise<{ status?: string }>;
      })
      .then((data) => {
        if (isMounted) setPlatformStatus(getPlatformStatusState(data.status));
      })
      .catch(() => {
        if (isMounted) setPlatformStatus(platformStatusByValue.unknown);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <motion.footer
      ref={footerRef}
      className="Footersec"
      aria-label="Site Footer"
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    >
      <Container>
        <div className="FooterData">
          <div className="FootTopData">
            <div className="leftFooter">
              <Link href={'/'}>
                <Image
                  aria-hidden
                  src={MEDIA_SOURCES.logo}
                  alt="Yosemite Crew Logo"
                  width={90}
                  height={83}
                />
              </Link>
              <div className="ClientLogo" aria-label="Certifications">
                <Image
                  aria-hidden
                  src={MEDIA_SOURCES.footer.gdpr}
                  alt="GDPR"
                  width={55}
                  height={56}
                  className="gdpr-footer"
                />
                <Image
                  aria-hidden
                  src={MEDIA_SOURCES.footer.soc2}
                  alt="SOC2"
                  width={56}
                  height={56}
                  className="soc-footer"
                />
                <Image
                  aria-hidden
                  src={MEDIA_SOURCES.footer.iso}
                  alt="ISO"
                  width={54}
                  height={60}
                  className="iso-footer"
                />
                <Image
                  aria-hidden
                  src={MEDIA_SOURCES.footer.fhir}
                  alt="FHIR"
                  width={117}
                  height={28}
                  className="fhir-footer"
                />
              </div>
            </div>
            <motion.nav
              className="RytFooter"
              aria-label="Footer Navigation"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {footerLinks.map((section) => (
                <motion.div className="FtDiv" key={section.title} variants={ftDivVariants}>
                  <div className="text-heading-3 text-text-tertiary">{section.title}</div>
                  <ul className="FtLinks">
                    {section.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          target={section.title === 'Company' ? '' : '_blank'}
                          className="text-body-4 text-text-tertiary"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.nav>
          </div>
          {/* <hr className="footer-divider" aria-hidden="true" /> */}
          <div className="Footer_Bottom">
            <div className="Bootom_Foot">
              <div className="text-body-4-emphasis text-text-secondary text-center footer-copy-primary">
                &copy; 2026 DuneXploration UG (haftungsbeschränkt)
              </div>
              <div className="text-body-4 text-text-secondary text-center footer-copy-secondary">
                DuneXploration UG (haftungsbeschränkt), Am Finther Weg 7, 55127 Mainz
                <br />
                email:{' '}
                <a
                  className="text-body-4 text-text-brand footer-copy-link"
                  href="mailto:support@yosemitecrew.com"
                >
                  support@yosemitecrew.com
                </a>{' '}
                , phone:{' '}
                <a
                  className="text-body-4 text-text-brand footer-copy-link"
                  href="tel:+4915227763275"
                >
                  +49 152 277 63275
                </a>
              </div>
              <div className="text-body-4 text-text-secondary text-center footer-copy-secondary">
                Geschaftsfuhrer: Ankit Upadhyay Amtsgericht Mainz unter HRB 52778, VAT: DE367920596
              </div>
              <div className="text-body-4 text-text-secondary text-center footer-copy-secondary">
                Yosemite Crew™ is a trademark of DuneXploration UG (haftungsbeschränkt) in the EU,
                Australia, Great Britain, India, New Zealand, and the USA.
              </div>
              <Link
                href={PLATFORM_STATUS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`platform-status-link platform-status-link-${platformStatus.tone}`}
              >
                <span className="platform-status-dot" aria-hidden="true" />
                <span>{platformStatus.label}</span>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </motion.footer>
  );
};

export default Footer;
