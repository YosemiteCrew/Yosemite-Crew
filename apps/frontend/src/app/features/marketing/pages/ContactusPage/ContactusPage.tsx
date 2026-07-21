'use client';

import React, { useId, useState, type CSSProperties } from 'react';
import { TicketCategory } from '@yosemite-crew/types';
import { isEmail } from 'validator';
import axios from 'axios';
import {
  IoAtOutline,
  IoCallOutline,
  IoLogoDiscord,
  IoBusinessOutline,
  IoAlertCircleOutline,
  IoArrowForwardOutline,
  IoCheckmarkCircle,
} from 'react-icons/io5';

import {
  useMagnet,
  HeroGlow,
  InkAnnotate,
  DISCORD_INVITE_URL,
} from '@/app/features/marketing/site';
import { postData } from '@/app/services/axios';

const NEWSREADER = 'var(--font-newsreader)';
const EASE = 'cubic-bezier(0.16,1,0.3,1)';

const CONTACT_TYPE_MAP: Record<TicketCategory, string> = {
  'General Enquiry': 'GENERAL_ENQUIRY',
  'Feature Request': 'FEATURE_REQUEST',
  'Data Service Access Request': 'DSAR',
  Complaint: 'COMPLAINT',
  Technical: 'GENERAL_ENQUIRY',
  Billing: 'GENERAL_ENQUIRY',
};

type DsraRequesterType = 'SELF' | 'PARENT_GUARDIAN' | 'AUTHORIZED_AGENT';
type DsraLawBasis =
  | 'GDPR'
  | 'CCPA'
  | 'UK_GDPR'
  | 'LGPD'
  | 'PIPEDA'
  | 'POPIA'
  | 'PDPA'
  | 'PIPL'
  | 'PA_1988_AU'
  | 'OTHER';
type DsraRight =
  | 'KNOW_INFORMATION_COLLECTED'
  | 'ACCESS_PERSONAL_INFORMATION'
  | 'DELETE_DATA'
  | 'RECTIFY_INACCURATE_INFORMATION'
  | 'RESTRICT_PROCESSING'
  | 'PORTABILITY_COPY'
  | 'OPT_OUT_SELLING_SHARING'
  | 'LIMIT_SENSITIVE_PROCESSING'
  | 'OTHER';
type FormErrors = { [key: string]: string };
type ContactPayload = {
  type: string;
  message: string;
  fullName: string;
  email: string;
  source: 'PMS_WEB';
  phone?: string;
  dsarDetails?: {
    requesterType: DsraRequesterType;
    lawBasis: DsraLawBasis;
    rightsRequested: DsraRight[];
    declarationAccepted: boolean;
    otherLawText?: string;
    otherRightText?: string;
  };
};

type Option = {
  value: string;
  label: string;
};

const queryTypes: TicketCategory[] = [
  'General Enquiry',
  'Feature Request',
  'Data Service Access Request',
  'Complaint',
];

const subrequestOptions: { label: string; value: DsraRequesterType }[] = [
  {
    value: 'SELF',
    label: 'The person whose name appears above',
  },
  {
    value: 'PARENT_GUARDIAN',
    label: 'The parent / guardian of the person whose name appears above',
  },
  {
    value: 'AUTHORIZED_AGENT',
    label: 'An agent authorized by the consumer to make this request on their behalf',
  },
];

const requestOptions: { label: string; value: DsraRight }[] = [
  {
    label: 'Know what information is being collected from you',
    value: 'KNOW_INFORMATION_COLLECTED',
  },
  {
    label: 'Have your information deleted',
    value: 'DELETE_DATA',
  },
  {
    label: 'Opt-out of having your data sold to third-parties',
    value: 'OPT_OUT_SELLING_SHARING',
  },
  {
    label: 'Opt-in to the sale of your personal data to third-parties',
    value: 'OTHER',
  },
  {
    label: 'Access your personal information',
    value: 'ACCESS_PERSONAL_INFORMATION',
  },
  {
    label: 'Fix inaccurate information',
    value: 'RECTIFY_INACCURATE_INFORMATION',
  },
  {
    label: 'Receive a copy of your personal information',
    value: 'PORTABILITY_COPY',
  },
  {
    label: 'Opt-out of having your data shared for cross-context behavioral advertising',
    value: 'OPT_OUT_SELLING_SHARING',
  },
  {
    label: 'Limit the use and disclosure of your sensitive personal information',
    value: 'LIMIT_SENSITIVE_PROCESSING',
  },
  {
    label: 'Others (please specify in the comment box below)',
    value: 'OTHER',
  },
];

