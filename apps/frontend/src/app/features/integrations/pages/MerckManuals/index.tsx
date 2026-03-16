'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import Close from '@/app/ui/primitives/Icons/Close';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
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
  MerckMediaMode,
} from '@/app/features/integrations/services/types';
import {
  MERCK_COPYRIGHT_NOTICE,
  getMerckSubtopicPillStyle,
} from '@/app/features/integrations/constants/merck';
import { formatDateTimeLocal } from '@/app/lib/date';
import { IoCloseOutline, IoCopyOutline, IoOpenOutline, IoOptionsOutline } from 'react-icons/io5';

type MerckManualsPageProps = {
  embedded?: boolean;
};

const RECENT_SEARCHES_LIMIT = 8;

const collapseWhitespace = (value: string) => {
  let result = '';
  let previousWasWhitespace = true;

  for (const char of value) {
    const isWhitespace =
      char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f';
    if (isWhitespace) {
      if (!previousWasWhitespace) {
        result += ' ';
      }
      previousWasWhitespace = true;
      continue;
    }
    result += char;
    previousWasWhitespace = false;
  }

  return result.trim();
};

const stripHtml = (value: string) => {
  const input = String(value ?? '');
  let result = '';
  let insideTag = false;

  for (const char of input) {
    if (char === '<') {
      insideTag = true;
      result += ' ';
      continue;
    }
    if (char === '>') {
      insideTag = false;
      result += ' ';
      continue;
    }
    if (!insideTag) {
      result += char;
    }
  }

  return collapseWhitespace(result);
};

const getRecentSearchesKey = (orgId: string, audience: MerckAudience) =>
  `yc:merck:recent:${orgId}:${audience}`;

