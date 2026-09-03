'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Switch from '@/app/ui/primitives/Switch/Switch';
import {
  IoArrowBack,
  IoArrowForward,
  IoCheckmark,
  IoCopyOutline,
  IoGlobeOutline,
  IoSaveOutline,
} from 'react-icons/io5';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useNotify } from '@/app/hooks/useNotify';
import type { ServiceRevamp } from '@/app/features/organization/types/revamp';
import {
  bookingPageApi,
  type BookingPageConfig,
} from '@/app/features/onboarding/services/bookingPageApiService';

// Values, not display strings. These are persisted and later read by the public
// slot computation, so the option list carries the number the API stores rather
// than a label that would have to be parsed back into one.
const WINDOW_OPTIONS: { label: string; days: number }[] = [
  { label: 'Up to 2 weeks ahead', days: 14 },
  { label: 'Up to 4 weeks ahead', days: 28 },
  { label: 'Up to 8 weeks ahead', days: 56 },
];
const BUFFER_OPTIONS: { label: string; minutes: number }[] = [
  { label: '0 minutes', minutes: 0 },
  { label: '10 minutes', minutes: 10 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
];
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

const SetupHeader = ({ step, label }: { step: 1 | 2; label: string }) => (
  <div className="flex items-center justify-between gap-3 px-7! pt-5! pb-4! border-b border-[var(--hairline)]">
    <span className="flex items-center gap-[11px]">
      <Image src="/icon.svg" alt="Yosemite Crew" width={28} height={28} />
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
  step: 1 | 2;
  bookableServices: ServiceRevamp[];
  selected: Set<string>;
  onToggleService: (id: string) => void;
  bookingWindowDays: number;
  onBookingWindowChange: (value: number) => void;
  bufferMinutes: number;
  onBufferChange: (value: number) => void;
  needsConfirmation: boolean;
  onToggleConfirmation: () => void;
  onSkip: () => void;
  onContinue: () => void;
};

const BookingServicesStep = ({
  step,
  bookableServices,
  selected,
  onToggleService,
  bookingWindowDays,
  onBookingWindowChange,
  bufferMinutes,
  onBufferChange,
  needsConfirmation,
  onToggleConfirmation,
  onSkip,
  onContinue,
}: ServicesStepProps) => (
  <>
    <SetupHeader step={step} label="of 2 · Services & availability" />
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
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-left border-[1.5px] bg-[var(--screen)]"
                style={{
                  borderColor: isOn ? 'var(--blue)' : 'var(--hairline)',
                  boxShadow: isOn ? '0 0 0 3px var(--glow-b10)' : undefined,
                }}
              >
                <span
                  className={`flex items-center justify-center size-[18px] rounded-md ${
                    isOn ? 'bg-primary-600 text-white' : 'border-[1.5px] border-[var(--divider)]'
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
        {/* focus-within on the WRAPPER, because nothing else can show focus
            here: globals.css suppresses the outline on input, select and
            textarea on the grounds that each field shows border-color on focus,
            and the inner control adds its own outline-none. These five notched
            fields had neither, so a keyboard user tabbing through the public
            booking setup got no indication of where they were at all. */}
        <label className="relative flex items-center h-12 px-3.5 border-[1.5px] border-[var(--hairline)] rounded-[14px] focus-within:border-[var(--color-input-border-active)]">
          <span className="absolute -top-[7px] left-3 px-1.5 bg-[var(--screen)] text-[10.5px] font-semibold text-[var(--ink-faint)]">
            Bookable window
          </span>
          <select
            aria-label="Bookable window"
            value={bookingWindowDays}
            onChange={(e) => onBookingWindowChange(Number(e.target.value))}
            className="flex-1 bg-transparent text-[13.5px] font-semibold text-[var(--ink-body)] outline-none"
          >
            {WINDOW_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="relative flex items-center h-12 px-3.5 border-[1.5px] border-[var(--hairline)] rounded-[14px] focus-within:border-[var(--color-input-border-active)]">
          <span className="absolute -top-[7px] left-3 px-1.5 bg-[var(--screen)] text-[10.5px] font-semibold text-[var(--ink-faint)]">
            Buffer between visits
          </span>
          <select
            aria-label="Buffer between visits"
            value={bufferMinutes}
            onChange={(e) => onBufferChange(Number(e.target.value))}
            className="flex-1 bg-transparent text-[13.5px] font-semibold text-[var(--ink-body)] outline-none"
          >
            {BUFFER_OPTIONS.map((opt) => (
              <option key={opt.minutes} value={opt.minutes}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-[14px] border border-[var(--divider)] bg-[var(--inset)]">
        <span className="text-[12.5px] text-[var(--ink-body)]">
          <strong className="text-[var(--ink)]">Requests need confirmation.</strong> New bookings
          arrive as requests, not fixed slots.
        </span>
        <Switch
          checked={needsConfirmation}
          label="Requests need confirmation"
          onChange={onToggleConfirmation}
        />
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

/**
 * The practice's booking address.
 *
 * Three states, and the difference between them is the whole point of this
 * component. A live page gets its real address and a copy button. A saved but
 * unpublished page gets the reserved name and says so in plain words, with no
 * copy button - copying is an invitation to paste the address onto a website or
 * a Google listing, and there is nothing at the other end yet. A page that has
 * never been saved gets no address at all, because none has been allocated.
 *
 * `publicUrl` is only ever a value the API sent. Nothing here builds one.
 */
/**
 * What to say about an address we cannot show a link for.
 *
 * Three states, not two. Whether the page is REACHABLE is
 * `publicBookingEnabled`; whether we can show a LINK to it additionally needs
 * `PUBLIC_BOOKING_BASE_URL` configured for the environment. Collapsing those
 * told a practice whose page was live and taking bookings that it "is not live
 * yet" - the same species of untruth this screen was rewritten to remove, only
 * pointing the other way.
 */
const describeAddress = (slug: string | null, publicBookingEnabled: boolean): string => {
  if (!slug) return 'Save your setup and we will reserve a booking address for your practice.';
  if (publicBookingEnabled) {
    return 'Your booking page is open and pet parents can use it. No public web address is configured for this environment yet, so there is no link to copy here - ask whoever administers this environment to set one.';
  }
  return 'Your booking page is closed, so there is no link to share. We have reserved this address for you and will use it when you open the page.';
};

const BookingAddress = ({
  slug,
  publicUrl,
  publicBookingEnabled,
  copied,
  onCopy,
}: {
  slug: string | null;
  publicUrl: string | null;
  publicBookingEnabled: boolean;
  copied: boolean;
  onCopy: (url: string) => void;
}) => {
  if (publicUrl) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-[var(--ink-faint)]">
          Public booking address
        </span>
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-[var(--divider)] bg-[var(--inset)]">
          <IoGlobeOutline size={15} className="text-[var(--blue-text)]" aria-hidden="true" />
          <span className="flex-1 min-w-0 text-[13px] font-semibold text-[var(--ink)] font-mono truncate">
            {publicUrl}
          </span>
          <button
            type="button"
            onClick={() => onCopy(publicUrl)}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--blue-text)]"
          >
            <IoCopyOutline size={13} aria-hidden="true" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <span className="text-[11.5px] text-[var(--ink-faint)]">
          This page is live. Safe to share on your website or your Google listing.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-[var(--ink-faint)]">
        Public booking address
      </span>
      <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-[var(--divider)] bg-[var(--inset)]">
        <IoGlobeOutline size={15} className="text-[var(--ink-faint)]" aria-hidden="true" />
        <span className="flex-1 min-w-0 text-[13px] font-semibold text-[var(--ink-muted)] font-mono truncate">
          {slug ?? 'Reserved when you save'}
        </span>
      </div>
      <span className="text-[11.5px] text-[var(--ink-faint)]">
        {describeAddress(slug, publicBookingEnabled)}
      </span>
    </div>
  );
};

type BrandingStepProps = {
  orgInitial: string;
  step: 1 | 2;
  orgName: string;
  hasLogo: boolean;
  welcome: string;
  onWelcomeChange: (value: string) => void;
  replyTo: string;
  onReplyToChange: (value: string) => void;
  slug: string | null;
  publicUrl: string | null;
  publicBookingEnabled: boolean;
  copied: boolean;
  onCopy: (url: string) => void;
  onReplaceLogo: () => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  loadFailed: boolean;
  publish: boolean;
  onTogglePublish: () => void;
  hasBookableServices: boolean;
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
  slug,
  publicUrl,
  publicBookingEnabled,
  copied,
  onCopy,
  onReplaceLogo,
  onBack,
  onSave,
  saving,
  loadFailed,
  publish,
  onTogglePublish,
  hasBookableServices,
}: BrandingStepProps) => (
  <>
    <SetupHeader step={step} label="of 2 · Branding & review" />
    <div className="px-7! py-5! flex flex-col gap-3.5">
      <span className="font-[var(--font-newsreader)] text-[24px] tracking-[-0.015em] text-[var(--ink)]">
        Your booking page
      </span>
      <div className="flex flex-col md:flex-row gap-3.5">
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="relative flex items-center gap-2.5 h-[52px] px-3.5 border-[1.5px] border-[var(--hairline)] rounded-[14px] focus-within:border-[var(--color-input-border-active)]">
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
          <label className="relative flex items-center h-12 px-3.5 border-[1.5px] border-[var(--hairline)] rounded-[14px] focus-within:border-[var(--color-input-border-active)]">
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
          <label className="relative flex items-center h-12 px-3.5 border-[1.5px] border-[var(--hairline)] rounded-[14px] focus-within:border-[var(--color-input-border-active)]">
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

      <BookingAddress
        slug={slug}
        publicUrl={publicUrl}
        publicBookingEnabled={publicBookingEnabled}
        copied={copied}
        onCopy={onCopy}
      />

      <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-[14px] border border-[var(--divider)] bg-[var(--inset)]">
        <span className="text-[12.5px] text-[var(--ink-body)]">
          <strong className="text-[var(--ink)]">Open my booking page.</strong>{' '}
          {hasBookableServices
            ? 'Pet parents can find and use it as soon as you save.'
            : 'Mark at least one service bookable first — an open page with nothing to book helps nobody.'}
        </span>
        <Switch
          checked={publish}
          disabled={!hasBookableServices}
          label="Open my booking page"
          onChange={onTogglePublish}
        />
      </div>

      {loadFailed ? (
        <p
          role="alert"
          className="rounded-[14px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3.5 py-3 text-[12.5px] text-[var(--warn-text)]"
        >
          We could not load your current booking setup, so what is shown here are defaults rather
          than your settings. Saving is disabled to avoid overwriting them. Reload the page to try
          again.
        </p>
      ) : null}
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
        onClick={onSave}
        disabled={saving || loadFailed}
        className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-[var(--cta)] text-[var(--cta-text)] text-[13.5px] font-semibold disabled:opacity-60"
      >
        <IoSaveOutline size={15} />
        {saving ? 'Saving…' : 'Save booking setup'}
      </button>
    </div>
  </>
);

/**
 * What to tell the practice after a save.
 *
 * Three distinct outcomes, and conflating them is how the old wizard misled
 * people: the page is live and has an address to share, the practice asked to
 * publish but this environment has no public origin configured so nothing is
 * reachable yet, or the practice deliberately left it closed.
 */
const resolveSavedMessage = (saved: BookingPageConfig): string => {
  if (saved.publicUrl) return 'Your booking page is live at the address above.';
  if (saved.publicBookingEnabled) {
    return 'Saved. Your booking page is switched on, but no public address is configured for this environment yet.';
  }
  return 'Saved. Your booking page is closed to pet parents until you open it.';
};

const PublicBookingSetup = () => {
  const { notify } = useNotify();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrg = usePrimaryOrg();
  const services = useRevampCatalogStore((s) => s.services);
  const specialities = useRevampCatalogStore((s) => s.specialities);
  const loadOrganisationCatalog = useRevampCatalogStore((s) => s.loadOrganisationCatalog);
  const loadSpecialityCatalog = useRevampCatalogStore((s) => s.loadSpecialityCatalog);

  const orgName = primaryOrg?.name || 'Your clinic';
  const orgInitial = orgName.charAt(0).toUpperCase();

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
  const [bookingWindowDays, setBookingWindowDays] = useState(WINDOW_OPTIONS[1].days);
  const [bufferMinutes, setBufferMinutes] = useState(BUFFER_OPTIONS[1].minutes);
  const [needsConfirmation, setNeedsConfirmation] = useState(true);
  const [welcome, setWelcome] = useState(`Book a visit for your companion at ${orgName}.`);
  const [replyTo, setReplyTo] = useState('');
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<BookingPageConfig | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishOverride, setPublishOverride] = useState<boolean | null>(null);

  // A practice that has saved before gets its own selection back, including a
  // deliberate empty one; a practice that has never saved gets everything
  // bookable pre-selected. `configured` is what separates those two, because
  // both arrive as an empty `serviceIds`.
  //
  // Stored ids are intersected with what is currently bookable. A service that
  // was archived after it was chosen no longer has a row to deselect it with,
  // and the API rejects ids that are not active and bookable - so carrying it
  // forward would leave the practice unable to save anything at all.
  const storedSelection = useMemo(
    () =>
      config?.configured ? new Set(config.serviceIds.filter((id) => allBookableIds.has(id))) : null,
    [config, allBookableIds]
  );
  const selected = selectionOverride ?? storedSelection ?? allBookableIds;

  // Publication follows the stored value until the practice touches the switch.
  const publish = publishOverride ?? config?.publicBookingEnabled ?? false;
  const hasBookableServices = allBookableIds.size > 0;

  useEffect(() => {
    if (primaryOrgId) {
      Promise.resolve(loadOrganisationCatalog(primaryOrgId)).catch(() => undefined);
    }
  }, [primaryOrgId, loadOrganisationCatalog]);

  // `loadOrganisationCatalog` populates `specialities` and nothing else -
  // services are fetched one speciality at a time by `loadSpecialityCatalog`.
  // Without this fan-out `services` is permanently empty, so the bookable list
  // below rendered "No bookable services yet" for every practice no matter what
  // its catalogue contained. The store dedupes by in-flight promise and by
  // `loadedSpecialityIds`, so re-running this effect is cheap.
  useEffect(() => {
    if (!primaryOrgId) return;
    specialities.forEach((speciality) => {
      if (speciality.organisationId !== primaryOrgId) return;
      Promise.resolve(loadSpecialityCatalog(primaryOrgId, speciality.id)).catch(() => undefined);
    });
  }, [primaryOrgId, specialities, loadSpecialityCatalog]);

  useEffect(() => {
    if (!primaryOrgId) return;
    let cancelled = false;

    bookingPageApi
      .getConfig(primaryOrgId)
      .then((loaded) => {
        if (cancelled) return;
        setLoadFailed(false);
        setConfig(loaded);
        setBookingWindowDays(loaded.bookingWindowDays);
        setBufferMinutes(loaded.bufferMinutes);
        setNeedsConfirmation(!loaded.autoConfirm);
        setPublishOverride(null);
        if (loaded.welcomeMessage) setWelcome(loaded.welcomeMessage);
        if (loaded.replyToEmail) setReplyTo(loaded.replyToEmail);
      })
      .catch(() => {
        // A failed load leaves the form on its defaults, which are NOT this
        // practice's settings. Saving them would overwrite a stored selection
        // with defaults the user never chose, turning a transient read outage
        // into data loss - so record the failure and let it disable saving.
        // `config` is also cleared, because it is what decides whether a
        // booking address is shown at all.
        if (cancelled) return;
        setConfig(null);
        setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [primaryOrgId]);

  const toggleService = (id: string) => {
    setSelectionOverride((prev) => {
      // `selected`, not `allBookableIds`: before the first toggle the override is
      // null and the visible selection is the stored one, so seeding from every
      // bookable id would silently re-select services the practice had removed.
      const next = new Set(prev ?? selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Takes the address as an argument rather than reading it back out of state:
  // the only caller is the button inside the published branch, which already
  // holds a non-null URL, so there is no "no address" case to handle.
  const handleCopy = (url: string) => {
    void copyText(url).then((ok) => {
      if (ok) setCopied(true);
    });
  };

  const handleSave = () => {
    if (!primaryOrgId || saving || loadFailed) return;
    setSaving(true);

    bookingPageApi
      .saveConfig(primaryOrgId, {
        // Filtered again at the boundary: `selected` can only contain bookable
        // ids by construction, but the API rejects the whole payload if one is
        // not, and a rejected save tells the practice nothing useful.
        serviceIds: [...selected].filter((id) => allBookableIds.has(id)),
        bookingWindowDays,
        bufferMinutes,
        autoConfirm: !needsConfirmation,
        welcomeMessage: welcome.trim() || null,
        replyToEmail: replyTo.trim() || null,
        publicBookingEnabled: publish,
      })
      .then((saved) => {
        setConfig(saved);
        setSelectionOverride(null);
        notify('success', {
          title: 'Booking setup saved',
          text: resolveSavedMessage(saved),
        });
      })
      .catch(() => {
        notify('error', {
          title: 'Could not save booking setup',
          text: 'Nothing was changed. Please try again.',
        });
      })
      .finally(() => setSaving(false));
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
      <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--ink-faint)]">
        Public booking · onboarding
      </span>

      <div className="w-full max-w-[708px] rounded-[22px] border border-[var(--hairline)] bg-[var(--screen)] overflow-hidden shadow-[0_2px_6px_var(--sh05),0_24px_60px_var(--sh10)]">
        {step === 1 ? (
          <BookingServicesStep
            step={step}
            bookableServices={bookableServices}
            selected={selected}
            onToggleService={toggleService}
            bookingWindowDays={bookingWindowDays}
            onBookingWindowChange={setBookingWindowDays}
            bufferMinutes={bufferMinutes}
            onBufferChange={setBufferMinutes}
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
            slug={config?.slug ?? null}
            publicUrl={config?.publicUrl ?? null}
            publicBookingEnabled={config?.publicBookingEnabled ?? false}
            copied={copied}
            onCopy={handleCopy}
            onReplaceLogo={handleReplaceLogo}
            onBack={() => setStep(1)}
            onSave={handleSave}
            saving={saving}
            loadFailed={loadFailed}
            publish={publish}
            onTogglePublish={() => setPublishOverride(!publish)}
            hasBookableServices={hasBookableServices}
          />
        )}
      </div>
    </div>
  );
};

export default PublicBookingSetup;