const areaOptions: Option[] = [
  {
    value: 'GDPR',
    label: 'EU GDPR (General Data Protection Regulation)',
  },
  {
    value: 'UK_GDPR',
    label: 'UK GDPR / Data Protection Act 2018',
  },
  {
    value: 'CCPA',
    label: 'CCPA / CPRA (California Consumer Privacy Act)',
  },
  {
    value: 'LGPD',
    label: 'LGPD (Brazilian General Data Protection Law)',
  },
  {
    value: 'PIPEDA',
    label: 'PIPEDA (Personal Information Protection and Electronic Documents Act, Canada)',
  },
  {
    value: 'POPIA',
    label: 'POPIA (Protection of Personal Information Act, South Africa)',
  },
  {
    value: 'PDPA',
    label: 'PDPA (Personal Data Protection Act, Singapore)',
  },
  {
    value: 'PIPL',
    label: 'PIPL (Personal Information Protection Law, China)',
  },
  {
    value: 'PA_1988_AU',
    label: 'Privacy Act 1988 (Australia)',
  },
  {
    value: 'OTHER',
    label: 'Other',
  },
];

const confirmOptions = [
  'Under penalty of perjury, I declare all the above information to be true and accurate.',
  'I understand that the deletion or restriction of my personal data is irreversible and may result in the termination of services with Yosemite Crew.',
  'I understand that I will be required to validate my request my email, and I may be contacted in order to complete the request.',
];

const isValidEmail = (email: string): boolean => isEmail(email);

const getDsarLawBasis = (selectedArea: string): DsraLawBasis =>
  (areaOptions.find((option) => option.value === selectedArea)?.value as DsraLawBasis) || 'OTHER';

/* ---------- shared style bits ---------- */

const fieldGroup: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7 };

const groupBlock: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };

const errorLine: CSSProperties = {
  color: 'var(--color-danger-600, #d53225)',
  fontSize: 14,
  marginTop: 4,
  letterSpacing: '-0.01em',
};

const optionRow: CSSProperties = {
  display: 'flex',
  gap: 11,
  alignItems: 'flex-start',
  cursor: 'pointer',
  fontSize: 13.5,
  lineHeight: 1.5,
  color: 'var(--ink-muted)',
  letterSpacing: '-0.01em',
};

const controlStyle: CSSProperties = {
  flex: 'none',
  width: 18,
  height: 18,
  marginTop: 1,
  accentColor: 'var(--blue)',
  cursor: 'pointer',
};

const groupHeading: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: 'var(--ink-body)',
};

const CHANNEL_CARD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  textDecoration: 'none',
  padding: '15px 18px',
  background: 'var(--surface-soft)',
  border: '1px solid var(--hairline)',
  borderRadius: 18,
  transition: 'border-color 200ms, background 200ms, transform 200ms',
};

const CHANNEL_ICON_STYLE: CSSProperties = {
  flex: 'none',
  width: 42,
  height: 42,
  borderRadius: 12,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const SUBMIT_BUTTON_STYLE: CSSProperties = {
  marginTop: 2,
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: 'var(--cta)',
  color: 'var(--cta-text)',
  fontSize: 16,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '15px 24px',
  border: 'none',
  borderRadius: 9999,
  boxShadow: '0 12px 26px var(--sh16)',
};

const HERO_GRID_STYLE: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1140px, 100%)',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: '0.82fr 1.18fr',
  gap: 'clamp(36px, 5vw, 72px)',
  alignItems: 'start',
};

const HERO_BADGE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  borderRadius: 9999,
  border: '1px solid var(--hairline)',
  background: 'var(--glass-95)',
  backdropFilter: 'blur(40px)',
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  color: 'var(--ink-muted)',
  animation: `ycHeroUp 0.9s ${EASE} 0.05s both`,
};

const FORM_STYLE: CSSProperties = {
  background: 'var(--screen)',
  border: '1px solid var(--hairline)',
  borderRadius: 28,
  boxShadow: '0 30px 70px var(--sh09)',
  padding: 'clamp(26px, 3.2vw, 40px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 22,
};

const VISUALLY_HIDDEN_INPUT_STYLE: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  border: 0,
};

const requiredMark = (
  <span aria-hidden="true" style={{ color: '#d53225' }}>
    {' '}
    *
  </span>
);

/* ---------- shared checkbox / radio option row ---------- */

interface OptionRowProps {
  type: 'radio' | 'checkbox';
  name: string;
  control: CSSProperties;
  ariaLabel: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}

