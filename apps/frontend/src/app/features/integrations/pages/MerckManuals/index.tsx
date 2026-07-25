'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

const MERCK_PAGE_SKELETON = <PageSkeleton variant="list" />;
import Close from '@/app/ui/primitives/Icons/Close';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
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
import { formatDateTimeLocal } from '@/app/lib/date';
import { getJsonStorageItem, setJsonStorageItem } from '@/app/lib/browserStorage';
import {
  IoBookOutline,
  IoCloseOutline,
  IoCopyOutline,
  IoInformationCircleOutline,
  IoLinkOutline,
  IoOpenOutline,
  IoOptionsOutline,
  IoSearchOutline,
} from 'react-icons/io5';
import StatusPill, { StatusPillTokens } from '@/app/ui/primitives/StatusPill/StatusPill';

type MerckManualsPageProps = {
  embedded?: boolean;
};

const RECENT_SEARCHES_LIMIT = 8;

const getRecentSearchesKey = (orgId: string, audience: MerckAudience) =>
  `yc:merck:recent:${orgId}:${audience}`;

const getRecentSearches = (orgId: string, audience: MerckAudience): string[] => {
  const parsed = getJsonStorageItem<unknown>('local', getRecentSearchesKey(orgId, audience));
  return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
};

const saveRecentSearch = (orgId: string, audience: MerckAudience, value: string) => {
  const query = value.trim();
  /* v8 ignore next -- unreachable: saveRecentSearch only runs with the already-trimmed, non-empty resolvedQuery */
  if (!query) return;
  const prev = getRecentSearches(orgId, audience).filter(
    (item) => item.toLowerCase() !== query.toLowerCase()
  );
  const next = [query, ...prev].slice(0, RECENT_SEARCHES_LIMIT);
  setJsonStorageItem('local', getRecentSearchesKey(orgId, audience), next);
};

const safeDate = (value?: string | null) => {
  return formatDateTimeLocal(value, 'N/A');
};

const MerckNoResultsState = ({ query }: { query: string }) => (
  <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
    <span className="flex size-14 items-center justify-center rounded-full bg-[var(--inset)] text-[var(--ink-faint)]">
      <IoSearchOutline size={24} aria-hidden="true" />
    </span>
    <span className="text-[15px] font-bold text-[var(--ink)]">No results for “{query}”</span>
    <span className="max-w-[380px] text-[12.5px] leading-relaxed text-[var(--ink-muted)]">
      Check the spelling or try a broader term. The manual searches titles and full text.
    </span>
  </div>
);

const getResultsContent = (
  entries: MerckEntry[],
  loading: boolean,
  hasSearched: boolean,
  query: string,
  onOpenInFrame: (entry: MerckEntry, url: string) => void,
  onCopyUrl: (url: string) => void
) => {
  if (entries.length === 0) {
    if (loading) {
      return <div className="text-body-4 text-text-secondary">Searching manuals…</div>;
    }
    if (hasSearched) {
      return <MerckNoResultsState query={query.trim() || '—'} />;
    }
    return null;
  }

  return entries.map((entry) => (
    <EntryCard key={entry.id} entry={entry} onOpenInFrame={onOpenInFrame} onCopy={onCopyUrl} />
  ));
};

const getDisabledState = (isEnabled?: boolean) => isEnabled === false;

const getMerckSearchPayload = ({
  organisationId,
  query,
  audience,
  language,
}: {
  organisationId: string;
  query: string;
  audience: MerckAudience;
  language: MerckLanguage;
}) => ({
  organisationId,
  query,
  audience,
  language,
  media: 'hybrid' as const,
});

const getSafeMerckResults = (entries: MerckEntry[]) =>
  entries.filter(
    (entry) =>
      isAllowedMerckUrl(entry.primaryUrl) &&
      entry.subLinks.every((link) => isAllowedMerckUrl(link.url))
  );

const getMerckErrorMessage = (error: unknown) => {
  const candidate = error as { response?: { data?: { message?: string } }; message?: string };
  return (
    candidate?.response?.data?.message ||
    candidate?.message ||
    'Unable to search manuals right now.'
  );
};

