'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
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
  IoCloseOutline,
  IoCopyOutline,
  IoInformationCircleOutline,
  IoOpenOutline,
  IoOptionsOutline,
} from 'react-icons/io5';

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

const getResultsContent = (
  entries: MerckEntry[],
  loading: boolean,
  hasSearched: boolean,
  onOpenInFrame: (entry: MerckEntry, url: string) => void,
  onCopyUrl: (url: string) => void
) => {
  if (entries.length === 0) {
    if (loading) {
      return <div className="text-body-4 text-text-secondary">Searching manuals…</div>;
    }
    if (hasSearched) {
      return (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="text-body-3 text-text-secondary">No results found</div>
          <div className="text-body-4 text-text-tertiary">
            Try different keywords or switch between Professional and Consumer.
          </div>
        </div>
      );
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
  embedded
    ? 'w-full p-4 md:p-6 bg-white min-h-screen'
    : 'flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!';

const getMerckResultsContainerClassName = (embedded: boolean) =>
  embedded
    ? 'min-h-0 flex-1 overflow-y-auto pr-1'
    : 'min-h-0 flex-1 overflow-y-auto pr-1 max-h-[calc(100vh-320px)] lg:max-h-[calc(100vh-280px)]';

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
  const sliderClass = isProfessional
    ? 'translate-x-0 bg-blue-text border-blue-text'
    : 'translate-x-full bg-blue-text border-blue-text';
  const professionalTextClass = isProfessional ? 'text-neutral-0' : 'text-text-secondary';
  const consumerTextClass = isProfessional ? 'text-text-secondary' : 'text-neutral-0';

  return (
    <fieldset
      className={`relative inline-flex items-center h-11 w-full max-w-[320px] rounded-[999px]! border border-card-border bg-white overflow-hidden ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      <legend className="sr-only">Audience</legend>
      <div
        aria-hidden
        className={`absolute top-0 bottom-0 left-0 w-1/2 rounded-[999px]! border-0 transition-all duration-300 ease-in-out ${sliderClass}`}
      />
      <button
        type="button"
        onClick={() => onChange('PROV')}
        disabled={disabled}
        aria-pressed={isProfessional}
        className={`relative z-10 w-1/2 h-full text-body-3 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${professionalTextClass}`}
      >
        Professional
      </button>
      <button
        type="button"
        onClick={() => onChange('PAT')}
        disabled={disabled}
        aria-pressed={!isProfessional}
        className={`relative z-10 w-1/2 h-full text-body-3 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${consumerTextClass}`}
      >
        Consumer
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
    <div className="rounded-2xl border border-card-border p-4 flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 lg:justify-between">
        <div className="w-full min-w-0 lg:w-[48%] xl:w-[52%] flex flex-col gap-2">
          <div className="text-body-2 text-text-primary">{stripMerckHtml(entry.title)}</div>
          <div className="text-body-4 text-text-secondary line-clamp-3">
            {summary || 'No summary available.'}
          </div>
        </div>
        {entry.subLinks.length > 0 ? (
          <div className="lg:w-[46%] xl:w-[42%] min-w-0 flex flex-wrap gap-2 content-start lg:pt-8">
            {entry.subLinks.map((subLink) => (
              <button
                key={`${entry.id}-${subLink.label}`}
                type="button"
                className="px-3 py-1 rounded-2xl! border border-card-border text-body-4 text-text-secondary hover:bg-card-hover cursor-pointer"
                style={getMerckSubtopicPillStyle(subLink.label)}
                onClick={() => onOpenInFrame(entry, subLink.url)}
              >
                {subLink.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap items-center">
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
            className="size-12 rounded-2xl! border border-card-border flex items-center justify-center text-text-primary hover:bg-card-hover transition-colors cursor-pointer"
          >
            <IoOpenOutline size={18} />
          </button>
          <button
            type="button"
            onClick={() => onCopy(entry.primaryUrl)}
            aria-label="Copy manual URL"
            title="Copy URL"
            className="size-12 rounded-2xl! border border-card-border flex items-center justify-center text-text-primary hover:bg-card-hover transition-colors cursor-pointer"
          >
            <IoCopyOutline size={18} />
          </button>
        </div>
        <div className="text-caption-1 text-text-secondary text-right whitespace-nowrap self-center">
          Updated: {safeDate(entry.updatedAt)}
        </div>
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
}) => (
  <div className="rounded-2xl border border-card-border p-4 flex flex-col gap-3">
    <div className="flex items-center gap-2 flex-nowrap">
      <div className="flex-1 min-w-0">
        <FormInput
          intype="text"
          inname="merck-search"
          inlabel="Search manuals"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-12! h-12! px-4"
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Primary
          href="#"
          text={loading ? 'Searching...' : 'Search'}
          onClick={() => void performSearch(undefined, true)}
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
      </div>
    </div>

    {advancedOpen ? (
      <div className="rounded-2xl border border-card-border bg-white p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-body-4 text-text-secondary">Refine Results</div>
          <button
            type="button"
            onClick={() => setAdvancedOpen(false)}
            className="size-7 rounded-xl! border border-card-border flex items-center justify-center text-text-secondary hover:bg-card-hover transition-colors cursor-pointer"
            aria-label="Close refine results"
            title="Close refine results"
          >
            <IoCloseOutline size={14} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-caption-1 text-text-secondary" id="merck-language-label">
            Language
          </div>
          <fieldset className="flex gap-1.5 flex-wrap" aria-labelledby="merck-language-label">
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
      </div>
    ) : null}

    {recentSearches.length > 0 ? (
      <div className="flex flex-col gap-2">
        <div className="text-body-4 text-text-secondary">Frequent searches</div>
        <div className="flex gap-2 flex-wrap">
          {recentSearches.map((searchTerm) => (
            <button
              key={searchTerm}
              type="button"
              className="px-3 py-1 rounded-2xl! border border-card-border text-body-4 text-text-secondary hover:bg-card-hover cursor-pointer"
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
  </div>
);

const MerckReaderPortal = ({
  readerOpen,
  readerUrl,
  readerTitle,
  readerLoading,
  setReaderOpen,
  setReaderLoading,
}: {
  readerOpen: boolean;
  readerUrl: string | null;
  readerTitle: string;
  readerLoading: boolean;
  setReaderOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReaderLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  if (!readerOpen || !readerUrl || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-10000 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      data-merck-reader-overlay="true"
    >
      <div className="relative bg-white rounded-2xl shadow-2xl size-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
          <div id="merck-reader-title" className="text-body-2 text-text-primary truncate pr-2">
            {readerTitle}
          </div>
          <button
            type="button"
            onClick={() => setReaderOpen(false)}
            className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
            aria-label="Close Merck reader"
          >
            <Close iconOnly />
          </button>
        </div>
        <div className="relative flex-1">
          {readerLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
              <YosemiteLoader label="Loading Manual" size={120} testId="merck-reader-loader" />
            </div>
          ) : null}
          <iframe
            src={readerUrl}
            title={readerTitle}
            className="flex-1 size-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin"
            sandbox="allow-scripts allow-popups allow-forms allow-same-origin"
            onLoad={() => setReaderLoading(false)}
          />
        </div>
        <div className="p-3 border-t border-black/10 flex justify-end">
          <Link
            href={readerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-body-4 text-text-brand underline underline-offset-2"
          >
            Open in new tab
          </Link>
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

  const requestIdRef = useRef(0);
  const resultCacheRef = useRef<Map<string, MerckEntry[]>>(null!);
  resultCacheRef.current ??= new Map();
  const performSearchRef = useRef<((nextQuery?: string, fresh?: boolean) => Promise<void>) | null>(
    null
  );

  const [recentSearchesKey, setRecentSearchesKey] = useState(0);
  // recentSearchesKey is a counter; incrementing it forces recentSearches to recompute on save
  const recentSearches = useMemo(
    () => (primaryOrgId ? getRecentSearches(primaryOrgId, audience) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primaryOrgId, audience, recentSearchesKey]
  );

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
    setReaderOpen(true);
  };

  const containerClassName = getMerckContainerClassName(embedded);
  const resultsContainerClassName = getMerckResultsContainerClassName(embedded);

  const disabled = getDisabledState(isEnabled);
  const resultsContent = getResultsContent(entries, loading, hasSearched, onOpenInFrame, onCopyUrl);

  return (
    <div className={containerClassName}>
      <div className="flex w-full items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-22 w-auto relative">
            <h1 className="sr-only">MSD Veterinary Manual</h1>
            <Image
              src={MEDIA_SOURCES.futureAssets.merckLogoUrl}
              alt="MSD Veterinary Manual"
              width={352}
              height={88}
              className="object-contain h-22 w-auto"
            />
          </div>
          <GlassTooltip
            content="Search veterinary reference content and open results inside Yosemite Crew using secure reader links."
            side="bottom"
          >
            <button
              type="button"
              aria-label="MSD Veterinary Manual info"
              className="relative pt-3 inline-flex size-5 shrink-0 items-center justify-center leading-none text-text-secondary hover:text-text-primary transition-colors"
            >
              <IoInformationCircleOutline size={20} />
            </button>
          </GlassTooltip>
        </div>
        <div className="w-[320px] max-w-full shrink-0">
          <AudienceToggle
            value={audience}
            disabled={disabled}
            onChange={(next) => {
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
            }}
          />
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

            <div className={resultsContainerClassName}>
              <div className="flex flex-col gap-3">
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
        setReaderOpen={setReaderOpen}
        setReaderLoading={setReaderLoading}
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