function OptionRow({
  type,
  name,
  control,
  ariaLabel,
  value,
  checked,
  onChange,
  label,
}: Readonly<OptionRowProps>) {
  return (
    <label style={optionRow}>
      <input
        type={type}
        name={name}
        style={control}
        aria-label={ariaLabel}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}

/* ---------- contact channel card (left column) ---------- */

interface ChannelProps {
  href: string;
  external?: boolean;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  icon: React.ReactNode;
  kicker: string;
  label: string;
}

function ChannelCard({
  href,
  external,
  iconBg,
  iconBorder,
  iconColor,
  icon,
  kicker,
  label,
}: Readonly<ChannelProps>) {
  const externalProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <a href={href} {...externalProps} style={CHANNEL_CARD_STYLE}>
      <span
        style={{
          ...CHANNEL_ICON_STYLE,
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          color: iconColor,
        }}
      >
        {icon}
      </span>
      <div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', letterSpacing: '-0.01em' }}>
          {kicker}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ink-body)',
            letterSpacing: '-0.02em',
          }}
        >
          {label}
        </div>
      </div>
    </a>
  );
}

/* ---------- native field helpers (keep accessible labels stable) ---------- */

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  error,
}: Readonly<TextFieldProps>) {
  const fieldId = useId();
  return (
    <div style={fieldGroup}>
      <label className="yc-lbl" htmlFor={fieldId}>
        {label}
        {required ? requiredMark : null}
      </label>
      <input
        id={fieldId}
        className="yc-field"
        type={type}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <div style={errorLine}>{error}</div> : null}
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minHeight?: number;
  error?: string;
}

function TextAreaField({
  label,
  ariaLabel,
  value,
  onChange,
  placeholder,
  required,
  minHeight,
  error,
}: Readonly<TextAreaFieldProps>) {
  const fieldId = useId();
  const style: CSSProperties = {
    resize: 'vertical',
    minHeight: minHeight ?? 116,
    lineHeight: 1.5,
  };
  return (
    <div style={fieldGroup}>
      <label className="yc-lbl" htmlFor={fieldId}>
        {label}
        {required ? requiredMark : null}
      </label>
      <textarea
        id={fieldId}
        className="yc-field"
        style={style}
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <div style={errorLine}>{error}</div> : null}
    </div>
  );
}

/* ---------- form value + setter bundles (threaded from ContactusPage) ---------- */

type ContactFormValues = {
  selectedQueryType: TicketCategory;
  fullName: string;
  email: string;
  phone: string;
  message: string;
  area: string;
  subselectedRequest: DsraRequesterType | '';
  selectedRequest: string;
  confirmSelections: string[];
  complaintLink: string;
  complaintImage: File | null;
};

type ContactFormSetters = {
  setSelectedQueryType: React.Dispatch<React.SetStateAction<TicketCategory>>;
  setFullName: React.Dispatch<React.SetStateAction<string>>;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  setArea: React.Dispatch<React.SetStateAction<string>>;
  setSubselectedRequest: React.Dispatch<React.SetStateAction<DsraRequesterType | ''>>;
  setSelectedRequest: React.Dispatch<React.SetStateAction<string>>;
  setComplaintLink: React.Dispatch<React.SetStateAction<string>>;
  setComplaintImage: React.Dispatch<React.SetStateAction<File | null>>;
};

type ConfirmBundle = {
  selections: string[];
  onToggle: (option: string) => void;
};

/* ---------- pure helpers hoisted out of the component ---------- */

const getTabStyle = (active: boolean): CSSProperties => ({
  flex: '1 1 auto',
  minWidth: 0,
  textAlign: 'center',
  cursor: 'pointer',
  fontSize: 13.5,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  padding: '10px 10px',
  borderRadius: 12,
  whiteSpace: 'nowrap',
  transition: 'background 200ms, color 200ms, box-shadow 200ms',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: active ? 'var(--pill-raised)' : 'transparent',
  color: active ? 'var(--ink)' : 'var(--ink-muted)',
  boxShadow: active ? '0 2px 8px var(--sh10)' : 'none',
});

const validateContactForm = (fullName: string, email: string, message: string): FormErrors => {
  const newErrors: FormErrors = {};
  if (!fullName.trim()) newErrors.fullName = 'Full name is required';
  if (!message.trim()) newErrors.message = 'Message is required';
  if (!email.trim()) {
    newErrors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    newErrors.email = 'Invalid email address';
  }
  return newErrors;
};

