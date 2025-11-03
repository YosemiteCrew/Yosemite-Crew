export type ContactTabId =
  | 'general'
  | 'feature'
  | 'data-subject'
  | 'complaint';

export interface ContactTab {
  id: ContactTabId;
  label: string;
  description: string;
  heroTitle?: string;
}

export const CONTACT_TABS: ContactTab[] = [
  {
    id: 'general',
    label: 'General enquiry',
    description: 'We’ll route your question to the right teammate.',
    heroTitle: "We're happy to help",
  },
  {
    id: 'feature',
    label: 'Feature request',
    description: 'Tell us what would make your experience even better.',
    heroTitle: "We're happy to help",
  },
  {
    id: 'data-subject',
    label: 'Data subject access request',
    description:
      'Submit a privacy request governed by the regulations that apply to you.',
    heroTitle: 'Protecting your privacy',
  },
  {
    id: 'complaint',
    label: 'Complaint',
    description: 'Share details so we can investigate and follow up quickly.',
    heroTitle: 'Resolved with care',
  },
];

export interface SelectOption {
  id: string;
  label: string;
}

export const DSAR_SUBMITTER_OPTIONS: SelectOption[] = [
  {
    id: 'self',
    label: 'The person, or the parent / guardian of the person',
  },
  {
    id: 'agent',
    label: 'An agent authorised by the consumer to make this request on their behalf',
  },
];

export const DSAR_LAW_OPTIONS: SelectOption[] = [
  {id: 'eu-gdpr', label: 'EU GDPR (General Data Protection Regulation)'},
  {
    id: 'uk-gdpr',
    label: 'UK GDPR / Data Protection Act 2018',
  },
  {
    id: 'ccpa',
    label: 'CCPA / CPRA (California Consumer Privacy Act)',
  },
  {
    id: 'lgpd',
    label: 'LGPD (Brazilian General Data Protection Law)',
  },
  {
    id: 'pipeda',
    label:
      'PIPEDA (Personal Information Protection and Electronic Documents Act, Canada)',
  },
  {
    id: 'popia',
    label: 'POPIA (Protection of Personal Information Act, South Africa)',
  },
  {
    id: 'pdpa',
    label: 'PDPA (Personal Data Protection Act, Singapore)',
  },
  {
    id: 'pipl',
    label: 'PIPL (Personal Information Protection Law, China)',
  },
  {
    id: 'privacy-act-au',
    label: 'Privacy Act 1988 (Australia)',
  },
  {
    id: 'other',
    label: 'Other (please specify)',
  },
];

export const DSAR_REQUEST_TYPES: SelectOption[] = [
  {id: 'know-collection', label: 'Know what information is being collected from you'},
  {id: 'delete-info', label: 'Have your information deleted'},
  {id: 'opt-out-sale', label: 'Opt-out of having your data sold to third-parties'},
  {id: 'access-info', label: 'Access your personal information'},
  {id: 'fix-inaccurate', label: 'Fix inaccurate information'},
  {id: 'receive-copy', label: 'Receive a copy of your personal information'},
  {
    id: 'opt-out-cross-context',
    label: 'Opt-out of having your data shared for cross-context behavioural advertising',
  },
  {
    id: 'limit-sensitive',
    label: 'Limit the use and disclosure of your sensitive personal information',
  },
  {
    id: 'other-request',
    label: 'Others (please specify in the comment box below)',
  },
];

export const CONFIRMATION_CHECKBOXES: SelectOption[] = [
  {
    id: 'accuracy',
    label: 'Under penalty of perjury, I declare all the above information to be true and accurate.',
  },
  {
    id: 'irreversible',
    label:
      'I understand that the deletion or restriction of my personal data is irreversible and may result in the termination of services with Yosemite Crew.',
  },
  {
    id: 'contact',
    label:
      'I understand that I will be required to validate my request via email, and I may be contacted in order to complete the request.',
  },
];
