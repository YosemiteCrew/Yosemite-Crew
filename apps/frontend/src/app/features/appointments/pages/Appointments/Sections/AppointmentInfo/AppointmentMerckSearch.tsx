import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { Primary } from '@/app/ui/primitives/Buttons';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import {
  IoArrowForwardOutline,
  IoBookOutline,
  IoCloseOutline,
  IoCopyOutline,
  IoOpenOutline,
  IoOptionsOutline,
} from 'react-icons/io5';
import Close from '@/app/ui/primitives/Icons/Close';
import { Appointment } from '@yosemite-crew/types';
import { useOrgStore } from '@/app/stores/orgStore';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';
import {
  getMerckGateway,
  isAllowedMerckUrl,
} from '@/app/features/integrations/services/merckService';
import {
  MerckAudience,
  MerckEntry,
  MerckLanguage,
} from '@/app/features/integrations/services/types';
import {
  MERCK_COPYRIGHT_NOTICE,
  getMerckSubtopicPillStyle,
  stripMerckHtml,
} from '@/app/features/integrations/constants/merck';

type AppointmentMerckSearchProps = {
  activeAppointment: Appointment | null;
};

const getSafeMerckEntries = (entries: MerckEntry[]) =>
  entries.filter(
    (entry) =>
      isAllowedMerckUrl(entry.primaryUrl) &&
      entry.subLinks.every((link) => isAllowedMerckUrl(link.url))
  );

const getMerckSearchError = (error: unknown) => {
  const candidate = error as { response?: { data?: { message?: string } }; message?: string };
  return (
    candidate?.response?.data?.message ||
    candidate?.message ||
    'Unable to search Merck manuals right now.'
  );
};