const buildDsarDetails = (
  area: string,
  subselectedRequest: DsraRequesterType | '',
  selectedRequest: string,
  confirmSelections: string[]
): ContactPayload['dsarDetails'] => {
  const lawBasis = getDsarLawBasis(area);
  const selectedAreaOption = areaOptions.find((option) => option.value === area);
  const selectedRightOption = requestOptions.find((option) => option.label === selectedRequest);

  return {
    requesterType: subselectedRequest as DsraRequesterType,
    lawBasis,
    rightsRequested: selectedRightOption ? [selectedRightOption.value] : [],
    declarationAccepted: confirmSelections.length === confirmOptions.length,
    ...(lawBasis === 'OTHER' && selectedAreaOption?.label
      ? { otherLawText: selectedAreaOption.label }
      : {}),
    ...(selectedRightOption?.value === 'OTHER' && selectedRightOption.label
      ? { otherRightText: selectedRightOption.label }
      : {}),
  };
};

const buildPayload = (values: ContactFormValues): ContactPayload => {
  const payload: ContactPayload = {
    type: CONTACT_TYPE_MAP[values.selectedQueryType],
    message: values.message.trim(),
    fullName: values.fullName.trim(),
    email: values.email.trim(),
    source: 'PMS_WEB',
  };

  if (values.phone.trim()) payload.phone = values.phone.trim();
  if (values.selectedQueryType === 'Data Service Access Request') {
    payload.dsarDetails = buildDsarDetails(
      values.area,
      values.subselectedRequest,
      values.selectedRequest,
      values.confirmSelections
    );
  }

  return payload;
};

const computeSubmitDisabled = (submitting: boolean, values: ContactFormValues): boolean => {
  const allConfirmed = values.confirmSelections.length === confirmOptions.length;
  const isComplaintValid = Boolean(
    values.fullName && values.email && values.message && values.subselectedRequest && allConfirmed
  );
  const isGeneralValid = Boolean(values.fullName && values.email && values.message);
  const isDSARValid = Boolean(
    values.fullName &&
    values.email &&
    values.message &&
    values.subselectedRequest &&
    values.area &&
    values.selectedRequest &&
    allConfirmed
  );
  const { selectedQueryType } = values;

  return (
    submitting ||
    (selectedQueryType === 'Complaint' && !isComplaintValid) ||
    (selectedQueryType === 'Data Service Access Request' && !isDSARValid) ||
    ((selectedQueryType === 'General Enquiry' || selectedQueryType === 'Feature Request') &&
      !isGeneralValid)
  );
};

/* ---------- left column: hero copy + contact channels ---------- */

function ContactHero() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        paddingTop: 8,
      }}
    >
      <div style={HERO_BADGE_STYLE}>
        <span
          aria-hidden="true"
          style={{ width: 7, height: 7, borderRadius: 9999, background: 'var(--success)' }}
        />
        {'A person reads every message'}
      </div>
      <h1
        style={{
          margin: '24px 0 0',
          fontFamily: NEWSREADER,
          fontSize: 'clamp(40px, 5.2vw, 72px)',
          fontWeight: 500,
          lineHeight: 1.03,
          letterSpacing: '-0.06em',
          color: 'var(--ink)',
          textWrap: 'balance',
        }}
      >
        Talk to a{' '}
        <em style={{ fontStyle: 'italic', fontWeight: 480, color: 'var(--blue-text)' }}>
          <InkAnnotate type="circle" delay={800}>
            human.
          </InkAnnotate>
        </em>
      </h1>
      <p
        style={{
          margin: '22px 0 0',
          maxWidth: 420,
          fontSize: 18,
          lineHeight: 1.6,
          letterSpacing: '-0.02em',
          color: 'var(--ink-muted)',
          animation: `ycHeroUp 1s ${EASE} 0.5s both`,
          textWrap: 'pretty',
        }}
      >
        Run a clinic, live with a house full of animals, or want to build on the platform. Tell us
        which, and it reaches the right desk, not a queue.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginTop: 34,
          width: '100%',
          animation: `ycHeroUp 1s ${EASE} 0.62s both`,
        }}
      >
        <ChannelCard
          href="mailto:support@yosemitecrew.com"
          iconBg="rgba(37,123,237,0.10)"
          iconBorder="rgba(37,123,237,0.18)"
          iconColor="var(--blue)"
          icon={<IoAtOutline aria-hidden="true" style={{ fontSize: 22 }} />}
          kicker="Email"
          label="support@yosemitecrew.com"
        />
        <ChannelCard
          href="tel:+4915227763275"
          iconBg="rgba(0,143,93,0.10)"
          iconBorder="rgba(0,143,93,0.18)"
          iconColor="var(--success)"
          icon={<IoCallOutline aria-hidden="true" style={{ fontSize: 20 }} />}
          kicker="Phone"
          label="+49 152 277 63275"
        />
        <ChannelCard
          href={DISCORD_INVITE_URL}
          external
          iconBg="rgba(88,101,242,0.12)"
          iconBorder="rgba(88,101,242,0.22)"
          iconColor="#5865F2"
          icon={<IoLogoDiscord aria-hidden="true" style={{ fontSize: 20 }} />}
          kicker="Community"
          label="Join the Discord"
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            padding: '6px 18px 0',
          }}
        >
          <span
            style={{
              flex: 'none',
              width: 42,
              display: 'flex',
              justifyContent: 'center',
              color: 'var(--ink-faint2)',
              paddingTop: 2,
            }}
          >
            <IoBusinessOutline aria-hidden="true" style={{ fontSize: 18 }} />
          </span>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: 'var(--ink-faint)',
              letterSpacing: '-0.01em',
            }}
          >
            DuneXploration UG (haftungsbeschränkt)
            <br />
            Am Finther Weg 7, 55127 Mainz, Germany
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- query-type selector ---------- */

