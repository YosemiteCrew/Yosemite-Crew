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
    {
      name: 'GDPR',
      status: 'COMPLIANT',
      description: 'Fully compliant data processing with EU hosting.',
      badge: CERT_BADGES.gdpr,
    },
    {
      name: 'SOC 2 Type I',
      status: 'COMPLIANT',
      description: 'Audited security, availability and confidentiality controls.',
      badge: CERT_BADGES.soc2,
    },
    {
      name: 'ISO 27001:2022',
      status: 'COMPLIANT',
      description: 'Certified information-security management.',
      badge: CERT_BADGES.iso,
    },
    {
      name: '21 CFR Part 11',
      status: 'COMPLIANT',
      description: 'FDA rules for electronic records and signatures.',
      badge: CERT_BADGES.fda,
    },
    {
      name: 'ESIGN Act',
      status: 'COMPLIANT',
      description: 'US federal law on the validity of e-signatures.',
      icon: 'create-outline',
      iconBg: '#e6f2ff',
      iconColor: '#257bed',
    },
    {
      name: 'UETA',
      status: 'COMPLIANT',
      description: 'US state law for electronic transactions.',
      icon: 'swap-horizontal-outline',
      iconBg: '#f5f3ff',
      iconColor: '#5b21b6',
    },
    {
      name: 'eIDAS (SES)',
      status: 'COMPLIANT',
      description: 'EU electronic identification, Level 1.',
      icon: 'finger-print-outline',
      iconBg: '#e6f4ef',
      iconColor: '#006642',
    },
    {
      name: 'ZertES',
      status: 'PLANNED',
      description: 'Swiss federal law on electronic signatures.',
      icon: 'ribbon-outline',
      iconBg: '#fef3e9',
      iconColor: '#af5e19',
    },
    {
      name: 'HIPAA',
      status: 'PLANNED',
      description: 'US protection for patient health information.',
      icon: 'medkit-outline',
      iconBg: '#e6f2ff',
      iconColor: '#257bed',
    },
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