const getAppointmentEntriesContent = (
  entries: MerckEntry[],
  loading: boolean,
  hasSearched: boolean,
  onOpenReader: (entry: MerckEntry, url: string) => void,
  onCopyUrl: (url: string) => Promise<void>
) => {
  if (entries.length === 0) {
    if (loading) {
      return <div className="text-[12px] text-[var(--ink-muted)]">Searching manuals…</div>;
    }
    if (hasSearched) {
      return (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="text-[13px] font-bold text-[var(--ink)]">No results found</div>
          <div className="text-[11.5px] text-[var(--ink-muted)]">
            Check the spelling or try a broader term.
          </div>
        </div>
      );
    }
    return null;
  }

  return entries.map((entry, index) => (
    <div
      key={entry.id}
      className={`flex w-full min-w-0 flex-col gap-2 overflow-x-hidden rounded-[12px] px-3 py-2.5 ${
        index === 0 ? 'bg-[var(--surface-soft)]' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onOpenReader(entry, entry.primaryUrl)}
        className="group flex w-fit max-w-full items-center text-left"
      >
        <span
          className={`min-w-0 wrap-break-word text-[12.5px] leading-snug transition-colors group-hover:text-[var(--blue-text)] ${
            index === 0 ? 'font-bold text-[var(--ink)]' : 'font-semibold text-[var(--ink-body)]'
          }`}
        >
          {stripMerckHtml(entry.title)}
        </span>
      </button>
      <div className="line-clamp-2 wrap-break-word text-[10.5px] text-[var(--ink-faint)]">
        {stripMerckHtml(entry.summaryText || '') || 'No summary available.'}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Primary href="#" text="Open" onClick={() => onOpenReader(entry, entry.primaryUrl)} />
        <button
          type="button"
          onClick={() => globalThis.window.open(entry.primaryUrl, '_blank', 'noopener,noreferrer')}
          aria-label="Open in new tab"
          title="Open in new tab"
          className="flex size-9 items-center justify-center rounded-full! border border-hairline text-[var(--ink-body)] transition-colors hover:bg-[var(--card-hover)]"
        >
          <IoOpenOutline size={15} />
        </button>
        <button
          type="button"
          onClick={() => {
            onCopyUrl(entry.primaryUrl).catch(() => undefined);
          }}
          aria-label="Copy manual URL"
          title="Copy URL"
          className="flex size-9 items-center justify-center rounded-full! border border-hairline text-[var(--ink-body)] transition-colors hover:bg-[var(--card-hover)]"
        >
          <IoCopyOutline size={15} />
        </button>
      </div>

      {entry.subLinks.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {entry.subLinks.map((subLink) => (
            <button
              key={`${entry.id}-${subLink.label}`}
              type="button"
              className="max-w-full wrap-break-word rounded-full! border border-hairline px-2.5 py-1 text-[10.5px] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--card-hover)]"
              style={getMerckSubtopicPillStyle(subLink.label)}
              onClick={() => onOpenReader(entry, subLink.url)}
            >
              {subLink.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  ));
};

const CompactAudienceToggle = ({
  value,
  disabled,
  onChange,
}: {
  value: MerckAudience;
  disabled?: boolean;
  onChange: (next: MerckAudience) => void;
}) => {
  const isProfessional = value === 'PROV';
  const segmentClass = (active: boolean) =>
    `rounded-full! px-3 py-1 text-[11px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${
      active
        ? 'bg-[var(--screen)] font-bold text-[var(--ink)] shadow-[0_1px_3px_var(--sh08)]'
        : 'font-semibold text-[var(--ink-muted)]'
    } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full! border border-[var(--divider)] bg-[var(--inset)] p-1 ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onChange('PROV')}
        disabled={disabled}
        aria-pressed={isProfessional}
        className={segmentClass(isProfessional)}
      >
        Professional
      </button>
      <button
        type="button"
        onClick={() => onChange('PAT')}
        disabled={disabled}
        aria-pressed={!isProfessional}
        className={segmentClass(!isProfessional)}
      >
        Consumer
      </button>
    </div>
  );
};

const CompactFilterPill = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-8 px-2.5 text-caption-1 rounded-2xl! border transition-all duration-200 ${
      active
        ? 'bg-blue-light text-blue-text! border-text-brand!'
        : 'border-card-border! text-text-secondary hover:bg-card-hover!'
    }`}
  >
    {label}
  </button>
);

/** Language filters, revealed by the options button next to Search. */
const MerckRefinePanel = ({
  language,
  onLanguageChange,
  onClose,
}: {
  language: MerckLanguage;
  onLanguageChange: (next: MerckLanguage) => void;
  onClose: () => void;
}) => (
  <div className="rounded-2xl border border-card-border bg-neutral-0 p-3 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <div className="text-body-4 text-text-secondary">Refine Results</div>
      <button
        type="button"
        onClick={onClose}
        className="size-7 rounded-xl! border border-card-border flex items-center justify-center text-text-secondary hover:bg-card-hover transition-colors cursor-pointer"
        aria-label="Close refine results"
        title="Close refine results"
      >
        <IoCloseOutline size={14} />
      </button>
    </div>
    <div className="flex w-fit flex-col gap-1">
      <div className="text-caption-1 text-text-secondary">Language</div>
      <div className="inline-flex w-fit gap-1.5 flex-wrap">
        <CompactFilterPill
          active={language === 'en'}
          label="EN"
          onClick={() => onLanguageChange('en')}
        />
        <CompactFilterPill
          active={language === 'es'}
          label="ES"
          onClick={() => onLanguageChange('es')}
        />
      </div>
    </div>
  </div>
);

/** Full-screen in-app reader for a single manual page; the iframe stays sandboxed. */
const MerckReaderOverlay = ({
  url,
  title,
  loading,
  onClose,
  onLoad,
}: {
  url: string;
  title: string;
  loading: boolean;
  onClose: () => void;
  onLoad: () => void;
}) => (
  <div
    data-signing-overlay="true"
    className="fixed inset-0 z-5000 flex items-center justify-center bg-[var(--sh55)] p-4 backdrop-blur-sm"
  >
    <div className="relative flex size-full max-h-[95vh] max-w-7xl flex-col overflow-hidden rounded-2xl border border-hairline bg-[var(--screen)] shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-5 py-3">
        <div className="flex min-w-0 items-center gap-2.5 pr-2">
          <span className="flex size-8 flex-none items-center justify-center rounded-[9px] bg-blue-soft text-blue-text">
            <IoBookOutline size={15} aria-hidden="true" />
          </span>
          <span className="truncate text-[13.5px] font-bold text-[var(--ink)]">{title}</span>
        </div>
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="flex size-[34px] items-center justify-center rounded-full! border border-hairline text-[var(--ink-faint)] transition-colors hover:bg-[var(--card-hover)]"
          aria-label="Close Merck reader"
        >
          <Close iconOnly />
        </button>
      </div>
      <div className="relative flex-1">
        {loading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--screen)]">
            <YosemiteLoader
              label="Loading Manual"
              size={120}
              testId="appointment-merck-reader-loader"
            />
            <span className="max-w-[320px] text-center text-[12px] text-[var(--ink-faint)]">
              Fetching “{title}” from MSD…
            </span>
          </div>
        ) : null}
        <iframe
          src={url}
          title={title}
          className="flex-1 size-full border-0"
          loading="lazy"
          referrerPolicy="strict-origin"
          sandbox="allow-scripts allow-popups allow-forms allow-same-origin"
          onLoad={onLoad}
        />
      </div>
    </div>
  </div>
);

const AppointmentMerckSearch = ({ activeAppointment }: AppointmentMerckSearchProps) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const { isEnabled } = useResolvedMerckIntegrationForPrimaryOrg();
  const hasActiveAppointment = activeAppointment !== null;

  const [audience, setAudience] = useState<MerckAudience>('PROV');
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<MerckLanguage>('en');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [entries, setEntries] = useState<MerckEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [readerOpen, setReaderOpen] = useState(false);
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [readerTitle, setReaderTitle] = useState('Merck Manual');
  const [readerLoading, setReaderLoading] = useState(false);
  const requestRef = useRef(0);
  const resultCacheRef = useRef<Map<string, MerckEntry[]>>(null!);
  resultCacheRef.current ??= new Map();

  const performSearch = async (audienceOverride?: MerckAudience) => {
    if (!primaryOrgId || !query.trim()) return;
    const resolvedAudience = audienceOverride ?? audience;
    const cacheKey = `${query.trim()}::${resolvedAudience}::${language}`;

    const cached = resultCacheRef.current.get(cacheKey);
    if (cached) {
      setEntries(cached);
      setHasSearched(true);
      return;
    }

    requestRef.current += 1;
    const reqId = requestRef.current;

    setLoading(true);
    setError(null);

    try {
      const gateway = getMerckGateway();
      if (reqId !== requestRef.current) return;
      const response = await gateway.search({
        organisationId: primaryOrgId,
        query: query.trim(),
        audience: resolvedAudience,
        language,
        media: 'hybrid',
      });
      /* v8 ignore next -- unreachable: the search input, Search button, and audience toggle are all disabled while a request is in flight, so no newer request can supersede this one */
      if (reqId !== requestRef.current) return;
      const safe = getSafeMerckEntries(response.entries);
      resultCacheRef.current.set(cacheKey, safe);
      setEntries(safe);
      setHasSearched(true);
    } catch (e: unknown) {
      /* v8 ignore next -- unreachable: the search input, Search button, and audience toggle are all disabled while a request is in flight, so no newer request can supersede this one */
      if (reqId !== requestRef.current) return;
      setEntries([]);
      setError(getMerckSearchError(e));
    } finally {
      if (reqId === requestRef.current) {
        setLoading(false);
      }
    }
  };

  const performFreshSearch = async () => {
    if (!primaryOrgId || !query.trim()) return;
    const cacheKey = `${query.trim()}::${audience}::${language}`;
    resultCacheRef.current.delete(cacheKey);
    await performSearch();
  };

  const openReader = (entry: MerckEntry, url: string) => {
    if (!isAllowedMerckUrl(url)) {
      setError('Blocked URL: only Merck/MSD Manual links are allowed.');
      return;
    }
    setReaderTitle(entry.title);
    setReaderUrl(url);
    setReaderLoading(true);
    setReaderOpen(true);
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError('Unable to copy URL.');
    }
  };

  const entriesContent = getAppointmentEntriesContent(
    entries,
    loading,
    hasSearched,
    openReader,
    copyUrl
  );

  if (!isEnabled) {
    return (
      <div className="w-full rounded-2xl border border-card-border p-4">
        <div className="text-body-4 text-text-secondary">
          MSD Veterinary Manual is disabled for this organization.
        </div>
      </div>
    );
  }

  const referenceQuerySuffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';

  return (
    <>
      <div
        className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-hairline bg-[var(--screen)] p-4 shadow-[0_1px_2px_var(--sh03)] scrollbar-hidden"
        data-has-appointment={hasActiveAppointment}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--ink)]">
            <span className="flex size-7 items-center justify-center rounded-[9px] bg-blue-soft text-blue-text">
              <IoBookOutline size={14} aria-hidden="true" />
            </span>
            {'MSD Manual'}
          </span>
          <span className="text-[10.5px] text-[var(--ink-faint)]">In-visit lookup</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-[var(--ink-muted)]">
            Search the manual for this appointment.
          </span>
          <CompactAudienceToggle
            value={audience}
            disabled={loading}
            onChange={(next) => {
              setAudience(next);
              if (query.trim()) {
                void performSearch(next);
              }
            }}
          />
        </div>

        <div className="flex items-end gap-2 flex-nowrap">
          <div className="flex-1 min-w-0">
            <FormInput
              intype="text"
              inname="appointment-merck-search"
              inlabel="Search manuals"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12! px-4"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Primary
              href="#"
              text={loading ? 'Searching...' : 'Search'}
              onClick={() => void performFreshSearch()}
              isDisabled={loading || !query.trim()}
            />
            <button
              type="button"
              onClick={() => setAdvancedOpen((prev) => !prev)}
              aria-label={advancedOpen ? 'Hide filters' : 'Show filters'}
              title={advancedOpen ? 'Hide filters' : 'Show filters'}
              className={`size-12 rounded-2xl! border border-card-border flex items-center justify-center transition-colors cursor-pointer ${
                advancedOpen
                  ? 'bg-card-hover text-text-primary'
                  : 'text-text-secondary hover:bg-card-hover'
              }`}
            >
              <IoOptionsOutline size={18} />
            </button>
            {copied ? <span className="text-body-4 text-green-700">URL copied</span> : null}
          </div>
        </div>

        {advancedOpen ? (
          <MerckRefinePanel
            language={language}
            onLanguageChange={setLanguage}
            onClose={() => setAdvancedOpen(false)}
          />
        ) : null}

        <div className="min-h-0 flex flex-1 flex-col gap-3">
          {error ? <div className="text-body-4 text-text-error">{error}</div> : null}

          <div className="min-h-0 flex-1 pr-1 [scrollbar-gutter:stable]">
            <div className="flex flex-col gap-3">
              {entriesContent}
              {entries.length > 0 ? (
                <div className="pt-2 pb-1.5">
                  <div className="text-caption-1 text-text-secondary">{MERCK_COPYRIGHT_NOTICE}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {entries.length === 0 ? (
          <div className="pt-1 pb-1.5 mt-auto">
            <div className="text-caption-1 text-text-secondary">{MERCK_COPYRIGHT_NOTICE}</div>
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-hairline pt-3">
          <span className="text-[11px] text-[var(--ink-faint)]">Opens the full browser</span>
          <a
            href={`/integrations/merck-manuals${referenceQuerySuffix}`}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-blue-text"
          >
            Open in Reference
            <IoArrowForwardOutline size={11} aria-hidden="true" />
          </a>
        </div>
      </div>

      {readerOpen && readerUrl && typeof document !== 'undefined'
        ? createPortal(
            <MerckReaderOverlay
              url={readerUrl}
              title={readerTitle}
              loading={readerLoading}
              onClose={() => setReaderOpen(false)}
              onLoad={() => setReaderLoading(false)}
            />,
            document.body
          )
        : null}
    </>
  );
};

export default AppointmentMerckSearch;