interface ContactTypeSelectorProps {
  selectedQueryType: TicketCategory;
  onSelect: (type: TicketCategory) => void;
}

function ContactTypeSelector({ selectedQueryType, onSelect }: Readonly<ContactTypeSelectorProps>) {
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--ink-body)',
          marginBottom: 10,
        }}
      >
        What brings you here?
      </div>
      <div
        role="radiogroup"
        aria-label="What brings you here?"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          background: 'var(--inset)',
          padding: 5,
          borderRadius: 16,
        }}
      >
        {queryTypes.map((type) => (
          <label key={type} style={getTabStyle(selectedQueryType === type)}>
            <input
              type="radio"
              name="queryType"
              aria-label={type}
              value={type}
              checked={selectedQueryType === type}
              onChange={() => onSelect(type)}
              style={VISUALLY_HIDDEN_INPUT_STYLE}
            />
            {type}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ---------- name / email / phone fields ---------- */

interface IdentityFieldsProps {
  values: ContactFormValues;
  setters: ContactFormSetters;
  errors: FormErrors;
}

function IdentityFields({ values, setters, errors }: Readonly<IdentityFieldsProps>) {
  return (
    <>
      <div data-two style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TextField
          label="Full Name"
          value={values.fullName}
          onChange={setters.setFullName}
          placeholder="Lena Weber"
          required
          error={errors?.fullName}
        />
        <TextField
          label="Enter Email Address"
          type="email"
          value={values.email}
          onChange={setters.setEmail}
          placeholder="you@example.com"
          required
          error={errors?.email}
        />
      </div>

      <TextField
        label="Phone number (optional)"
        type="tel"
        value={values.phone}
        onChange={setters.setPhone}
        placeholder="+49 …"
      />
    </>
  );
}

/* ---------- general enquiry / feature request message ---------- */

interface GeneralEnquiryFieldsProps {
  message: string;
  onMessage: (v: string) => void;
  error?: string;
}

function GeneralEnquiryFields({ message, onMessage, error }: Readonly<GeneralEnquiryFieldsProps>) {
  return (
    <div className="yc-group" style={groupBlock}>
      <TextAreaField
        label="Please leave details regarding your request"
        ariaLabel="Request details"
        value={message}
        onChange={onMessage}
        placeholder="Your Message"
        required
        error={error}
      />
    </div>
  );
}

/* ---------- "submitting this as" radio group ---------- */

interface SubmitAsGroupProps {
  name: string;
  heading: string;
  selected: DsraRequesterType | '';
  onSelect: (value: DsraRequesterType) => void;
}

function SubmitAsGroup({ name, heading, selected, onSelect }: Readonly<SubmitAsGroupProps>) {
  return (
    <div style={groupBlock}>
      <div style={groupHeading}>{heading}</div>
      {subrequestOptions.map((option) => (
        <OptionRow
          key={option.value}
          type="radio"
          name={name}
          control={controlStyle}
          ariaLabel={
            name === 'complaintSubmitAs'
              ? `Submit complaint as ${option.label}`
              : `Submit data service access request as ${option.label}`
          }
          value={option.value}
          checked={selected === option.value}
          onChange={() => onSelect(option.value)}
          label={option.label}
        />
      ))}
    </div>
  );
}

/* ---------- "I confirm that" checklist ---------- */

interface ConfirmChecklistProps {
  name: string;
  selections: string[];
  onToggle: (option: string) => void;
}

function ConfirmChecklist({ name, selections, onToggle }: Readonly<ConfirmChecklistProps>) {
  return (
    <div style={groupBlock}>
      <div style={groupHeading}>I confirm that</div>
      {confirmOptions.map((option) => (
        <OptionRow
          key={option}
          type="checkbox"
          name={name}
          control={{ ...controlStyle, borderRadius: 6 }}
          ariaLabel={`Confirm ${option}`}
          value={option}
          checked={selections.includes(option)}
          onChange={() => onToggle(option)}
          label={option}
        />
      ))}
    </div>
  );
}

/* ---------- submit button ---------- */

interface SubmitButtonProps {
  submitRef: React.Ref<HTMLButtonElement>;
  onSubmit: () => void;
  disabled: boolean;
  label: string;
}

function SubmitButton({ submitRef, onSubmit, disabled, label }: Readonly<SubmitButtonProps>) {
  return (
    <button
      ref={submitRef}
      type="button"
      onClick={onSubmit}
      disabled={disabled}
      className="yc-btn-primary"
      style={{
        ...SUBMIT_BUTTON_STYLE,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {label}
      <IoArrowForwardOutline aria-hidden="true" style={{ fontSize: 17 }} />
    </button>
  );
}

/* ---------- inline submit error ---------- */

function SubmitError({ message }: Readonly<{ message: string }>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        color: '#d53225',
        letterSpacing: '-0.01em',
      }}
    >
      <IoAlertCircleOutline aria-hidden="true" style={{ fontSize: 17, flex: 'none' }} />
      {message}
    </div>
  );
}

/* ---------- privacy footnote ---------- */

function PrivacyNote() {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 12.5,
        lineHeight: 1.5,
        color: 'var(--ink-faint2)',
        textAlign: 'center',
        letterSpacing: '-0.01em',
      }}
    >
      We use your details only to handle this request. No lists, no selling, no noise.
    </p>
  );
}

