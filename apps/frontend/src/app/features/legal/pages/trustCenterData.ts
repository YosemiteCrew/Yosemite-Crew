import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

export const trustCenterData = {
  hero: {
    title: 'Security, Privacy, and Compliance',
    subtitle:
      'At Yosemite Crew, protecting your veterinary pet businesses and pet parents data is not just a feature it’s our foundation. We use enterprise grade security to ensure your data is safe, compliant, and always available.',
    lastUpdated: 'February 2026',
    email: 'support@yosemitecrew.com',
    privacyLink: '/privacy-policy',
  },
  tabs: ['Overview', 'Resources', 'Controls', 'Subprocessors'],

  certifications: [
    {
      name: 'GDPR',
      status: 'Compliant',
      description: 'Fully compliant data processing with EU hosting.',
      icon: MEDIA_SOURCES.footer.gdpr,
    },
    {
      name: 'SOC 2 Type I',
      status: 'Compliant',
      description: 'Audited security, availability, and confidentiality controls.',
      icon: MEDIA_SOURCES.footer.soc2,
    },
    {
      name: 'ISO 27001',
      status: 'Compliant',
      description: 'Certified under ISO 27001:2022.',
      icon: MEDIA_SOURCES.footer.iso,
    },
    {
      name: '21 CFR Part 11',
      status: 'Compliant',
      description: 'FDA regulations for electronic records & signatures.',
      icon: '📜',
    },
    {
      name: 'ESIGN Act',
      status: 'Compliant',
      description: 'U.S. federal law ensuring validity of e-signatures.',
      icon: '🇺🇸',
    },
    {
      name: 'UETA',
      status: 'Compliant',
      description: 'U.S. state law for electronic transactions.',
      icon: '⚖️',
    },
    {
      name: 'eIDAS (SES)',
      status: 'Compliant',
      description: 'EU regulation for electronic identification (Level 1).',
      icon: '🇪🇺',
    },
    {
      name: 'ZertES',
      status: 'Planned',
      description: 'Swiss Federal law regulating electronic signatures.',
      icon: '🇨🇭',
    },
    {
      name: 'HIPAA',
      status: 'Planned',
      description: 'Protection for patient health information privacy.',
      icon: '🏥',
    },
  ],

  resources: [
    {
      id: 'res_soc2_2025',
      title: 'SOC 2 Type I Report (2025)',
      type: 'Audit Report',
      locked: true,
    },
    {
      id: 'res_iso_cert',
      title: 'ISO 27001 Certificate',
      type: 'Certificate',
      locked: true,
    },
    {
      id: 'res_pen_test',
      title: 'Penetration Test Summary (2025)',
      type: 'Security Report',
      locked: true,
    },
    {
      id: 'res_dpa',
      title: 'Data Processing Agreement (DPA)',
      type: 'Legal',
      locked: false,
      link: '/terms-and-conditions',
    },
  ],

  securityPillars: [
    {
      title: 'Organizational Security',
      description: 'Governance, risk management, and vendor compliance.',
      items: [
        'ISMS Framework aligned with ISO 27001:2022',
        'Annual Risk Assessments & DPIAs',
        'Strict Vendor Management (DPAs signed)',
        'Regular Internal Security Audits',
      ],
    },
    {
      title: 'People & Internal Security',
      description: 'Ensuring our team protects your data.',
      items: [
        'Mandatory Security & Privacy Training',
        'Background Checks & NDAs for all staff',
        'Quarterly Access Reviews',
        'Automated Offboarding Protocols',
      ],
    },
    {
      title: 'Infrastructure Security',
      description: 'Fortified cloud environment and network defense.',
      items: [
        'Hosted on AWS (Luxembourg) & Google Cloud',
        'DDoS Protection & WAF enabled',
        'Weekly Automated Vulnerability Scanning',
        'Production Isolated from Testing',
      ],
    },
    {
      title: 'Product Security',
      description: 'Security built into the application code.',
      items: [
        'AES-256 Encryption (At Rest)',
        'TLS 1.3 Encryption (In Transit)',
        'Role-Based Access Control (RBAC)',
        'Multi-Factor Authentication (MFA) Support',
      ],
    },
    {
      title: 'Data Privacy & Operations',
      description: 'Reliability, backups, and data rights.',
      items: [
        'Daily Encrypted Backups (Cross-region)',
        'GDPR Data Subject Rights Support',
        '24/7 Incident Response Monitoring',
        'Business Continuity Plan (BCDR)',
        '99.99% Uptime Target',
      ],
    },
  ],

  subProcessors: [
    {
      name: 'Amazon Web Services',
      service: 'Cloud Infrastructure & Storage',
      location: 'Luxembourg (EU)',
      logo: MEDIA_SOURCES.subProcessorLogos.aws,
    },
    {
      name: 'Supabase, Inc.',
      service: 'Database Hosting',
      location: 'Singapore',
      logo: MEDIA_SOURCES.subProcessorLogos.supabase,
    },
    {
      name: 'Google Cloud',
      service: 'Maps & Analytics Services',
      location: 'Ireland (EU)',
      logo: MEDIA_SOURCES.subProcessorLogos.gcp,
    },
  ],
};
