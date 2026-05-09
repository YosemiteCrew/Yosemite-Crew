'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { postData } from '@/app/services/axios';
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

export default function AccessibilityReportPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const nameId = useId();
  const emailId = useId();
  const pageUrlId = useId();
  const severityId = useId();
  const descriptionId = useId();
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
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-6 py-16">
          <div
            role="status"
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
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-6 py-16">
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
            <div className="flex flex-col gap-1">
              <label htmlFor={nameId} className="text-body-4-emphasis text-text-primary">
                Your name <span aria-hidden="true">*</span>
              </label>
              <input
                id={nameId}
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={set('name')}
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${nameId}-error` : undefined}
                className={`rounded-xl border px-4 py-3 text-body-4 text-text-primary bg-white outline-none focus-visible:ring-2 focus-visible:ring-text-primary ${errors.name ? 'border-error-border' : 'border-card-border'}`}
              />
              {errors.name && (
                <p id={`${nameId}-error`} role="alert" className="text-[12px] text-text-error">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={emailId} className="text-body-4-emphasis text-text-primary">
                Email address <span aria-hidden="true">*</span>
              </label>
              <input
                id={emailId}
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? `${emailId}-error` : undefined}
                className={`rounded-xl border px-4 py-3 text-body-4 text-text-primary bg-white outline-none focus-visible:ring-2 focus-visible:ring-text-primary ${errors.email ? 'border-error-border' : 'border-card-border'}`}
              />
              {errors.email && (
                <p id={`${emailId}-error`} role="alert" className="text-[12px] text-text-error">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={pageUrlId} className="text-body-4-emphasis text-text-primary">
                Page or URL where you encountered the barrier
              </label>
              <input
                id={pageUrlId}
                type="url"
                autoComplete="url"
                value={form.pageUrl}
                onChange={set('pageUrl')}
                placeholder="https://app.yosemitecrew.com/..."
                className="rounded-xl border border-card-border px-4 py-3 text-body-4 text-text-primary bg-white outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={severityId} className="text-body-4-emphasis text-text-primary">
                How severe is the impact?
              </label>
              <select
                id={severityId}
                value={form.severity}
                onChange={set('severity')}
                className="rounded-xl border border-card-border px-4 py-3 text-body-4 text-text-primary bg-white outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
              >
                {SEVERITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={descriptionId} className="text-body-4-emphasis text-text-primary">
                Describe the barrier <span aria-hidden="true">*</span>
              </label>
              <p
                id={`${descriptionId}-hint`}
                className="text-body-4 text-text-secondary text-[12px]"
              >
                Include what you were trying to do, what went wrong, and which assistive technology
                or browser you use if relevant.
              </p>
              <textarea
                id={descriptionId}
                rows={5}
                value={form.description}
                onChange={set('description')}
                aria-required="true"
                aria-invalid={!!errors.description}
                aria-describedby={[
                  `${descriptionId}-hint`,
                  errors.description ? `${descriptionId}-error` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                className={`rounded-xl border px-4 py-3 text-body-4 text-text-primary bg-white outline-none focus-visible:ring-2 focus-visible:ring-text-primary resize-y min-h-30 ${errors.description ? 'border-error-border' : 'border-card-border'}`}
              />
              {errors.description && (
                <p
                  id={`${descriptionId}-error`}
                  role="alert"
                  className="text-[12px] text-text-error"
                >
                  {errors.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl bg-black-bg px-8 py-3 text-body-4-emphasis text-white-text hover:bg-black-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
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