/* ---------- Data Service Access Request section ---------- */

interface DsarFieldsProps {
  values: ContactFormValues;
  setters: ContactFormSetters;
  errors: FormErrors;
  confirm: ConfirmBundle;
  submit: SubmitButtonProps;
}

function DsarFields({ values, setters, errors, confirm, submit }: Readonly<DsarFieldsProps>) {
  return (
    <div className="yc-group" style={groupBlock}>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          letterSpacing: '-0.01em',
          color: 'var(--ink-muted)',
          background: 'var(--inset)',
          borderRadius: 14,
          padding: '14px 16px',
        }}
      >
        Under the GDPR you can access, correct, export, restrict or delete your personal data, or
        object to how it is used. We verify identity before acting and respond within one month.
      </div>

      <SubmitAsGroup
        name="dsarSubmitAs"
        heading="You are submitting this request as"
        selected={values.subselectedRequest}
        onSelect={setters.setSubselectedRequest}
      />

      <div style={groupBlock}>
        <label className="yc-lbl" htmlFor="dsar-area">
          Under the rights of which law are you making this request?
          {requiredMark}
        </label>
        <select
          id="dsar-area"
          className="yc-field"
          data-testid="dynamic-select"
          aria-label="Under the rights of which law are you making this request?"
          value={values.area}
          onChange={(e) => setters.setArea(e.target.value)}
        >
          <option value="">Select one</option>
          {areaOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={groupBlock}>
        <div style={groupHeading}>You are submitting this request to</div>
        {requestOptions.map((option) => (
          <OptionRow
            key={option.label}
            type="radio"
            name="dsarRequestTo"
            control={controlStyle}
            ariaLabel={`Submit data service access request to ${option.label}`}
            value={option.value}
            checked={values.selectedRequest === option.label}
            onChange={() => setters.setSelectedRequest(option.label)}
            label={option.label}
          />
        ))}
      </div>

      <TextAreaField
        label="Please leave details regarding your action request or question"
        ariaLabel="Data service access request details"
        value={values.message}
        onChange={setters.setMessage}
        placeholder="Your Message"
        minHeight={90}
        error={errors?.message}
      />

      <ConfirmChecklist
        name="confirmDsar"
        selections={confirm.selections}
        onToggle={confirm.onToggle}
      />

      <SubmitButton {...submit} />
    </div>
  );
}

/* ---------- Complaint section ---------- */

interface ComplaintFieldsProps {
  values: ContactFormValues;
  setters: ContactFormSetters;
  errors: FormErrors;
  confirm: ConfirmBundle;
  submit: SubmitButtonProps;
}