const getMerckContainerClassName = (embedded: boolean) =>
  embedded ? 'w-full p-4 md:p-6 bg-neutral-0 min-h-screen' : 'yc-page-content';

const getMerckResultsContainerClassName = (embedded: boolean) =>
  embedded
    ? 'min-h-0 flex-1 overflow-y-auto pr-1'
    : 'min-h-0 flex-1 overflow-y-auto pr-1 max-h-[calc(100vh-320px)] lg:max-h-[calc(100vh-280px)]';

const AUDIENCE_SEGMENT_BASE =
  'rounded-full! px-3.5 py-1.5 text-[12px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand';

const AudienceToggle = ({
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
    `${AUDIENCE_SEGMENT_BASE} ${
      active
        ? 'bg-[var(--screen)] font-bold text-[var(--ink)] shadow-[0_1px_3px_var(--sh08)]'
        : 'font-semibold text-[var(--ink-muted)]'
    } ${
      /* v8 ignore next -- unreachable: AudienceToggle renders only inside the enabled panel, so disabled is always false */
      disabled ? 'cursor-not-allowed' : 'cursor-pointer'
    }`;

  return (
    <fieldset
      className={`inline-flex items-center gap-1 self-start rounded-full! border border-[var(--divider)] bg-[var(--inset)] p-1 ${
        /* v8 ignore next -- unreachable: AudienceToggle renders only inside the enabled panel, so disabled is always false */
        disabled ? 'opacity-70' : ''
      }`}
    >
      <legend className="sr-only">Refine results, audience</legend>
      <button
        type="button"
        onClick={() => onChange('PROV')}
        disabled={disabled}
        aria-pressed={isProfessional}
        className={segmentClass(isProfessional)}
      >
        Veterinary professional
      </button>
      <button
        type="button"
        onClick={() => onChange('PAT')}
        disabled={disabled}
        aria-pressed={!isProfessional}
        className={segmentClass(!isProfessional)}
      >
        Pet parent version
      </button>
    </fieldset>
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
    aria-pressed={active}
    className={`h-8 px-2.5 text-caption-1 rounded-2xl! border transition-all duration-200 ${
      active
        ? 'bg-blue-light text-blue-text! border-text-brand!'
        : 'border-card-border! text-text-secondary hover:bg-card-hover!'
    }`}
  >
    {label}
  </button>
);

const EntryCard = ({
  entry,
  onOpenInFrame,
  onCopy,
}: {
  entry: MerckEntry;
  onOpenInFrame: (entry: MerckEntry, url: string) => void;
  onCopy: (url: string) => void;
}) => {
  const summary = stripMerckHtml(entry.summaryText || '').slice(0, 280);
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-hairline bg-[var(--screen)] p-3.5 shadow-[0_1px_2px_var(--sh03)] transition-colors hover:border-[var(--hairline-hover)]">
      <button
        type="button"
        onClick={() => onOpenInFrame(entry, entry.primaryUrl)}
        disabled={!isAllowedMerckUrl(entry.primaryUrl)}
        className="group flex w-fit max-w-full items-center text-left"
      >
        <span className="text-[13.5px] font-bold leading-snug text-[var(--ink)] transition-colors group-hover:text-[var(--blue-text)] group-hover:underline disabled:no-underline">
          {stripMerckHtml(entry.title)}
        </span>
      </button>
      <div className="line-clamp-2 text-[11.5px] leading-relaxed text-[var(--ink-muted)]">
        {summary || 'No summary available.'}
      </div>
      <div className="text-[10.5px] text-[var(--ink-faint)]">
        Updated {safeDate(entry.updatedAt)}
      </div>

      {entry.subLinks.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {entry.subLinks.map((subLink) => (
            <button
              key={`${entry.id}-${subLink.label}`}
              type="button"
              className="max-w-full rounded-full! border border-hairline px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--card-hover)]"
              style={getMerckSubtopicPillStyle(subLink.label)}
              onClick={() => onOpenInFrame(entry, subLink.url)}
            >
              {subLink.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Primary
          href="#"
          text="Open"
          onClick={() => onOpenInFrame(entry, entry.primaryUrl)}
          isDisabled={!isAllowedMerckUrl(entry.primaryUrl)}
        />
        <button
          type="button"
          onClick={() => {
            if (globalThis.window === undefined) return;
            globalThis.window.open(entry.primaryUrl, '_blank', 'noopener,noreferrer');
          }}
          aria-label="Open in new tab"
          title="Open in new tab"
          className="flex size-10 items-center justify-center rounded-full! border border-hairline text-[var(--ink-body)] transition-colors hover:bg-[var(--card-hover)]"
        >
          <IoOpenOutline size={16} />
        </button>
        <button
          type="button"
          onClick={() => onCopy(entry.primaryUrl)}
          aria-label="Copy manual URL"
          title="Copy URL"
          className="flex size-10 items-center justify-center rounded-full! border border-hairline text-[var(--ink-body)] transition-colors hover:bg-[var(--card-hover)]"
        >
          <IoCopyOutline size={16} />
        </button>
      </div>
    </div>
  );
};

type ExecuteMerckSearchParams = {
  organisationId: string;
  query: string;
  audience: MerckAudience;
  language: MerckLanguage;
  requestIdRef: { current: number };
  resultCacheRef: { current: Map<string, MerckEntry[]> };
  fresh?: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setEntries: React.Dispatch<React.SetStateAction<MerckEntry[]>>;
  onSearchSaved?: () => void;
  setHasSearched?: React.Dispatch<React.SetStateAction<boolean>>;
};

const executeMerckSearch = async ({
  organisationId,
  query,
  audience,
  language,
  requestIdRef,
  resultCacheRef,
  fresh = false,
  setLoading,
  setError,
  setEntries,
  onSearchSaved,
  setHasSearched,
}: ExecuteMerckSearchParams) => {
  const resolvedQuery = query.trim();
  /* v8 ignore next -- unreachable: every caller (search button, recent chip, audience change, route effect) guards a non-empty query first */
  if (!resolvedQuery) return;

  const cacheKey = `${resolvedQuery}::${audience}::${language}`;
  if (fresh) {
    resultCacheRef.current.delete(cacheKey);
  }
  const cached = resultCacheRef.current.get(cacheKey);
  if (cached) {
    setEntries(cached);
    setHasSearched?.(true);
    return;
  }

  requestIdRef.current += 1;
  const reqId = requestIdRef.current;
  setLoading(true);
  setError(null);

  try {
    const gateway = getMerckGateway();
    if (reqId !== requestIdRef.current) return;
    const response = await gateway.search(
      getMerckSearchPayload({
        organisationId,
        query: resolvedQuery,
        audience,
        language,
      })
    );

    if (reqId !== requestIdRef.current) return;

    const safe = getSafeMerckResults(response.entries);
    resultCacheRef.current.set(cacheKey, safe);
    setEntries(safe);
    setHasSearched?.(true);
    saveRecentSearch(organisationId, audience, resolvedQuery);
    onSearchSaved?.();
  } catch (e: unknown) {
    if (reqId !== requestIdRef.current) return;
    setEntries([]);
    setError(getMerckErrorMessage(e));
  } finally {
    if (reqId === requestIdRef.current) {
      setLoading(false);
    }
  }
};

const MerckDisabledState = ({ embedded }: { embedded: boolean }) => (
  <div className="rounded-2xl border border-card-border p-4 flex flex-col gap-3">
    <div className="text-body-2 text-text-primary">
      MSD Veterinary Manual is disabled for this organization.
    </div>
    {embedded ? null : <Secondary href="/integrations" text="Manage Integrations" />}
  </div>
);

const MicroCaption = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
    {children}
  </span>
);

const MerckSearchPanel = ({
  query,
  setQuery,
  loading,
  performSearch,
  advancedOpen,
  setAdvancedOpen,
  language,
  setLanguage,
  recentSearches,
  audience,
  onAudienceChange,
  disabled,
}: {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  performSearch: (nextQuery?: string, fresh?: boolean) => Promise<void>;
  advancedOpen: boolean;
  setAdvancedOpen: React.Dispatch<React.SetStateAction<boolean>>;
  language: MerckLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<MerckLanguage>>;
  recentSearches: string[];
  audience: MerckAudience;
  onAudienceChange: (next: MerckAudience) => void;
  disabled?: boolean;
}) => (
  <div className="flex flex-col gap-3.5">
    <div className="flex items-end gap-2 flex-nowrap">
      <div className="flex-1 min-w-0">
        <FormInput
          intype="text"
          inname="merck-search"
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
          onClick={() => void performSearch(undefined, true)}
          isDisabled={loading || !query.trim()}
          className="h-12!"
        />
        <button
          type="button"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          aria-label={advancedOpen ? 'Hide filters' : 'Show filters'}
          title={advancedOpen ? 'Hide filters' : 'Show filters'}
          className={`flex size-12 items-center justify-center rounded-full! border border-hairline transition-colors cursor-pointer ${
            advancedOpen
              ? 'bg-[var(--card-hover)] text-[var(--ink)]'
              : 'text-[var(--ink-muted)] hover:bg-[var(--card-hover)]'
          }`}
        >
          <IoOptionsOutline size={18} />
        </button>
      </div>
    </div>

    {recentSearches.length > 0 ? (
      <div className="flex flex-col gap-2">
        <MicroCaption>Frequent searches</MicroCaption>
        <div className="flex gap-1.5 flex-wrap">
          {recentSearches.map((searchTerm) => (
            <button
              key={searchTerm}
              type="button"
              className="rounded-full! border border-hairline px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--card-hover)]"
              onClick={() => {
                setQuery(searchTerm);
                void performSearch(searchTerm);
              }}
            >
              {searchTerm}
            </button>
          ))}
        </div>
      </div>
    ) : null}

    <div className="flex flex-col gap-2">
      <MicroCaption>Refine results · audience</MicroCaption>
      <AudienceToggle value={audience} disabled={disabled} onChange={onAudienceChange} />
    </div>

    {advancedOpen ? (
      <div className="flex flex-col gap-2 rounded-2xl border border-hairline bg-[var(--screen)] p-3">
        <div className="flex items-center justify-between">
          <MicroCaption>Refine results · language</MicroCaption>
          <button
            type="button"
            onClick={() => setAdvancedOpen(false)}
            className="flex size-7 items-center justify-center rounded-full! border border-hairline text-[var(--ink-faint)] transition-colors hover:bg-[var(--card-hover)]"
            aria-label="Close refine results"
            title="Close refine results"
          >
            <IoCloseOutline size={14} />
          </button>
        </div>
        <fieldset className="flex gap-1.5 flex-wrap" aria-label="Language">
          <CompactFilterPill
            active={language === 'en'}
            label="EN"
            onClick={() => setLanguage('en')}
          />
          <CompactFilterPill
            active={language === 'es'}
            label="ES"
            onClick={() => setLanguage('es')}
          />
        </fieldset>
      </div>
    ) : null}
  </div>
);

const READER_AUDIENCE_META: Record<MerckAudience, { label: string; tokens: StatusPillTokens }> = {
  PROV: {
    label: 'PROFESSIONAL',
    tokens: {
      bg: 'var(--status-upcoming-bg)',
      text: 'var(--status-upcoming-text)',
      border: 'var(--status-upcoming-border)',
    },
  },
  PAT: {
    label: 'PET PARENT',
    tokens: {
      bg: 'var(--blue-soft)',
      text: 'var(--blue-text)',
      border: 'var(--status-upcoming-border)',
    },
  },
};

const READER_FOOTER_NOTICE =
  "Content © MSD Veterinary Manual · displayed under your clinic's integration";

// Safety net for a manual that never finishes loading (network stall, MSD outage):
// cap the spinner and fall back to opening in a new tab.
const READER_LOAD_TIMEOUT_MS = 12000;

const MerckReaderFallback = ({
  readerUrl,
  readerTitle,
}: {
  readerUrl: string;
  readerTitle: string;
}) => (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--screen)] px-8 text-center">
    <span className="flex size-14 items-center justify-center rounded-full bg-[var(--inset)] text-[var(--ink-faint)]">
      <IoBookOutline size={24} aria-hidden="true" />
    </span>
    <span className="text-[15px] font-bold text-[var(--ink)]">This manual didn’t load</span>
    <span className="max-w-[380px] text-[12.5px] leading-relaxed text-[var(--ink-muted)]">
      MSD Veterinary Manual took too long to respond. Open “{readerTitle}” in a new tab to read the
      full content.
    </span>
    <Link
      href={readerUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-1 flex items-center gap-1.5 rounded-full! border border-hairline bg-[var(--screen)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-body)] transition-colors hover:bg-[var(--card-hover)]"
    >
      <IoOpenOutline size={14} aria-hidden="true" />
      Open in new tab
    </Link>
  </div>
);

const MerckReaderPortal = ({
  readerOpen,
  readerUrl,
  readerTitle,
  readerLoading,
  readerBlocked,
  audience,
  copied,
  onCopyUrl,
  setReaderOpen,
  setReaderLoading,
  setReaderBlocked,
}: {
  readerOpen: boolean;
  readerUrl: string | null;
  readerTitle: string;
  readerLoading: boolean;
  readerBlocked: boolean;
  audience: MerckAudience;
  copied: string | null;
  onCopyUrl: (url: string) => void;
  setReaderOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReaderLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setReaderBlocked: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const onReaderLoadFailed = useCallback(() => {
    setReaderLoading(false);
    setReaderBlocked(true);
  }, [setReaderLoading, setReaderBlocked]);

  useEffect(() => {
    if (!readerOpen || !readerUrl || !readerLoading) return;
    const timer = setTimeout(onReaderLoadFailed, READER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [readerOpen, readerUrl, readerLoading, onReaderLoadFailed]);

  if (!readerOpen || !readerUrl || typeof document === 'undefined') return null;

  const audienceMeta = READER_AUDIENCE_META[audience];

  return createPortal(
    <div
      className="fixed inset-0 z-10000 flex items-center justify-center bg-[var(--sh55)] p-4 backdrop-blur-sm"
      data-merck-reader-overlay="true"
    >
      <div className="relative flex size-full max-h-[95vh] max-w-7xl flex-col overflow-hidden rounded-2xl border border-hairline bg-[var(--screen)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-6 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 flex-none items-center justify-center rounded-[9px] bg-blue-soft text-blue-text">
              <IoBookOutline size={15} aria-hidden="true" />
            </span>
            <div
              id="merck-reader-title"
              className="truncate text-[13.5px] font-bold text-[var(--ink)]"
            >
              {readerTitle}
            </div>
            <StatusPill
              label={audienceMeta.label}
              tokens={audienceMeta.tokens}
              className="flex-none"
            />
          </div>
          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={() => onCopyUrl(readerUrl)}
              className="flex items-center gap-1.5 rounded-full! border border-hairline px-3 py-[7px] text-[12px] font-semibold text-[var(--ink-body)] transition-colors hover:bg-[var(--card-hover)]"
            >
              <IoLinkOutline size={13} aria-hidden="true" />
              {copied === readerUrl ? 'Copied!' : 'Copy manual URL'}
            </button>
            <Link
              href={readerUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full! border border-hairline px-3 py-[7px] text-[12px] font-semibold text-[var(--ink-body)] transition-colors hover:bg-[var(--card-hover)]"
            >
              <IoOpenOutline size={13} aria-hidden="true" />
              Open in new tab
            </Link>
            <button
              type="button"
              onClick={() => setReaderOpen(false)}
              className="flex size-[34px] items-center justify-center rounded-full! border border-hairline text-[var(--ink-faint)] transition-colors hover:bg-[var(--card-hover)]"
              aria-label="Close Merck reader"
            >
              <Close iconOnly />
            </button>
          </div>
        </div>
        <div className="relative flex-1">
          {readerBlocked ? (
            <MerckReaderFallback readerUrl={readerUrl} readerTitle={readerTitle} />
          ) : (
            <>
              {readerLoading ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--screen)]">
                  <YosemiteLoader label="Loading Manual" size={120} testId="merck-reader-loader" />
                  <span className="max-w-[320px] text-center text-[12px] text-[var(--ink-faint)]">
                    Fetching “{readerTitle}” from MSD…
                  </span>
                </div>
              ) : null}
              <iframe
                src={readerUrl}
                title={readerTitle}
                className="flex-1 size-full border-0"
                loading="lazy"
                referrerPolicy="strict-origin"
                // allow-same-origin is required: MSD's app reads document.cookie on boot and
                // throws in an opaque origin, leaving the frame stuck on its own loader. It is
                // safe here because the framed origin is never our own (isAllowedMerckUrl).
                sandbox="allow-scripts allow-popups allow-forms allow-same-origin"
                onLoad={() => setReaderLoading(false)}
                onError={onReaderLoadFailed}
              />
            </>
          )}
        </div>
        <div className="border-t border-hairline px-6 py-3">
          <span className="text-[11.5px] text-[var(--ink-faint)]">{READER_FOOTER_NOTICE}</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

const MerckManualsPage = ({ embedded = false }: MerckManualsPageProps) => {
  const searchParams = useSearchParams();
  const routeQuery = String(searchParams.get('q') ?? '').trim();
  const { isEnabled } = useResolvedMerckIntegrationForPrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  const [audience, setAudience] = useState<MerckAudience>('PROV');
  const [language, setLanguage] = useState<MerckLanguage>('en');
  const [query, setQuery] = useState(() => routeQuery || '');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [entries, setEntries] = useState<MerckEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [readerOpen, setReaderOpen] = useState(false);
  const [readerTitle, setReaderTitle] = useState('Merck Manual');
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerBlocked, setReaderBlocked] = useState(false);

  const requestIdRef = useRef(0);
  const resultCacheRef = useRef<Map<string, MerckEntry[]>>(null!);
  resultCacheRef.current ??= new Map();
  const performSearchRef = useRef<((nextQuery?: string, fresh?: boolean) => Promise<void>) | null>(
    null
  );

  // recentSearchesKey is a counter; bumping it re-reads recentSearches from storage on save.
  const [recentSearchesKey, setRecentSearchesKey] = useState(0);
  const recentSearches =
    recentSearchesKey >= 0 && primaryOrgId ? getRecentSearches(primaryOrgId, audience) : [];

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const performSearch = useCallback(
    async (nextQuery?: string, fresh?: boolean) => {
      if (!primaryOrgId) return;
      await executeMerckSearch({
        organisationId: primaryOrgId,
        query: nextQuery ?? query,
        audience,
        language,
        requestIdRef,
        resultCacheRef,
        fresh,
        setLoading,
        setError,
        setEntries,
        onSearchSaved: () => setRecentSearchesKey((k) => k + 1),
        setHasSearched,
      });
    },
    [audience, language, primaryOrgId, query]
  );

  useEffect(() => {
    performSearchRef.current = performSearch;
  }, [performSearch]);

  useEffect(() => {
    if (!routeQuery || getDisabledState(isEnabled)) return;
    void performSearchRef.current?.(routeQuery);
  }, [routeQuery, isEnabled]);

  const onCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
    } catch {
      setError('Unable to copy URL.');
    }
  };

  const onOpenInFrame = (entry: MerckEntry, url: string) => {
    if (!isAllowedMerckUrl(url)) {
      setError('Blocked URL: only Merck/MSD Vet Manual links are allowed.');
      return;
    }
    setReaderTitle(entry.title);
    setReaderUrl(url);
    setReaderLoading(true);
    setReaderBlocked(false);
    setReaderOpen(true);
  };

  const onAudienceChange = (next: MerckAudience) => {
    setAudience(next);
    if (primaryOrgId && query.trim()) {
      void executeMerckSearch({
        organisationId: primaryOrgId,
        query: query.trim(),
        audience: next,
        language,
        requestIdRef,
        resultCacheRef,
        // fresh: false (default) — serve from cache if available
        setLoading,
        setError,
        setEntries,
        onSearchSaved: () => setRecentSearchesKey((k) => k + 1),
        setHasSearched,
      });
    }
  };

  const containerClassName = getMerckContainerClassName(embedded);
  const resultsContainerClassName = getMerckResultsContainerClassName(embedded);

  const disabled = getDisabledState(isEnabled);
  const resultsContent = getResultsContent(
    entries,
    loading,
    hasSearched,
    query,
    onOpenInFrame,
    onCopyUrl
  );
  const resultsCountLabel =
    entries.length > 0 ? `${entries.length} results for “${query.trim()}”` : null;

  return (
    <div className={containerClassName}>
      <div className="flex w-full items-start justify-between gap-4 flex-wrap">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-page-title text-[var(--ink)]">MSD Veterinary Manual</h1>
            <GlassTooltip
              content="Search veterinary reference content and open results inside Yosemite Crew using secure reader links."
              side="bottom"
            >
              <button
                type="button"
                aria-label="MSD Veterinary Manual info"
                className="inline-flex size-5 shrink-0 items-center justify-center leading-none text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
              >
                <IoInformationCircleOutline size={18} />
              </button>
            </GlassTooltip>
          </div>
          {disabled ? null : (
            <span className="text-[12.5px] text-[var(--ink-muted)]">
              Connected ·{' '}
              <Link href="/integrations" className="font-semibold text-blue-text">
                Manage Integrations
              </Link>
            </span>
          )}
        </div>
      </div>

      {disabled ? (
        <MerckDisabledState embedded={embedded} />
      ) : (
        <div className="flex min-h-0 flex-col gap-4">
          <MerckSearchPanel
            query={query}
            setQuery={setQuery}
            loading={loading}
            performSearch={performSearch}
            advancedOpen={advancedOpen}
            setAdvancedOpen={setAdvancedOpen}
            language={language}
            setLanguage={setLanguage}
            recentSearches={recentSearches}
            audience={audience}
            onAudienceChange={onAudienceChange}
            disabled={disabled}
          />

          <div className="min-h-0 flex flex-col gap-3">
            {error ? (
              <div role="alert" className="text-body-4 text-text-error">
                {error}
              </div>
            ) : null}
            {copied ? (
              <output className="text-body-4 text-green-700">Copied URL to clipboard.</output>
            ) : null}

            {resultsCountLabel ? (
              <div className="text-[11.5px] text-[var(--ink-faint)]">{resultsCountLabel}</div>
            ) : null}

            <div className={resultsContainerClassName}>
              <div className="flex flex-col gap-2">
                {resultsContent}
                {entries.length > 0 ? (
                  <div className="pt-2 pb-1.5">
                    <div className="text-caption-1 text-text-secondary">
                      {MERCK_COPYRIGHT_NOTICE}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      <MerckReaderPortal
        readerOpen={readerOpen}
        readerUrl={readerUrl}
        readerTitle={readerTitle}
        readerLoading={readerLoading}
        readerBlocked={readerBlocked}
        audience={audience}
        copied={copied}
        onCopyUrl={onCopyUrl}
        setReaderOpen={setReaderOpen}
        setReaderLoading={setReaderLoading}
        setReaderBlocked={setReaderBlocked}
      />

      {entries.length === 0 ? (
        <div className="pt-1 pb-1.5 mt-auto">
          <div className="text-caption-1 text-text-secondary">{MERCK_COPYRIGHT_NOTICE}</div>
        </div>
      ) : null}
    </div>
  );
};

const ProtectedMerckManuals = () => (
  <ProtectedRoute skeleton={MERCK_PAGE_SKELETON}>
    <OrgGuard skeleton={MERCK_PAGE_SKELETON}>
      <Suspense fallback={MERCK_PAGE_SKELETON}>
        <MerckManualsPage />
      </Suspense>
    </OrgGuard>
  </ProtectedRoute>
);

export const EmbeddedMerckManuals = () => (
  <ProtectedRoute skeleton={MERCK_PAGE_SKELETON}>
    <OrgGuard skeleton={MERCK_PAGE_SKELETON}>
      <Suspense fallback={MERCK_PAGE_SKELETON}>
        <MerckManualsPage embedded />
      </Suspense>
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedMerckManuals;
