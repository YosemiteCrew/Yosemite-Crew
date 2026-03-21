'use client';
import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { TicketCategory } from '@yosemite-crew/types';
import Link from 'next/link';
import { isEmail } from 'validator';
import axios from 'axios';

import Footer from '@/app/ui/widgets/Footer/Footer';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import DynamicSelect from '@/app/ui/widgets/DynamicSelect/DynamicSelect';
import Image from 'next/image';
import { postData } from '@/app/services/axios';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

import './ContactusPage.css';

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

const ContactusPage = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  // Query Type
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [selectedQueryType, setSelectedQueryType] = useState<TicketCategory>('General Enquiry');
  const queryTypes: TicketCategory[] = [
    'General Enquiry',
    'Feature Request',
    'Data Service Access Request',
    'Complaint',
  ];
  // Subrequest options for Data Service Access Request
  const [subselectedRequest, setSubselectedRequest] = useState<DsraRequesterType | ''>('');
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

  // Data Service Access Request options
  const [selectedRequest, setSelectedRequest] = useState<string>('');
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

  // Areas
  const [area, setArea] = useState<string>('');
  type Option = {
    value: string;
    label: string;
  };
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

  // Confirm checklist (multiple selections)
  const [confirmSelections, setConfirmSelections] = useState<string[]>([]);
  // Complaint specific fields
  const [complaintLink, setComplaintLink] = useState<string>('');
  const [complaintImage, setComplaintImage] = useState<File | null>(null);
  console.log(complaintImage);
  const confirmOptions = [
    'Under penalty of perjury, I declare all the above information to be true and accurate.',
    'I understand that the deletion or restriction of my personal data is irreversible and may result in the termination of services with Yosemite Crew.',
    'I understand that I will be required to validate my request my email, and I may be contacted in order to complete the request.',
  ];
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
  const isValidEmail = (email: string): boolean => {
    return isEmail(email);
  };

  const getDsarLawBasis = (selectedArea: string): DsraLawBasis =>
    (areaOptions.find((option) => option.value === selectedArea)?.value as DsraLawBasis) || 'OTHER';

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

  return (
    <>
      <section className="ContactUsPageSec">
        <div className="ContactWrapper">
          <div className="ContactUsData">
            <div className="LeftContactUs">
              <div className="conttexted">
                <div className="text-body-4-emphasis text-text-brand">Contact us</div>
                <div className="text-display-2 text-text-primary">
                  Need help? We&rsquo;re all ears!
                </div>
              </div>
              <Image
                alt="Contact Image"
                src={MEDIA_SOURCES.contactUs.heroImage}
                height={586}
                width={600}
              />
            </div>

            <div className="RightContactUs">
              <div className="QueryText">
                <div className="text-display-2 text-text-primary text-center">
                  Submit your query
                </div>
              </div>

              {/* Contact Form */}
              <div className="ContactForm">
                <FormInput
                  intype="fullName"
                  inname="fullName"
                  value={fullName}
                  inlabel="Full Name"
                  onChange={(e) => setFullName(e.target.value)}
                  error={errors?.fullName}
                />
                <FormInput
                  intype="email"
                  inname="email"
                  value={email}
                  inlabel="Enter Email Address"
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors?.email}
                />
                <FormInput
                  intype="phone"
                  inname="phone"
                  value={phone}
                  inlabel="Phone number (optional)"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {/* Radio Group */}
              <div className="QueryTypeRadioGroup">
                {queryTypes.map((type) => (
                  <label key={type}>
                    <input
                      type="radio"
                      name="queryType"
                      value={type}
                      checked={selectedQueryType === type}
                      onChange={() => setSelectedQueryType(type)}
                    />
                    {type}
                  </label>
                ))}
              </div>

              {/* One clear block per query type */}
              {selectedQueryType === 'Data Service Access Request' && (
                <div className="DataServiceAccessFields">
                  <div className="SetSubmitted">
                    <div className="text-body-4-emphasis text-text-primary">
                      You are submitting this request as
                    </div>
                    {subrequestOptions.map((option) => (
                      <label key={option.value}>
                        <input
                          type="radio"
                          name="dsarSubmitAs"
                          value={option.value}
                          checked={subselectedRequest === option.value}
                          onChange={() => setSubselectedRequest(option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-4-emphasis text-text-primary">
                      Under the rights of which law are you making this request?
                    </div>
                    <DynamicSelect
                      options={areaOptions}
                      value={area}
                      onChange={setArea}
                      inname="area"
                      placeholder="Select one"
                    />
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-4-emphasis text-text-primary">
                      You are submitting this request to
                    </div>
                    {requestOptions.map((option) => (
                      <label key={option.label}>
                        <input
                          type="radio"
                          name="dsarRequestTo"
                          value={option.value}
                          checked={selectedRequest === option.label}
                          onChange={() => setSelectedRequest(option.label)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>

                  <div className="QueryDetailsFields">
                    <label htmlFor="dsar-message">
                      Please leave details regarding your action request or question
                    </label>
                    <textarea
                      rows={3}
                      id="dsar-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Your Message"
                    ></textarea>
                    {errors?.message && (
                      <div
                        style={{
                          color: 'var(--color-danger-600)',
                          fontSize: '14px',
                          marginTop: '4px',
                        }}
                      >
                        {errors?.message ?? ''}
                      </div>
                    )}
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-4-emphasis text-text-primary">I confirm that</div>
                    {confirmOptions.map((option) => (
                      <label key={option}>
                        <input
                          type="checkbox"
                          name="confirmDsar"
                          value={option}
                          checked={confirmSelections.includes(option)}
                          onChange={() => toggleConfirmOption(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>

                  <Button
                    className="SendBtn"
                    onClick={handleContectSubmit}
                    disabled={submitting || !isDSARValid}
                    style={{
                      opacity: isDSARValid ? 1 : 0.5,
                      pointerEvents: isDSARValid ? 'auto' : 'none',
                    }}
                  >
                    {submitting ? 'submitting...' : 'Send message'}
                  </Button>
                </div>
              )}

              {selectedQueryType === 'Complaint' && (
                <div className="DataServiceAccessFields">
                  <div className="SetSubmitted" style={{ gap: '16px' }}>
                    <div className="text-body-4-emphasis text-text-primary">
                      You are submitting this complaint as
                    </div>
                    {subrequestOptions.map((option) => (
                      <label key={option.value}>
                        <input
                          type="radio"
                          name="complaintSubmitAs"
                          value={option.value}
                          checked={subselectedRequest === option.value}
                          onChange={() => setSubselectedRequest(option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>

                  <div className="QueryDetailsFields">
                    <label htmlFor="complaint-message">
                      Please leave details regarding your complaint.
                    </label>
                    <textarea
                      rows={3}
                      id="complaint-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Your Message"
                    ></textarea>
                    {errors?.message && (
                      <div
                        style={{
                          color: 'var(--color-danger-600)',
                          fontSize: '14px',
                          marginTop: '4px',
                        }}
                      >
                        {errors?.message ?? ''}
                      </div>
                    )}
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-4-emphasis text-text-primary">
                      Please add link regarding your complaint (optional)
                    </div>
                    <FormInput
                      intype="text"
                      inname="complaintLink"
                      value={complaintLink}
                      inlabel="Paste link (optional)"
                      onChange={(e) => setComplaintLink(e.target.value)}
                    />
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-4-emphasis text-text-primary">
                      Please add image regarding your complaint (optional)
                    </div>
                    <div className="UploadBox">
                      <input
                        id="complaintImage"
                        type="file"
                        accept="image/*"
                        aria-label="Upload Image"
                        onChange={(e) => setComplaintImage(e.target.files?.[0] || null)}
                      />
                      <label htmlFor="complaintImage" className="UploadInner">
                        <Image
                          src={MEDIA_SOURCES.contactUs.uploadIcon}
                          alt="Upload Icon"
                          height={40}
                          width={40}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="SetSubmitted">
                    <div className="text-body-4-emphasis text-text-primary">I confirm that</div>
                    {confirmOptions.map((option) => (
                      <label key={option}>
                        <input
                          type="checkbox"
                          name="confirmComplaint"
                          value={option}
                          checked={confirmSelections.includes(option)}
                          onChange={() => toggleConfirmOption(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>

                  <Button
                    className="SendBtn"
                    onClick={handleContectSubmit}
                    disabled={submitting || !isComplaintValid}
                    style={{
                      opacity: isComplaintValid ? 1 : 0.5,
                      pointerEvents: isComplaintValid ? 'auto' : 'none',
                    }}
                  >
                    {submitting ? 'submitting...' : 'Send message'}
                  </Button>
                </div>
              )}

              {(selectedQueryType === 'General Enquiry' ||
                selectedQueryType === 'Feature Request') && (
                <>
                  <div className="QueryDetailsFields">
                    <label htmlFor="general-message">
                      Please leave details regarding your request
                    </label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Your Message"
                      id="general-message"
                    ></textarea>
                    {errors?.message && (
                      <div
                        style={{
                          color: 'var(--color-danger-600)',
                          fontSize: '14px',
                          marginTop: '4px',
                        }}
                      >
                        {errors?.message ?? ''}
                      </div>
                    )}
                  </div>
                  <Button
                    className="SendBtn"
                    onClick={handleContectSubmit}
                    disabled={submitting || !isGeneralValid}
                    style={{
                      opacity: isGeneralValid ? 1 : 0.5,
                      pointerEvents: isGeneralValid ? 'auto' : 'none',
                    }}
                  >
                    {submitting ? 'submitting...' : 'Send message'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="ContactInfoSec">
        <div className="ContactWrapper">
          <div className="ContactInfoData">
            <div className="LeftContInfo">
              <div className="text-body-4-emphasis text-text-brand">Contact Info</div>
              <div className="text-display-2 text-text-primary">We are happy to assist you</div>
            </div>
            <div className="ContactInfoDetail">
              <div className="LeftDetails">
                <div className="detailitem">
                  <div className="text-body-3-emphasis text-text-primary">Email Address</div>
                </div>
                <div className="detailTexed">
                  <Link
                    href="mailto:support@yosemitecrew.com"
                    className="text-body-3-emphasis text-text-brand"
                  >
                    support@yosemitecrew.com
                  </Link>
                  <div className="text-body-3 text-text-primary">
                    Assistance hours: Monday - Friday 9 am to 5 pm EST
                  </div>
                </div>
              </div>

              <div className="LeftDetails">
                <div className="detailitem">
                  <div className="text-body-3-emphasis text-text-primary">Phone</div>
                </div>
                <div className="detailTexed">
                  <Link
                    href="tel:+49 152 277 63275"
                    className="text-body-3-emphasis text-text-brand"
                  >
                    +49 152 277 63275
                  </Link>
                  <div className="text-body-3 text-text-primary">
                    Assistance hours: Monday - Friday 9 am to 5 pm EST
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default ContactusPage;