function ComplaintFields({
  values,
  setters,
  errors,
  confirm,
  submit,
}: Readonly<ComplaintFieldsProps>) {
  const hasComplaintImage = values.complaintImage !== null;

  return (
    <div className="yc-group" style={groupBlock}>
      <SubmitAsGroup
        name="complaintSubmitAs"
        heading="You are submitting this complaint as"
        selected={values.subselectedRequest}
        onSelect={setters.setSubselectedRequest}
      />

      <TextAreaField
        label="Please leave details regarding your complaint."
        ariaLabel="Complaint details"
        value={values.message}
        onChange={setters.setMessage}
        placeholder="Your Message"
        error={errors?.message}
      />

      <div style={groupBlock}>
        <div style={groupHeading}>Please add link regarding your complaint (optional)</div>
        <TextField
          label="Paste link (optional)"
          value={values.complaintLink}
          onChange={setters.setComplaintLink}
          placeholder="Paste link (optional)"
        />
      </div>

      <div style={groupBlock}>
        <div style={groupHeading}>Please add image regarding your complaint (optional)</div>
        <input
          id="complaintImage"
          type="file"
          accept="image/*"
          aria-label="Upload Image"
          onChange={(e) => setters.setComplaintImage(e.target.files?.[0] || null)}
          style={{
            fontSize: 13,
            color: 'var(--ink-muted)',
          }}
        />
        {hasComplaintImage ? (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--ink-faint)',
              letterSpacing: '-0.01em',
            }}
          >
            {values.complaintImage?.name}
          </div>
        ) : null}
      </div>

      <ConfirmChecklist
        name="confirmComplaint"
        selections={confirm.selections}
        onToggle={confirm.onToggle}
      />

      <SubmitButton {...submit} />
    </div>
  );
}

/* ---------- success confirmation (replaces the form after a send) ---------- */

const SUCCESS_CARD_STYLE: CSSProperties = {
  ...FORM_STYLE,
  alignItems: 'center',
  textAlign: 'center',
  gap: 16,
};

const SUCCESS_ICON_STYLE: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,143,93,0.12)',
  color: 'var(--success)',
};

const SUCCESS_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontFamily: NEWSREADER,
  fontSize: 26,
  fontWeight: 500,
  letterSpacing: '-0.03em',
  color: 'var(--ink)',
};

const SUCCESS_TEXT_STYLE: CSSProperties = {
  margin: 0,
  maxWidth: 360,
  fontSize: 15,
  lineHeight: 1.55,
  letterSpacing: '-0.01em',
  color: 'var(--ink-muted)',
};

const SUCCESS_BUTTON_STYLE: CSSProperties = { ...SUBMIT_BUTTON_STYLE, cursor: 'pointer' };

function ContactSuccess({ onReset }: Readonly<{ onReset: () => void }>) {
  return (
    <div style={{ animation: `ycHeroUp 1s ${EASE} 0.4s both` }}>
      <div role="status" aria-live="polite" style={SUCCESS_CARD_STYLE}>
        <span aria-hidden="true" style={SUCCESS_ICON_STYLE}>
          <IoCheckmarkCircle style={{ fontSize: 32 }} />
        </span>
        <h2 style={SUCCESS_TITLE_STYLE}>Message sent</h2>
        <p style={SUCCESS_TEXT_STYLE}>
          Thanks. A person reads every message, and we&apos;ll reply to your email shortly. Check
          your spam folder if you don&apos;t hear back.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="yc-btn-primary"
          style={SUCCESS_BUTTON_STYLE}
        >
          Send another message
          <IoArrowForwardOutline aria-hidden="true" style={{ fontSize: 17 }} />
        </button>
      </div>
    </div>
  );
}

/* ---------- right column: the contact form ---------- */

interface ContactFormProps {
  values: ContactFormValues;
  setters: ContactFormSetters;
  errors: FormErrors;
  confirm: ConfirmBundle;
  submit: SubmitButtonProps;
}

