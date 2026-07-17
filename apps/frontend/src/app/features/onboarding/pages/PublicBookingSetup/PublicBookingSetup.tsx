'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  IoAlertCircleOutline,
  IoArrowBack,
  IoArrowForward,
  IoCheckmark,
  IoCopyOutline,
  IoGlobeOutline,
  IoRocketOutline,
} from 'react-icons/io5';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useNotify } from '@/app/hooks/useNotify';
import type { ServiceRevamp } from '@/app/features/organization/types/revamp';

import { slugify } from './publicBookingSetup.utils';

const WINDOW_OPTIONS = ['Up to 2 weeks ahead', 'Up to 4 weeks ahead', 'Up to 8 weeks ahead'];
const BUFFER_OPTIONS = ['0 minutes', '10 minutes', '15 minutes', '30 minutes'];
const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

const formatPrice = (amount: number, currency?: string): string => {
  const code = String(currency ?? 'EUR').toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  return `${symbol}${Number(amount).toFixed(2)}`;
};

const copyText = async (value: string): Promise<boolean> => {
  try {
    const clip = globalThis.navigator?.clipboard;
    if (clip?.writeText) {
      await clip.writeText(value);
      return true;
    }
  } catch {
    // Clipboard blocked or unavailable — degrade gracefully.
  }
  return false;
};

const AssumedBanner = () => (
  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-[var(--warn-bg)] border border-[var(--warn-border)] text-[10px] font-bold text-[var(--warn-text)]">
    <IoAlertCircleOutline size={11} aria-hidden="true" />
    FIELDS ASSUMED · confirm with product
  </span>
);

const SetupHeader = ({
  orgInitial,
  step,
  label,
}: {
  orgInitial: string;
  step: 1 | 2;
  label: string;
}) => (
  <div className="flex items-center justify-between gap-3 px-7! py-4! border-b border-[var(--hairline)]">
    <span className="flex items-center gap-3">
      <span className="flex items-center justify-center size-7 rounded-lg bg-[var(--blue-soft)] text-[var(--blue-text)] text-[12px] font-extrabold">
        {orgInitial}
      </span>
      <span className="text-[14px] font-bold text-[var(--ink)]">Set up online booking</span>
    </span>
    <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-faint)]">
      <span className="flex items-center justify-center size-[22px] rounded-full bg-primary-600 text-white text-[10.5px] font-extrabold">
        {step}
      </span>
      {label}
    </span>
  </div>
);

type ServicesStepProps = {
  orgInitial: string;
  step: 1 | 2;
  bookableServices: ServiceRevamp[];
  selected: Set<string>;
  onToggleService: (id: string) => void;
  bookingWindow: string;
  onBookingWindowChange: (value: string) => void;
  buffer: string;
  onBufferChange: (value: string) => void;
  needsConfirmation: boolean;
  onToggleConfirmation: () => void;
  onSkip: () => void;
  onContinue: () => void;
};

