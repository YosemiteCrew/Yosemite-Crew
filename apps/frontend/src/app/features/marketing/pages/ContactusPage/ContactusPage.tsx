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
} from 'react-icons/io5';

import { useMagnet, HeroGlow, DISCORD_INVITE_URL } from '@/app/features/marketing/site';
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

const ContactusPage = () => {
  const submitRef = useMagnet<HTMLButtonElement>();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState<boolean>(false);
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

  const hasComplaintImage = complaintImage !== null;

  const isComplaintValid =
    fullName &&
    email &&
    message &&
    subselectedRequest &&
    confirmSelections.length === confirmOptions.length;
  const isGeneralValid = fullName && email && message;
  const isDSARValid =
    fullName &&
    email &&
    message &&
    subselectedRequest &&
    area &&
    selectedRequest &&
    confirmSelections.length === confirmOptions.length;

  const toggleConfirmOption = (option: string) => {
    setConfirmSelections((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };
  const validateContactForm = (): FormErrors => {
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

  const buildDsarDetails = (): ContactPayload['dsarDetails'] => {
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

  const buildPayload = (): ContactPayload => {
    const payload: ContactPayload = {
      type: CONTACT_TYPE_MAP[selectedQueryType],
      message: message.trim(),
      fullName: fullName.trim(),
      email: email.trim(),
      source: 'PMS_WEB',
    };

    if (phone.trim()) payload.phone = phone.trim();
    if (selectedQueryType === 'Data Service Access Request') {
      payload.dsarDetails = buildDsarDetails();
    }

    return payload;
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
    const newErrors = validateContactForm();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = buildPayload();
      await postData('/v1/contact-us/contact-web', payload);
      resetForm();
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : 'Failed to submit contact request';
      setErrors((prev) => ({ ...prev, submit: errorMessage }));
    } finally {
      setSubmitting(false);
    }
  };

  const tabStyle = (t: TicketCategory): CSSProperties => {
    const active = selectedQueryType === t;
    return {
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
    };
  };

  const submitDisabled =
    submitting ||
    (selectedQueryType === 'Complaint' && !isComplaintValid) ||
    (selectedQueryType === 'Data Service Access Request' && !isDSARValid) ||
    ((selectedQueryType === 'General Enquiry' || selectedQueryType === 'Feature Request') &&
      !isGeneralValid);

  const submitLabel = submitting ? 'submitting...' : 'Send message';

  const renderSubmit = () => (
    <button
      ref={submitRef}
      type="button"
      onClick={handleContectSubmit}
      disabled={submitDisabled}
      className="yc-btn-primary"
      style={{
        ...SUBMIT_BUTTON_STYLE,
        cursor: submitDisabled ? 'not-allowed' : 'pointer',
        opacity: submitDisabled ? 0.5 : 1,
        pointerEvents: submitDisabled ? 'none' : 'auto',
      }}
    >
      {submitLabel}
      <IoArrowForwardOutline aria-hidden="true" style={{ fontSize: 17 }} />
    </button>
  );

  const renderConfirmChecklist = (name: string) => (
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
          checked={confirmSelections.includes(option)}
          onChange={() => toggleConfirmOption(option)}
          label={option}
        />
      ))}
    </div>
  );

  const renderSubmitAsGroup = (name: string, heading: string) => (
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
          checked={subselectedRequest === option.value}
          onChange={() => setSubselectedRequest(option.value)}
          label={option.label}
        />
      ))}
    </div>
  );

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
        {/* left: copy + details */}
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
              human.
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
            Run a clinic, live with a house full of animals, or want to build on the platform. Tell
            us which, and it reaches the right desk, not a queue.
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

        {/* right: form */}
        <div style={{ animation: `ycHeroUp 1s ${EASE} 0.4s both` }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleContectSubmit();
            }}
            style={FORM_STYLE}
          >
            {/* type selector */}
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
                  <label key={type} style={tabStyle(type)}>
                    <input
                      type="radio"
                      name="queryType"
                      aria-label={type}
                      value={type}
                      checked={selectedQueryType === type}
                      onChange={() => setSelectedQueryType(type)}
                      style={VISUALLY_HIDDEN_INPUT_STYLE}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            {/* name + email */}
            <div data-two style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <TextField
                label="Full Name"
                value={fullName}
                onChange={setFullName}
                placeholder="Lena Weber"
                required
                error={errors?.fullName}
              />
              <TextField
                label="Enter Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                required
                error={errors?.email}
              />
            </div>

            <TextField
              label="Phone number (optional)"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="+49 …"
            />

            {/* GENERAL / FEATURE */}
            {(selectedQueryType === 'General Enquiry' ||
              selectedQueryType === 'Feature Request') && (
              <div className="yc-group" style={groupBlock}>
                <TextAreaField
                  label="Please leave details regarding your request"
                  ariaLabel="Request details"
                  value={message}
                  onChange={setMessage}
                  placeholder="Your Message"
                  required
                  error={errors?.message}
                />
              </div>
            )}

            {/* DSAR */}
            {selectedQueryType === 'Data Service Access Request' && (
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
                  Under the GDPR you can access, correct, export, restrict or delete your personal
                  data, or object to how it is used. We verify identity before acting and respond
                  within one month.
                </div>

                {renderSubmitAsGroup('dsarSubmitAs', 'You are submitting this request as')}

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
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
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
                      checked={selectedRequest === option.label}
                      onChange={() => setSelectedRequest(option.label)}
                      label={option.label}
                    />
                  ))}
                </div>

                <TextAreaField
                  label="Please leave details regarding your action request or question"
                  ariaLabel="Data service access request details"
                  value={message}
                  onChange={setMessage}
                  placeholder="Your Message"
                  minHeight={90}
                  error={errors?.message}
                />

                {renderConfirmChecklist('confirmDsar')}

                {renderSubmit()}
              </div>
            )}

            {/* COMPLAINT */}
            {selectedQueryType === 'Complaint' && (
              <div className="yc-group" style={groupBlock}>
                {renderSubmitAsGroup('complaintSubmitAs', 'You are submitting this complaint as')}

                <TextAreaField
                  label="Please leave details regarding your complaint."
                  ariaLabel="Complaint details"
                  value={message}
                  onChange={setMessage}
                  placeholder="Your Message"
                  error={errors?.message}
                />

                <div style={groupBlock}>
                  <div style={groupHeading}>
                    Please add link regarding your complaint (optional)
                  </div>
                  <TextField
                    label="Paste link (optional)"
                    value={complaintLink}
                    onChange={setComplaintLink}
                    placeholder="Paste link (optional)"
                  />
                </div>

                <div style={groupBlock}>
                  <div style={groupHeading}>
                    Please add image regarding your complaint (optional)
                  </div>
                  <input
                    id="complaintImage"
                    type="file"
                    accept="image/*"
                    aria-label="Upload Image"
                    onChange={(e) => setComplaintImage(e.target.files?.[0] || null)}
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
                      {complaintImage?.name}
                    </div>
                  ) : null}
                </div>

                {renderConfirmChecklist('confirmComplaint')}

                {renderSubmit()}
              </div>
            )}

            {/* GENERAL / FEATURE submit lives outside the per-type block */}
            {(selectedQueryType === 'General Enquiry' || selectedQueryType === 'Feature Request') &&
              renderSubmit()}

            {errors?.submit ? (
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
                {errors.submit}
              </div>
            ) : null}

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
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactusPage;
