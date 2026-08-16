import { CERT_BADGES, type TocEntry } from '@/app/features/marketing/site';

export type CertStatus = 'COMPLIANT' | 'PLANNED';

export type Certification = {
  name: string;
  status: CertStatus;
  description: string;
  /** Either a badge image URL, or an ion-icon name rendered inside a tinted tile. */
  badge?: string;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
};

export type SecurityPillar = {
  title: string;
  items: string[];
};

export type Subprocessor = {
  name: string;
  service: string;
  location: string;
};

/** One-line builder for a certification rendered with a badge image. */
const cert = (
  name: string,
  status: CertStatus,
  description: string,
  badge: string
): Certification => ({ name, status, description, badge });

/** One-line builder for a certification rendered as a tinted ion-icon tile. */
const iconCert = (
  name: string,
  status: CertStatus,
  description: string,
  icon: string,
  iconBg: string,
  iconColor: string
): Certification => ({ name, status, description, icon, iconBg, iconColor });

export const trustCenterData = {
  hero: {
    eyebrow: 'Security',
    title: 'Security, privacy and compliance',
    subtitle:
      'Protecting the data of pet businesses and pet parents is our foundation, not a feature. We use enterprise-grade security so your data stays safe, compliant and available.',
    meta: 'Updated February 2026 · support@yosemitecrew.com',
  },

  toc: [
    { id: 'approach', label: 'Our approach to trust' },
    { id: 'certifications', label: 'Certifications and standards' },
    { id: 'controls', label: 'Security controls' },
    { id: 'residency', label: 'Data residency and encryption' },
    { id: 'subprocessors', label: 'Subprocessors' },
    { id: 'resources', label: 'Resources' },
    { id: 'disclosure', label: 'Responsible disclosure' },
  ] satisfies readonly TocEntry[],

  approachBadges: [
    { src: CERT_BADGES.gdpr, alt: 'GDPR' },
    { src: CERT_BADGES.soc2, alt: 'SOC 2' },
    { src: CERT_BADGES.iso, alt: 'ISO 27001' },
    { src: CERT_BADGES.fhir, alt: 'FHIR' },
    { src: CERT_BADGES.fda, alt: '21 CFR Part 11' },
  ],

  certifications: [
    cert('GDPR', 'COMPLIANT', 'Fully compliant data processing with EU hosting.', CERT_BADGES.gdpr),
    cert(
      'SOC 2 Type I',
      'COMPLIANT',
      'Audited security, availability and confidentiality controls.',
      CERT_BADGES.soc2
    ),
    cert(
      'ISO 27001:2022',
      'COMPLIANT',
      'Certified information-security management.',
      CERT_BADGES.iso
    ),
    cert(
      '21 CFR Part 11',
      'COMPLIANT',
      'FDA rules for electronic records and signatures.',
      CERT_BADGES.fda
    ),
    iconCert(
      'ESIGN Act',
      'COMPLIANT',
      'US federal law on the validity of e-signatures.',
      'create-outline',
      '#e6f2ff',
      '#257bed'
    ),
    iconCert(
      'UETA',
      'COMPLIANT',
      'US state law for electronic transactions.',
      'swap-horizontal-outline',
      '#f5f3ff',
      '#5b21b6'
    ),
    iconCert(
      'eIDAS (SES)',
      'COMPLIANT',
      'EU electronic identification, Level 1.',
      'finger-print-outline',
      '#e6f4ef',
      '#006642'
    ),
    iconCert(
      'ZertES',
      'PLANNED',
      'Swiss federal law on electronic signatures.',
      'ribbon-outline',
      '#fef3e9',
      '#af5e19'
    ),
    iconCert(
      'HIPAA',
      'PLANNED',
      'US protection for patient health information.',
      'medkit-outline',
      '#e6f2ff',
      '#257bed'
    ),
  ] satisfies readonly Certification[],

  securityPillars: [
    {
      title: 'Organizational security',
      items: [
        'ISMS aligned with ISO 27001:2022',
        'Annual risk assessments and DPIAs',
        'Strict vendor management, DPAs signed',
        'Regular internal security audits',
      ],
    },
    {
      title: 'People and internal security',
      items: [
        'Mandatory security and privacy training',
        'Background checks and NDAs for staff',
        'Quarterly access reviews',
        'Automated offboarding',
      ],
    },
    {
      title: 'Infrastructure security',
      items: [
        'Hosted on AWS (Luxembourg) and Google Cloud',
        'DDoS protection and WAF enabled',
        'Weekly automated vulnerability scanning',
        'Production isolated from testing',
      ],
    },
    {
      title: 'Product security',
      items: [
        'AES-256 encryption at rest',
        'TLS 1.3 encryption in transit',
        'Role-based access control (RBAC)',
        'Multi-factor authentication support',
      ],
    },
    {
      title: 'Data privacy and operations',
      items: [
        'Daily encrypted cross-region backups',
        'GDPR data-subject rights support',
        '24/7 incident-response monitoring',
        'Business continuity plan, 99.99% uptime target',
      ],
    },
  ] satisfies readonly SecurityPillar[],

  subProcessors: [
    {
      name: 'Amazon Web Services',
      service: 'Cloud infrastructure and storage',
      location: 'Luxembourg (EU)',
    },
    {
      name: 'Supabase, Inc.',
      service: 'Database hosting',
      location: 'Singapore',
    },
    {
      name: 'Google Cloud',
      service: 'Maps and analytics services',
      location: 'Ireland (EU)',
    },
    {
      name: 'PostHog',
      service: 'Product analytics (on consent)',
      location: 'EU',
    },
  ] satisfies readonly Subprocessor[],
} as const;