const BookingServicesStep = ({
  orgInitial,
  step,
  bookableServices,
  selected,
  onToggleService,
  bookingWindow,
  onBookingWindowChange,
  buffer,
  onBufferChange,
  needsConfirmation,
  onToggleConfirmation,
  onSkip,
  onContinue,
}: ServicesStepProps) => (
  <>
    <SetupHeader orgInitial={orgInitial} step={step} label="of 2 · Services & availability" />
    <div className="px-7! py-5! flex flex-col gap-3.5">
      <span className="font-[var(--font-newsreader)] text-[24px] tracking-[-0.015em] text-[var(--ink)]">
        What can pet parents book?
      </span>

      {bookableServices.length === 0 ? (
        <div className="rounded-[14px] border border-[var(--divider)] bg-[var(--inset)] px-3.5 py-4 text-[12.5px] text-[var(--ink-muted)]">
          No bookable services yet. Add services and mark them bookable in Organization →
          Specialities.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bookableServices.map((service: ServiceRevamp) => {
            const isOn = selected.has(service.id);
            return (
              <button
                type="button"
                key={service.id}
                onClick={() => onToggleService(service.id)}
                aria-pressed={isOn}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-left ${
                  isOn
                    ? 'border-[1.5px] border-primary-600 bg-[var(--screen)]'
                    : 'border-[1.5px] border-[var(--hairline)] bg-[var(--screen)]'
                }`}
              >
                <span
                  className={`flex items-center justify-center size-[18px] rounded-md ${
                    isOn
                      ? 'bg-primary-600 text-white'
                      : 'border-[1.5px] border-[var(--divider)]'
                  }`}
                >
                  {isOn ? <IoCheckmark size={12} /> : null}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-bold text-[var(--ink)] truncate">
                    {service.name}
                  </span>
                  <span className="block text-[11.5px] text-[var(--ink-faint)]">
                    {service.durationMinutes} min · any practitioner
                  </span>
                </span>
                <span className="text-[12.5px] font-bold text-[var(--ink)] tabular-nums">
                  {formatPrice(service.grossAmount, service.currency)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="relative flex items-center h-12 px-3.5 border-[1.5px] border-[var(--hairline)] rounded-[14px]">
          <span className="absolute -top-[7px] left-3 px-1.5 bg-[var(--screen)] text-[10.5px] font-semibold text-[var(--ink-faint)]">
            Bookable window
          </span>
          <select
            aria-label="Bookable window"
            value={bookingWindow}
            onChange={(e) => onBookingWindowChange(e.target.value)}
            className="flex-1 bg-transparent text-[13.5px] font-semibold text-[var(--ink-body)] outline-none"
          >
            {WINDOW_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="relative flex items-center h-12 px-3.5 border-[1.5px] border-[var(--hairline)] rounded-[14px]">
          <span className="absolute -top-[7px] left-3 px-1.5 bg-[var(--screen)] text-[10.5px] font-semibold text-[var(--ink-faint)]">
            Buffer between visits
          </span>
          <select
            aria-label="Buffer between visits"
            value={buffer}
            onChange={(e) => onBufferChange(e.target.value)}
            className="flex-1 bg-transparent text-[13.5px] font-semibold text-[var(--ink-body)] outline-none"
          >
            {BUFFER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-[14px] border border-[var(--divider)] bg-[var(--inset)]">
        <span className="text-[12.5px] text-[var(--ink-body)]">
          <strong className="text-[var(--ink)]">Requests need confirmation.</strong> New
          bookings arrive as requests, not fixed slots.
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={needsConfirmation}
          aria-label="Requests need confirmation"
          onClick={onToggleConfirmation}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full ${
            needsConfirmation ? 'bg-primary-600' : 'bg-neutral-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-neutral-0 transition-transform ${
              needsConfirmation ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
    <div className="flex items-center justify-between gap-3 px-7! py-4! border-t border-[var(--hairline)]">
      <button
        type="button"
        onClick={onSkip}
        className="text-[12px] font-semibold text-[var(--ink-muted)]"
      >
        Skip for now
      </button>
      <button
        type="button"
        onClick={onContinue}
        className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-[var(--cta)] text-[var(--cta-text)] text-[13.5px] font-semibold"
      >
        Continue
        <IoArrowForward size={15} />
      </button>
    </div>
  </>
);

type BrandingStepProps = {
  orgInitial: string;
  step: 1 | 2;
  orgName: string;
  hasLogo: boolean;
  welcome: string;
  onWelcomeChange: (value: string) => void;
  replyTo: string;
  onReplyToChange: (value: string) => void;
  publicUrl: string;
  copied: boolean;
  onCopy: () => void;
  onReplaceLogo: () => void;
  onBack: () => void;
  onGoLive: () => void;
};

const BookingBrandingStep = ({
  orgInitial,
  step,
  orgName,
  hasLogo,
  welcome,
  onWelcomeChange,
  replyTo,
  onReplyToChange,
  publicUrl,
  copied,
  onCopy,
  onReplaceLogo,
  onBack,
  onGoLive,
}: BrandingStepProps) => (
  <>
    <SetupHeader orgInitial={orgInitial} step={step} label="of 2 · Branding & review" />
    <div className="px-7! py-5! flex flex-col gap-3.5">
      <span className="font-[var(--font-newsreader)] text-[24px] tracking-[-0.015em] text-[var(--ink)]">
        Your booking page
      </span>
      <div className="flex flex-col md:flex-row gap-3.5">
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="relative flex items-center gap-2.5 h-[52px] px-3.5 border-[1.5px] border-[var(--hairline)] rounded-[14px]">
            <span className="absolute -top-[7px] left-3 px-1.5 bg-[var(--screen)] text-[10.5px] font-semibold text-[var(--ink-faint)]">
              Practice logo
            </span>
            <span className="flex items-center justify-center size-[30px] rounded-[9px] bg-[var(--blue-soft)] text-[var(--blue-text)] text-[12px] font-extrabold">
              {orgInitial}
            </span>
            <span className="flex-1 text-[12.5px] text-[var(--ink-muted)] truncate">
              {hasLogo ? 'Current logo' : 'No logo uploaded'}
            </span>
            <button
              type="button"
              onClick={onReplaceLogo}
              className="text-[11.5px] font-semibold text-[var(--blue-text)]"
            >
              Replace
            </button>
          </div>
          <label className="relative flex items-center h-12 px-3.5 border-[1.5px] border-[var(--hairline)] rounded-[14px]">
            <span className="absolute -top-[7px] left-3 px-1.5 bg-[var(--screen)] text-[10.5px] font-semibold text-[var(--ink-faint)]">
              Welcome message
            </span>
            <input
              aria-label="Welcome message"
              value={welcome}
              onChange={(e) => onWelcomeChange(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--ink-body)] outline-none"
            />
          </label>
          <label className="relative flex items-center h-12 px-3.5 border-[1.5px] border-[var(--hairline)] rounded-[14px]">
            <span className="absolute -top-[7px] left-3 px-1.5 bg-[var(--screen)] text-[10.5px] font-semibold text-[var(--ink-faint)]">
              Confirmation email reply-to
            </span>
            <input
              aria-label="Confirmation email reply-to"
              type="email"
              placeholder="frontdesk@your-clinic.vet"
              value={replyTo}
              onChange={(e) => onReplyToChange(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--ink-body)] outline-none"
            />
          </label>
        </div>
        <div className="md:w-60 shrink-0 p-3.5 rounded-2xl border border-[var(--divider)] bg-[var(--inset)] flex flex-col gap-2.5">
          <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[var(--ink-faint)]">
            Preview
          </span>
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--screen)] p-3 flex flex-col gap-1.5">
            <span className="flex items-center justify-center size-[26px] rounded-lg bg-[var(--blue-soft)] text-[var(--blue-text)] text-[11px] font-extrabold">
              {orgInitial}
            </span>
            <span className="text-[12px] font-bold text-[var(--ink)]">{orgName}</span>
            <span className="text-[10px] text-[var(--ink-muted)] leading-relaxed line-clamp-3">
              {welcome}
            </span>
            <span className="flex items-center justify-center h-[26px] rounded-full bg-[var(--cta)] text-[var(--cta-text)] text-[10px] font-bold">
              Choose a service
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-[var(--ink-faint)]">
          Public URL
        </span>
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-[var(--divider)] bg-[var(--inset)]">
          <IoGlobeOutline size={15} className="text-[var(--blue-text)]" aria-hidden="true" />
          <span className="flex-1 min-w-0 text-[13px] font-semibold text-[var(--ink)] font-mono truncate">
            {publicUrl}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--blue-text)]"
          >
            <IoCopyOutline size={13} aria-hidden="true" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <span className="text-[11.5px] text-[var(--ink-faint)]">
          Slug is assumed from your clinic name — confirm the public URL with product.
        </span>
      </div>
    </div>
    <div className="flex items-center justify-between gap-3 px-7! py-4! border-t border-[var(--hairline)]">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink-muted)]"
      >
        <IoArrowBack size={13} />
        Back
      </button>
      <button
        type="button"
        onClick={onGoLive}
        className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-[var(--cta)] text-[var(--cta-text)] text-[13.5px] font-semibold"
      >
        <IoRocketOutline size={15} />
        Go live
      </button>
    </div>
  </>
);

const PublicBookingSetup = () => {
  const { notify } = useNotify();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrg = usePrimaryOrg();
  const services = useRevampCatalogStore((s) => s.services);
  const loadOrganisationCatalog = useRevampCatalogStore((s) => s.loadOrganisationCatalog);

  const orgName = primaryOrg?.name || 'Your clinic';
  const orgInitial = orgName.charAt(0).toUpperCase();
  const slug = slugify(orgName);
  const publicUrl = `book.yosemitecrew.com/${slug}`;

  const bookableServices = useMemo(
    () => services.filter((s) => s.isBookable && s.status === 'ACTIVE'),
    [services]
  );
  const allBookableIds = useMemo(
    () => new Set(bookableServices.map((s) => s.id)),
    [bookableServices]
  );

  const [step, setStep] = useState<1 | 2>(1);
  // Every bookable service starts selected; `selectionOverride` holds the user's
  // explicit choices once they toggle, so selection derives from render, not an effect.
  const [selectionOverride, setSelectionOverride] = useState<Set<string> | null>(null);
  const selected = selectionOverride ?? allBookableIds;
  const [bookingWindow, setBookingWindow] = useState(WINDOW_OPTIONS[1]);
  const [buffer, setBuffer] = useState(BUFFER_OPTIONS[1]);
  const [needsConfirmation, setNeedsConfirmation] = useState(true);
  const [welcome, setWelcome] = useState(`Book a visit for your companion at ${orgName}.`);
  const [replyTo, setReplyTo] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (primaryOrgId) {
      Promise.resolve(loadOrganisationCatalog(primaryOrgId)).catch(() => undefined);
    }
  }, [primaryOrgId, loadOrganisationCatalog]);

  const toggleService = (id: string) => {
    setSelectionOverride((prev) => {
      const next = new Set(prev ?? allBookableIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = () => {
    void copyText(publicUrl).then((ok) => {
      if (ok) setCopied(true);
    });
  };

  const handleGoLive = () => {
    notify('info', {
      title: 'Booking setup saved for review',
      text: 'These fields are assumed pending product confirmation — publishing is not yet wired up.',
    });
  };

  const handleSkip = () =>
    notify('info', { title: 'Setup skipped', text: 'You can set this up later.' });

  const handleReplaceLogo = () =>
    notify('info', {
      title: 'Logo upload coming soon',
      text: 'Uploading a booking-page logo is not wired up yet.',
    });

  return (
    <div className="flex flex-col gap-4 p-3! md:p-5!">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--ink-faint)]">
          Public booking · onboarding
        </span>
        <AssumedBanner />
      </div>

      <div className="w-full max-w-[720px] rounded-[22px] border border-[var(--hairline)] bg-[var(--screen)] overflow-hidden shadow-[0_2px_6px_var(--sh05),0_24px_60px_var(--sh10)]">
        {step === 1 ? (
          <BookingServicesStep
            orgInitial={orgInitial}
            step={step}
            bookableServices={bookableServices}
            selected={selected}
            onToggleService={toggleService}
            bookingWindow={bookingWindow}
            onBookingWindowChange={setBookingWindow}
            buffer={buffer}
            onBufferChange={setBuffer}
            needsConfirmation={needsConfirmation}
            onToggleConfirmation={() => setNeedsConfirmation((v) => !v)}
            onSkip={handleSkip}
            onContinue={() => setStep(2)}
          />
        ) : (
          <BookingBrandingStep
            orgInitial={orgInitial}
            step={step}
            orgName={orgName}
            hasLogo={Boolean(primaryOrg?.imageURL)}
            welcome={welcome}
            onWelcomeChange={setWelcome}
            replyTo={replyTo}
            onReplyToChange={setReplyTo}
            publicUrl={publicUrl}
            copied={copied}
            onCopy={handleCopy}
            onReplaceLogo={handleReplaceLogo}
            onBack={() => setStep(1)}
            onGoLive={handleGoLive}
          />
        )}
      </div>
    </div>
  );
};

export default PublicBookingSetup;
