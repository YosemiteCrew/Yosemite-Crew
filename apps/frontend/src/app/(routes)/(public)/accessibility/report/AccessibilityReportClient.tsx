'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { postData } from '@/app/services/axios';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { Primary } from '@/app/ui/primitives/Buttons';
import Footer from '@/app/ui/widgets/Footer/Footer';

type FieldErrors = {
  name?: string;
  email?: string;
  description?: string;
  submit?: string;
};

type FormState = {
  name: string;
  email: string;
  pageUrl: string;
  severity: string;
  description: string;
};

const SEVERITY_OPTIONS = [
  { value: 'blocker', label: 'Cannot use the feature at all' },
  { value: 'major', label: 'Very difficult to use' },
  { value: 'minor', label: 'Inconvenient but workable' },
  { value: 'unknown', label: 'Not sure' },
];

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  pageUrl: '',
  severity: 'unknown',
  description: '',
};

function validate(form: FormState): FieldErrors {
  const errs: FieldErrors = {};
  if (!form.name.trim()) errs.name = 'Your name is required.';
  if (!form.email.trim()) {
    errs.email = 'Your email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@.]+$/.test(form.email)) {
    errs.email = 'Enter a valid email address.';
  }
  if (!form.description.trim()) errs.description = 'Please describe the barrier you encountered.';
  return errs;
}

export default function AccessibilityReportClient() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const errorSummaryId = useId();

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field as keyof FieldErrors]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field as keyof FieldErrors];
          return next;
        });
      }
    };

  const handleSubmit = async (
    e: Parameters<NonNullable<React.ComponentProps<'form'>['onSubmit']>>[0]
  ) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const severityLabel =
        SEVERITY_OPTIONS.find((o) => o.value === form.severity)?.label ?? form.severity;
      const message = [
        `Page / URL: ${form.pageUrl || 'not specified'}`,
        `Severity: ${severityLabel}`,
        '',
        form.description.trim(),
      ].join('\n');

      await postData('/v1/contact-us/contact-web', {
        type: 'COMPLAINT',
        source: 'accessibility',
        fullName: form.name.trim(),
        email: form.email.trim(),
        message,
      });
      setSubmitted(true);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : 'Failed to submit report. Please try emailing us directly.';
      setErrors({ submit: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-6 pt-22 pb-16">
          <output
            aria-live="polite"
            className="rounded-2xl border border-card-border bg-white p-8 text-center"
          >
            <h1 className="text-heading-2 text-text-primary mb-4">Thank you for your report</h1>
            <p className="text-body-4 text-text-secondary mb-6">
              We have received your accessibility report and will aim to respond within 5 business
              days. If your issue is urgent, you can also email us at{' '}
              <a href="mailto:accessibility@yosemitecrew.com" className="text-text-brand underline">
                accessibility@yosemitecrew.com
              </a>
              {'.'}
            </p>
            <Link
              href="/accessibility"
              className="text-body-4-emphasis text-text-brand underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Back to Accessibility Statement
            </Link>
          </output>
        </main>
        <Footer />
      </>
    );
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-6 pt-22 pb-16">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-body-4 text-text-secondary list-none p-0 m-0">
            <li>
              <Link
                href="/accessibility"
                className="text-text-brand underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Accessibility Statement
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="text-text-primary">
              Report a barrier
            </li>
          </ol>
        </nav>

        <h1 className="text-heading-1 text-text-primary mb-3">Report an accessibility barrier</h1>
        <p className="text-body-4 text-text-secondary mb-8">
          Use this form to tell us about an accessibility problem you encountered. We aim to respond
          within 5 business days. Fields marked <span aria-hidden="true">*</span>{' '}
          <span className="sr-only">with an asterisk</span> are required.
        </p>

        {hasErrors && (
          <div
            id={errorSummaryId}
            role="alert"
            aria-labelledby={`${errorSummaryId}-title`}
            className="mb-6 rounded-xl border border-error-border bg-danger-50 px-4 py-3"
          >
            <h2
              id={`${errorSummaryId}-title`}
              className="text-body-4-emphasis text-text-error mb-1"
            >
              Please fix the following errors:
            </h2>
            <ul className="list-disc pl-5 text-body-4 text-text-error space-y-0.5">
              {errors.name && <li>{errors.name}</li>}
              {errors.email && <li>{errors.email}</li>}
              {errors.description && <li>{errors.description}</li>}
              {errors.submit && <li>{errors.submit}</li>}
            </ul>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-describedby={hasErrors ? errorSummaryId : undefined}
        >
          <div className="flex flex-col gap-5">
            <FormInput
              intype="text"
              inname="name"
              inlabel="Your name *"
              value={form.name}
              onChange={set('name')}
              error={errors.name}
            />

            <FormInput
              intype="email"
              inname="email"
              inlabel="Email address *"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
            />

            <FormInput
              intype="url"
              inname="pageUrl"
              inlabel="Page or URL where you encountered the barrier"
              value={form.pageUrl}
              onChange={set('pageUrl')}
            />

            <LabelDropdown
              placeholder="How severe is the impact?"
              options={SEVERITY_OPTIONS}
              defaultOption={form.severity}
              searchable={false}
              onSelect={(option) => {
                setForm((prev) => ({ ...prev, severity: option.value }));
              }}
            />

            <div className="flex flex-col gap-1">
              <p className="mb-2 text-body-4 text-text-secondary text-[12px]">
                Include what you were trying to do, what went wrong, and which assistive technology
                or browser you use if relevant.
              </p>
              <FormDesc
                intype="text"
                inname="description"
                inlabel="Describe the barrier *"
                value={form.description}
                onChange={set('description')}
                error={errors.description}
                className="min-h-30 resize-y"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Primary
                type="submit"
                text={submitting ? 'Submitting...' : 'Submit report'}
                isDisabled={submitting}
              />
              <Link
                href="/accessibility"
                className="text-body-4 text-text-secondary underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </main>
      <Footer />
    </>
  );
}
