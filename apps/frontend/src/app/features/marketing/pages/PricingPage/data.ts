import type { PlanDTO } from '@/app/features/marketing/pages/PricingPage/types';

const COMMON_FEATURES = {
  SCHEDULER: 'Yosemite Crew scheduler',
  TEMPLATES: 'Templates module',
  DOC_SIGNING: 'Document e-signing portal',
  IDEX_INTEGRATION: 'IDEXX integration for lab tests and diagnostics',
  MERCK_INTEGRATION: 'MSD Veterinary Manual integration for veterinary clinical knowledge',
  CHAT: 'Internal + companion parent chat',
  SECURITY: 'Security & compliance integrations (SOC2, ISO 27001, GDPR)',
};

const row = (name: string, free: string, business: string) => ({ name, free, business });
const yesYes = (name: string) => row(name, 'yes', 'yes');
const noYes = (name: string) => row(name, 'no', 'yes');
const comingSoon = (name: string) => row(name, 'Coming soon', 'Coming soon');

/**
 * Offline USD defaults used when the `/v1/pricing` backend call has not yet
 * returned (or cannot run because consent has not been granted). Kept in
 * sync with the backend `PRICING_PLANS.USD` constant.
 */
export const FALLBACK_PLANS: PlanDTO[] = [
  {
    id: 'free',
    active: true,
    recommended: false,
    title: 'Free plan',
    amount: 0,
    amountYearly: 0,
    amountLabel: '',
    description: 'Perfect for new or small pet businesses exploring on their own.',
    buttonText: 'Get started',
    buttonSrc: '/signup',
    includes: [
      'Free for individual usage',
      '120 appointments',
      '200 observational tools',
      COMMON_FEATURES.SCHEDULER,
      COMMON_FEATURES.TEMPLATES,
      COMMON_FEATURES.DOC_SIGNING,
      COMMON_FEATURES.IDEX_INTEGRATION,
      COMMON_FEATURES.MERCK_INTEGRATION,
      COMMON_FEATURES.CHAT,
      COMMON_FEATURES.SECURITY,
    ],
  },
  {
    id: 'business',
    active: true,
    recommended: true,
    title: 'Business plan',
    amount: 13,
    amountYearly: 11,
    amountLabel: 'per user / month',
    description: 'Flexible growth for pet businesses that need to scale on demand.',
    buttonText: 'Get started',
    buttonSrc: '/signup',
    includes: [
      'Unlimited appointments',
      'Unlimited observational tools',
      COMMON_FEATURES.SCHEDULER,
      COMMON_FEATURES.TEMPLATES,
      COMMON_FEATURES.DOC_SIGNING,
      COMMON_FEATURES.IDEX_INTEGRATION,
      COMMON_FEATURES.MERCK_INTEGRATION,
      COMMON_FEATURES.CHAT,
      COMMON_FEATURES.SECURITY,
    ],
  },
  {
    id: 'enterprise',
    active: false,
    recommended: false,
    title: 'Enterprise plan',
    amount: null,
    amountYearly: null,
    amountLabel: '',
    description: 'For pet businesses to operate with scalability, control, and security.',
    buttonText: 'Notify me',
    buttonSrc: '#',
    includes: [
      'Unlimited usage',
      'Unlimited appointments',
      'Unlimited observational tools',
      COMMON_FEATURES.SCHEDULER,
      COMMON_FEATURES.TEMPLATES,
      COMMON_FEATURES.DOC_SIGNING,
      COMMON_FEATURES.IDEX_INTEGRATION,
      COMMON_FEATURES.MERCK_INTEGRATION,
      COMMON_FEATURES.CHAT,
      COMMON_FEATURES.SECURITY,
    ],
  },
];

const COMPLIANCE_TEXT = 'Fully compliant (SOC2, ISO 27001, GDPR)';

export const TableData = [
  {
    head: 'Operations',
    rows: [
      row('Appointments', '120', 'unlimited'),
      row('Observational tools', '200', 'unlimited'),
      yesYes('Companions management'),
      yesYes('Documents'),
      yesYes('Scheduler'),
      yesYes('Inventory management'),
      yesYes('Tasks management'),
      yesYes('Wellness management'),
      yesYes('Templates'),
      yesYes('Document e-signing'),
    ],
  },
  {
    head: 'Integrations & labs',
    rows: [
      yesYes('IDEXX integration'),
      yesYes('MSD Veterinary Manual integration'),
      row('RadAnalyzer integration', 'Coming soon', 'Coming soon'),
    ],
  },
  {
    head: 'Organisation',
    rows: [noYes('Department/Specialty'), noYes('Team Management'), noYes('Rooms')],
  },
  {
    head: 'Communication',
    rows: [
      yesYes('Internal Chats'),
      yesYes('Companion parent chat'),
      yesYes('Pet parent app'),
      yesYes('2-Way Messaging'),
      row('Support via Yosemite Crew', 'Community support', 'Dedicated Discord support'),
    ],
  },
  {
    head: 'Finance',
    rows: [
      yesYes('Financial Reporting & Analytics'),
      yesYes('Billing & Invoices'),
      yesYes('Payment Processing via stripe'),
    ],
  },
  {
    head: 'Infrastructure',
    rows: [
      row('Security and compliance', COMPLIANCE_TEXT, COMPLIANCE_TEXT),
      yesYes('Automatic updates'),
      row('Multiple Availability Zones', 'no', 'Coming soon'),
      yesYes('Audit trail (appointments)'),
      yesYes('Audit trail (document & template e-signing)'),
      comingSoon('Setup and maintenance'),
      comingSoon('Backup and recovery'),
      comingSoon('Uptime guarantee'),
    ],
  },
];