const getRecentSearches = (orgId: string, audience: MerckAudience): string[] => {
  if (typeof globalThis.window === 'undefined') return [];
  try {
    const raw = globalThis.window.localStorage.getItem(getRecentSearchesKey(orgId, audience));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const saveRecentSearch = (orgId: string, audience: MerckAudience, value: string) => {
  if (typeof globalThis.window === 'undefined') return;
  const query = value.trim();
  if (!query) return;
  const prev = getRecentSearches(orgId, audience).filter(
    (item) => item.toLowerCase() !== query.toLowerCase()
  );
  const next = [query, ...prev].slice(0, RECENT_SEARCHES_LIMIT);
  globalThis.window.localStorage.setItem(
    getRecentSearchesKey(orgId, audience),
    JSON.stringify(next)
  );
};

const safeDate = (value?: string | null) => {
  return formatDateTimeLocal(value, 'N/A');
};

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
    ? 'translate-x-0 bg-[#247AED] border-[#247AED]'
    : 'translate-x-full bg-[#D28F9A] border-[#D28F9A]';
  const professionalTextClass = isProfessional ? 'text-neutral-0' : 'text-text-secondary';
  const consumerTextClass = isProfessional ? 'text-text-secondary' : 'text-neutral-0';

  return (
    <div
      className={`relative inline-flex items-center h-11 w-full max-w-[320px] rounded-[999px]! border border-card-border bg-white overflow-hidden ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      <div
        aria-hidden
        className={`absolute top-0 bottom-0 left-0 w-1/2 rounded-[999px]! border-0 transition-all duration-300 ease-in-out ${sliderClass}`}
      />
      <button
        type="button"
        onClick={() => onChange('PROV')}
        disabled={disabled}
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
        className={`relative z-10 w-1/2 h-full text-body-3 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${consumerTextClass}`}
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

const EntryCard = ({
  entry,
  onOpenInFrame,
  onCopy,
}: {
  entry: MerckEntry;
  onOpenInFrame: (entry: MerckEntry, url: string) => void;
  onCopy: (url: string) => void;
}) => {
  const summary = stripHtml(entry.summaryText || '').slice(0, 280);
  return (
    <div className="rounded-2xl border border-card-border p-4 flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 lg:justify-between">
        <div className="w-full min-w-0 lg:w-[48%] xl:w-[52%] flex flex-col gap-2">
          <div className="text-body-2 text-text-primary">{entry.title}</div>
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
              if (typeof globalThis.window === 'undefined') return;
              globalThis.window.open(entry.primaryUrl, '_blank', 'noopener,noreferrer');
            }}
            aria-label="Open in new tab"
            title="Open in new tab"
            className="h-12 w-12 rounded-2xl! border border-card-border flex items-center justify-center text-text-primary hover:bg-card-hover transition-colors cursor-pointer"
          >
            <IoOpenOutline size={18} />
          </button>
          <button
            type="button"
            onClick={() => onCopy(entry.primaryUrl)}
            aria-label="Copy manual URL"
            title="Copy URL"
            className="h-12 w-12 rounded-2xl! border border-card-border flex items-center justify-center text-text-primary hover:bg-card-hover transition-colors cursor-pointer"
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

const MerckManualsPage = ({ embedded = false }: MerckManualsPageProps) => {
  const searchParams = useSearchParams();
  const routeQuery = String(searchParams.get('q') ?? '').trim();
  const { isEnabled } = useResolvedMerckIntegrationForPrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  const [audience, setAudience] = useState<MerckAudience>('PROV');
  const [language, setLanguage] = useState<MerckLanguage>('en');
  const [media, setMedia] = useState<MerckMediaMode>('hybrid');
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [subTopicDisplay, setSubTopicDisplay] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [entries, setEntries] = useState<MerckEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [readerOpen, setReaderOpen] = useState(false);
  const [readerTitle, setReaderTitle] = useState('Merck Manual');
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);

  const requestIdRef = useRef(0);
  const performSearchRef = useRef<((nextQuery?: string) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!primaryOrgId) return;
    setRecentSearches(getRecentSearches(primaryOrgId, audience));
  }, [primaryOrgId, audience]);

  useEffect(() => {
    if (!routeQuery) return;
    setQuery(routeQuery);
  }, [routeQuery]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const performSearch = useCallback(
    async (nextQuery?: string) => {
      if (!primaryOrgId) return;
      const resolvedQuery = (nextQuery ?? query).trim();
      if (!resolvedQuery) return;

      requestIdRef.current += 1;
      const reqId = requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const gateway = getMerckGateway();
        const response = await gateway.search({
          organisationId: primaryOrgId,
          query: resolvedQuery,
          audience,
          language,
          media,
          code: code.trim() || undefined,
          displayName: displayName.trim() || undefined,
          subTopicDisplay: subTopicDisplay.trim() || undefined,
        });

        if (reqId !== requestIdRef.current) return;

        const filtered = response.entries.filter(
          (entry) =>
            isAllowedMerckUrl(entry.primaryUrl) &&
            entry.subLinks.every((link) => isAllowedMerckUrl(link.url))
        );
        setEntries(filtered);
        saveRecentSearch(primaryOrgId, audience, resolvedQuery);
        setRecentSearches(getRecentSearches(primaryOrgId, audience));
      } catch (e: any) {
        if (reqId !== requestIdRef.current) return;
        setEntries([]);
        setError(e?.response?.data?.message || e?.message || 'Unable to search manuals right now.');
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [audience, code, displayName, language, media, primaryOrgId, query, subTopicDisplay]
  );

  useEffect(() => {
    performSearchRef.current = performSearch;
  }, [performSearch]);

  useEffect(() => {
    if (!routeQuery || !isEnabled) return;
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

  const containerClassName = embedded
    ? 'w-full p-4 md:p-6 bg-white min-h-screen'
    : 'flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!';
  const resultsContainerClassName = embedded
    ? 'min-h-0 flex-1 overflow-y-auto pr-1'
    : 'min-h-0 flex-1 overflow-y-auto pr-1 max-h-[calc(100vh-320px)] lg:max-h-[calc(100vh-280px)]';

  const disabled = !isEnabled;

  const resultsContent =
    entries.length === 0 ? (
      loading ? (
        <div className="text-body-4 text-text-secondary">Searching manuals...</div>
      ) : null
    ) : (
      entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} onOpenInFrame={onOpenInFrame} onCopy={onCopyUrl} />
      ))
    );

  return (
    <div className={containerClassName}>
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="h-10 w-auto relative mb-1">
            <Image
              src={MEDIA_SOURCES.futureAssets.merckLogoUrl}
              alt="Merck Manuals"
              width={140}
              height={40}
              className="object-contain h-10 w-auto"
            />
          </div>
          <p className="text-body-3 text-text-secondary max-w-3xl">
            Search veterinary reference content and open results inside Yosemite using secure reader
            links.
          </p>
        </div>
        <AudienceToggle
          value={audience}
          disabled={disabled}
          onChange={(next) => setAudience(next)}
        />
      </div>

      {disabled ? (
        <div className="rounded-2xl border border-card-border p-4 flex flex-col gap-3">
          <div className="text-body-2 text-text-primary">
            Merck Manuals is disabled for this organization.
          </div>
          {!embedded ? <Secondary href="/integrations" text="Manage Integrations" /> : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-col gap-4">
          <div className="rounded-2xl border border-card-border p-4 flex flex-col gap-3">
            <form
              className="flex items-center gap-2 flex-nowrap"
              onSubmit={(e) => {
                e.preventDefault();
                void performSearch();
              }}
            >
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
                  onClick={() => void performSearch()}
                  isDisabled={loading || !query.trim()}
                />
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                  aria-label={advancedOpen ? 'Hide filters' : 'Show filters'}
                  title={advancedOpen ? 'Hide filters' : 'Show filters'}
                  className={`h-12 w-12 rounded-2xl! border border-card-border flex items-center justify-center transition-colors cursor-pointer ${
                    advancedOpen
                      ? 'bg-card-hover text-text-primary'
                      : 'text-text-secondary hover:bg-card-hover'
                  }`}
                >
                  <IoOptionsOutline size={18} />
                </button>
              </div>
            </form>

            {advancedOpen ? (
              <div className="rounded-2xl border border-card-border bg-white p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-body-4 text-text-secondary">Refine Results</div>
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen(false)}
                    className="h-7 w-7 rounded-xl! border border-card-border flex items-center justify-center text-text-secondary hover:bg-card-hover transition-colors cursor-pointer"
                    aria-label="Close refine results"
                    title="Close refine results"
                  >
                    <IoCloseOutline size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mb-2">
                  <FormInput
                    intype="text"
                    inname="merck-code"
                    inlabel="Clinical code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="min-h-10! h-10! px-4"
                  />
                  <FormInput
                    intype="text"
                    inname="merck-display-name"
                    inlabel="Condition name hint"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="min-h-10! h-10! px-4"
                  />
                  <FormInput
                    intype="text"
                    inname="merck-subtopic"
                    inlabel="Topic section"
                    value={subTopicDisplay}
                    onChange={(e) => setSubTopicDisplay(e.target.value)}
                    className="min-h-10! h-10! px-4"
                  />
                </div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-caption-1 text-text-secondary">Language</div>
                    <div className="flex gap-1.5 flex-wrap">
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-caption-1 text-text-secondary">Reading mode</div>
                    <div className="flex gap-1.5 flex-wrap">
                      <CompactFilterPill
                        active={media === 'hybrid'}
                        label="Balanced"
                        onClick={() => setMedia('hybrid')}
                      />
                      <CompactFilterPill
                        active={media === 'print'}
                        label="Print-friendly"
                        onClick={() => setMedia('print')}
                      />
                      <CompactFilterPill
                        active={media === 'full'}
                        label="Full layout"
                        onClick={() => setMedia('full')}
                      />
                    </div>
                  </div>
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

          <div className="min-h-0 flex flex-col gap-3">
            {error ? <div className="text-body-4 text-text-error">{error}</div> : null}
            {copied ? (
              <div className="text-body-4 text-green-700">Copied URL to clipboard.</div>
            ) : null}

            <div className={resultsContainerClassName}>
              <div className="flex flex-col gap-3">{resultsContent}</div>
            </div>
          </div>
        </div>
      )}

      {readerOpen && readerUrl && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
                  <div className="text-body-2 text-text-primary truncate pr-2">{readerTitle}</div>
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
                      <YosemiteLoader
                        label="Loading Manual"
                        size={120}
                        testId="merck-reader-loader"
                      />
                    </div>
                  ) : null}
                  <iframe
                    src={readerUrl}
                    title={readerTitle}
                    className="flex-1 w-full h-full border-0"
                    loading="lazy"
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
          )
        : null}

      <div className="pt-1 flex flex-col gap-1">
        <div className="text-caption-1 text-text-secondary">{MERCK_COPYRIGHT_NOTICE}</div>
      </div>
    </div>
  );
};

const ProtectedMerckManuals = () => (
  <ProtectedRoute>
    <OrgGuard>
      <MerckManualsPage />
    </OrgGuard>
  </ProtectedRoute>
);

export const EmbeddedMerckManuals = () => (
  <ProtectedRoute>
    <OrgGuard>
      <MerckManualsPage embedded />
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedMerckManuals;
