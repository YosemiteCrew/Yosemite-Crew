import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { Primary } from '@/app/ui/primitives/Buttons';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import { IoCloseOutline, IoCopyOutline, IoOpenOutline, IoOptionsOutline } from 'react-icons/io5';
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
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import {
  MERCK_COPYRIGHT_NOTICE,
  getMerckSubtopicPillStyle,
  sanitizeMerckHtml,
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
  onOpenReader: (entry: MerckEntry, url: string) => void,
  onCopyUrl: (url: string) => Promise<void>
) => {
  if (entries.length === 0) {
    return loading ? (
      <div className="text-body-4 text-text-secondary">Searching manuals...</div>
    ) : null;
  }

  return entries.map((entry) => (
    <div
      key={entry.id}
      className="w-full min-w-0 rounded-2xl border border-card-border p-4 flex flex-col gap-3 overflow-x-hidden"
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div
          className="text-body-2 text-text-primary wrap-break-word min-w-0"
          dangerouslySetInnerHTML={{ __html: sanitizeMerckHtml(entry.title) }}
        />
      </div>
      <div
        className="text-body-4 text-text-secondary line-clamp-3 wrap-break-word"
        dangerouslySetInnerHTML={{
          __html: sanitizeMerckHtml(entry.summaryText || 'No summary available.'),
        }}
      />

      <div className="flex gap-2 flex-wrap items-center">
        <Primary href="#" text="Open" onClick={() => onOpenReader(entry, entry.primaryUrl)} />
        <button
          type="button"
          onClick={() => globalThis.window.open(entry.primaryUrl, '_blank', 'noopener,noreferrer')}
          aria-label="Open in new tab"
          title="Open in new tab"
          className="h-12 w-12 rounded-2xl! border border-card-border flex items-center justify-center text-text-primary hover:bg-card-hover transition-colors cursor-pointer"
        >
          <IoOpenOutline size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            onCopyUrl(entry.primaryUrl).catch(() => undefined);
          }}
          aria-label="Copy manual URL"
          title="Copy URL"
          className="h-12 w-12 rounded-2xl! border border-card-border flex items-center justify-center text-text-primary hover:bg-card-hover transition-colors cursor-pointer"
        >
          <IoCopyOutline size={18} />
        </button>
      </div>

      {entry.subLinks.length > 0 ? (
        <div className="flex gap-2 flex-wrap min-w-0">
          {entry.subLinks.map((subLink) => (
            <button
              key={`${entry.id}-${subLink.label}`}
              type="button"
              className="max-w-full px-3 py-1 rounded-2xl! border border-card-border text-body-4 text-text-secondary hover:bg-card-hover cursor-pointer wrap-break-word"
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
  const sliderClass = isProfessional
    ? 'translate-x-0 bg-[#247AED]'
    : 'translate-x-full bg-[#D28F9A]';
  const professionalTextClass = isProfessional ? 'text-neutral-0' : 'text-text-secondary';
  const consumerTextClass = isProfessional ? 'text-text-secondary' : 'text-neutral-0';

  return (
    <div
      className={`relative inline-flex items-center h-9 w-full max-w-55 rounded-[999px]! border border-card-border bg-white overflow-hidden ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      <div
        aria-hidden
        className={`absolute top-0 bottom-0 left-0 w-1/2 rounded-[999px]! transition-all duration-300 ease-in-out ${sliderClass}`}
      />
      <button
        type="button"
        onClick={() => onChange('PROV')}
        disabled={disabled}
        className={`relative z-10 w-1/2 h-full text-body-4 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${professionalTextClass}`}
      >
        Professional
      </button>
      <button
        type="button"
        onClick={() => onChange('PAT')}
        disabled={disabled}
        className={`relative z-10 w-1/2 h-full text-body-4 transition-colors duration-200 ${
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
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [readerOpen, setReaderOpen] = useState(false);
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [readerTitle, setReaderTitle] = useState('Merck Manual');
  const [readerLoading, setReaderLoading] = useState(false);
  const requestRef = useRef(0);
  const resultCacheRef = useRef<Map<string, MerckEntry[]>>(new Map());

  const performSearch = async (audienceOverride?: MerckAudience) => {
    if (!primaryOrgId || !query.trim()) return;
    const resolvedAudience = audienceOverride ?? audience;
    const cacheKey = `${query.trim()}::${resolvedAudience}::${language}`;

    const cached = resultCacheRef.current.get(cacheKey);
    if (cached) {
      setEntries(cached);
      return;
    }

    requestRef.current += 1;
    const reqId = requestRef.current;

    setLoading(true);
    setError(null);

    try {
      const gateway = getMerckGateway();
      const response = await gateway.search({
        organisationId: primaryOrgId,
        query: query.trim(),
        audience: resolvedAudience,
        language,
        media: 'hybrid',
      });
      if (reqId !== requestRef.current) return;
      const safe = getSafeMerckEntries(response.entries);
      resultCacheRef.current.set(cacheKey, safe);
      setEntries(safe);
    } catch (e: unknown) {
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

  const entriesContent = getAppointmentEntriesContent(entries, loading, openReader, copyUrl);

  if (!isEnabled) {
    return (
      <div className="w-full rounded-2xl border border-card-border p-4">
        <div className="text-body-4 text-text-secondary">
          MSD Veterinary Manual is disabled for this organization.
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="w-full min-w-0 overflow-y-auto rounded-2xl border border-card-border p-4 flex flex-1 h-full min-h-0 flex-col gap-4 scrollbar-hidden"
        data-has-appointment={hasActiveAppointment}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Image
            src={MEDIA_SOURCES.futureAssets.merckLogoUrl}
            alt="MSD Veterinary Manual"
            width={160}
            height={28}
            className="object-contain h-12 w-auto"
          />
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
        <div className="text-body-4 text-text-secondary">
          Search MSD Veterinary Manual for this appointment. Result pages open directly in an
          embedded reader.
        </div>

        <form
          className="flex items-center gap-2 flex-nowrap"
          onSubmit={(e) => {
            e.preventDefault();
            void performFreshSearch();
          }}
        >
          <div className="flex-1 min-w-0">
            <FormInput
              intype="text"
              inname="appointment-merck-search"
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
              onClick={() => void performFreshSearch()}
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
            {copied ? <span className="text-body-4 text-green-700">URL copied</span> : null}
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
            <div className="flex w-fit flex-col gap-1">
              <div className="text-caption-1 text-text-secondary">Language</div>
              <div className="inline-flex w-fit gap-1.5 flex-wrap">
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
          </div>
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
      </div>

      {readerOpen && readerUrl && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-signing-overlay="true"
              className="fixed inset-0 z-5000 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
                  <div className="text-body-2 text-text-primary truncate pr-2">{readerTitle}</div>
                  <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setReaderOpen(false);
                    }}
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
                        testId="appointment-merck-reader-loader"
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
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export default AppointmentMerckSearch;