function ContactForm({ values, setters, errors, confirm, submit }: Readonly<ContactFormProps>) {
  const { selectedQueryType } = values;
  const isGeneralOrFeature =
    selectedQueryType === 'General Enquiry' || selectedQueryType === 'Feature Request';

  /**
   * React 19 form action. The submit handler owns its own error handling, so the
   * action only has to trigger it and must not hand its result back to React.
   */
  const handleFormAction = () => {
    submit.onSubmit();
  };

  return (
    <div style={{ animation: `ycHeroUp 1s ${EASE} 0.4s both` }}>
      <form action={handleFormAction} style={FORM_STYLE}>
        {/* type selector */}
        <ContactTypeSelector
          selectedQueryType={selectedQueryType}
          onSelect={setters.setSelectedQueryType}
        />

        {/* name + email + phone */}
        <IdentityFields values={values} setters={setters} errors={errors} />

        {/* GENERAL / FEATURE */}
        {isGeneralOrFeature && (
          <GeneralEnquiryFields
            message={values.message}
            onMessage={setters.setMessage}
            error={errors?.message}
          />
        )}

        {/* DSAR */}
        {selectedQueryType === 'Data Service Access Request' && (
          <DsarFields
            values={values}
            setters={setters}
            errors={errors}
            confirm={confirm}
            submit={submit}
          />
        )}

        {/* COMPLAINT */}
        {selectedQueryType === 'Complaint' && (
          <ComplaintFields
            values={values}
            setters={setters}
            errors={errors}
            confirm={confirm}
            submit={submit}
          />
        )}

        {/* GENERAL / FEATURE submit lives outside the per-type block */}
        {isGeneralOrFeature && <SubmitButton {...submit} />}

        {errors?.submit ? <SubmitError message={errors.submit} /> : null}

        <PrivacyNote />
      </form>
    </div>
  );
}

const ContactusPage = () => {
  const submitRef = useMagnet<HTMLButtonElement>();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  // Query Type
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [selectedQueryType, setSelectedQueryType] = useState<TicketCategory>('General Enquiry');
  // Subrequest options for Data Service Access Request
  const [subselectedRequest, setSubselectedRequest] = useState<DsraRequesterType | ''>('');

  // Data Service Access Request options
  const [selectedRequest, setSelectedRequest] = useState<string>('');

  // Areas
  const [area, setArea] = useState<string>('');

  // Confirm checklist (multiple selections)
  const [confirmSelections, setConfirmSelections] = useState<string[]>([]);
  // Complaint specific fields
  const [complaintLink, setComplaintLink] = useState<string>('');
  const [complaintImage, setComplaintImage] = useState<File | null>(null);

  const formValues: ContactFormValues = {
    selectedQueryType,
    fullName,
    email,
    phone,
    message,
    area,
    subselectedRequest,
    selectedRequest,
    confirmSelections,
    complaintLink,
    complaintImage,
  };

  const setters: ContactFormSetters = {
    setSelectedQueryType,
    setFullName,
    setEmail,
    setPhone,
    setMessage,
    setArea,
    setSubselectedRequest,
    setSelectedRequest,
    setComplaintLink,
    setComplaintImage,
  };

  const toggleConfirmOption = (option: string) => {
    setConfirmSelections((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const resetForm = () => {
    setFullName('');
    setPhone('');
    setEmail('');
    setMessage('');
    setArea('');
    setSelectedRequest('');
    setSubselectedRequest('');
    setConfirmSelections([]);
    setComplaintLink('');
    setComplaintImage(null);
    setSelectedQueryType('General Enquiry');
    setErrors({});
  };

  const handleContectSubmit = async () => {
    const newErrors = validateContactForm(fullName, email, message);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = buildPayload(formValues);
      await postData('/v1/contact-us/contact-web', payload);
      resetForm();
      // Surface an explicit confirmation: without it the form just clears on success, which reads
      // as "nothing happened / the form is broken".
      setSubmitted(true);
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : 'Failed to submit contact request';
      setErrors((prev) => ({ ...prev, submit: errorMessage }));
    } finally {
      setSubmitting(false);
    }
  };

  const submit: SubmitButtonProps = {
    submitRef,
    onSubmit: handleContectSubmit,
    disabled: computeSubmitDisabled(submitting, formValues),
    label: submitting ? 'submitting...' : 'Send message',
  };

  return (
    <section
      data-hero
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, var(--page) 0%, var(--page) 72%, var(--inset) 100%)',
        padding: '148px 24px 100px',
      }}
    >
      <HeroGlow
        parallax={false}
        color="var(--glow-b08)"
        scrollSpeed="-0.04"
        box={{ top: -160, right: 'calc(50% - 560px)', width: 820, height: 560 }}
        animation="ycDrift 34s ease-in-out infinite alternate"
      />
      <div data-grid-1-m style={HERO_GRID_STYLE}>
        <ContactHero />

        {submitted ? (
          <ContactSuccess onReset={() => setSubmitted(false)} />
        ) : (
          <ContactForm
            values={formValues}
            setters={setters}
            errors={errors}
            confirm={{ selections: confirmSelections, onToggle: toggleConfirmOption }}
            submit={submit}
          />
        )}
      </div>
    </section>
  );
};

export default ContactusPage;
