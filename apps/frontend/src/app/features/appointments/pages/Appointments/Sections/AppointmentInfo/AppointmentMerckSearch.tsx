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
  MerckMediaMode,
} from '@/app/features/integrations/services/types';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import {
  MERCK_COPYRIGHT_NOTICE,
  getMerckSubtopicPillStyle,
} from '@/app/features/integrations/constants/merck';

type AppointmentMerckSearchProps = {
  activeAppointment: Appointment | null;
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
      className={`relative inline-flex items-center h-9 w-full max-w-[220px] rounded-[999px]! border border-card-border bg-white overflow-hidden ${
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
  void activeAppointment;
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const { isEnabled } = useResolvedMerckIntegrationForPrimaryOrg();

  const [audience, setAudience] = useState<MerckAudience>('PROV');
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [subTopicDisplay, setSubTopicDisplay] = useState('');
  const [language, setLanguage] = useState<MerckLanguage>('en');
  const [media, setMedia] = useState<MerckMediaMode>('hybrid');
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

  const performSearch = async () => {
    if (!primaryOrgId || !query.trim()) return;
    requestRef.current += 1;
    const reqId = requestRef.current;

    setLoading(true);
    setError(null);

    try {
      const gateway = getMerckGateway();
      const response = await gateway.search({
        organisationId: primaryOrgId,
        query: query.trim(),
        audience,
        language,
        media,
        code: code.trim() || undefined,
        displayName: displayName.trim() || undefined,
        subTopicDisplay: subTopicDisplay.trim() || undefined,
      });
      if (reqId !== requestRef.current) return;
      const safeEntries = response.entries.filter(
        (entry) =>
          isAllowedMerckUrl(entry.primaryUrl) &&
          entry.subLinks.every((link) => isAllowedMerckUrl(link.url))
      );
      setEntries(safeEntries);
    } catch (e: any) {
      if (reqId !== requestRef.current) return;
      setEntries([]);
      setError(
        e?.response?.data?.message || e?.message || 'Unable to search Merck manuals right now.'
      );
    } finally {
      if (reqId === requestRef.current) {
        setLoading(false);
      }
    }
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

  if (!isEnabled) {
    return (
      <div className="w-full rounded-2xl border border-card-border p-4">
        <div className="text-body-4 text-text-secondary">
          Merck Manuals is disabled for this organization.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full self-start min-w-0 overflow-hidden rounded-2xl border border-card-border p-4 flex h-full min-h-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Image
            src={MEDIA_SOURCES.futureAssets.merckLogoUrl}
            alt="Merck Manuals"
            width={74}
            height={28}
            className="object-contain"
          />
          <CompactAudienceToggle value={audience} onChange={setAudience} disabled={loading} />
        </div>
        <div className="text-body-4 text-text-secondary">
          Search Merck Manuals for this appointment. Result pages open directly in an embedded
          reader.
        </div>

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
            <div className="grid grid-cols-1 gap-2 mb-2">
              <FormInput
                intype="text"
                inname="appointment-merck-display-name"
                inlabel="Condition name hint"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="min-h-10! h-10! px-4"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <FormInput
                intype="text"
                inname="appointment-merck-code"
                inlabel="Clinical code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="min-h-10! h-10! px-4"
              />
              <FormInput
                intype="text"
                inname="appointment-merck-subtopic"
                inlabel="Topic section"
                value={subTopicDisplay}
                onChange={(e) => setSubTopicDisplay(e.target.value)}
                className="min-h-10! h-10! px-4"
              />
            </div>
            <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-5">
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
              <div className="flex min-w-0 flex-1 flex-col gap-1">
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

        <div className="min-h-0 flex flex-1 flex-col gap-3">
          {error ? <div className="text-body-4 text-text-error">{error}</div> : null}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 max-h-[min(60vh,560px)]">
            <div className="flex flex-col gap-3">
              {entries.length === 0 ? (
                loading ? (
                  <div className="text-body-4 text-text-secondary">Searching manuals...</div>
                ) : null
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="w-full min-w-0 rounded-2xl border border-card-border p-4 flex flex-col gap-3 overflow-x-hidden"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="text-body-2 text-text-primary break-words min-w-0">
                        {entry.title}
                      </div>
                    </div>
                    <div className="text-body-4 text-text-secondary line-clamp-3 break-words">
                      {entry.summaryText || 'No summary available.'}
                    </div>

                    <div className="flex gap-2 flex-wrap items-center">
                      <Primary
                        href="#"
                        text="Open"
                        onClick={() => openReader(entry, entry.primaryUrl)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          window.open(entry.primaryUrl, '_blank', 'noopener,noreferrer')
                        }
                        aria-label="Open in new tab"
                        title="Open in new tab"
                        className="h-12 w-12 rounded-2xl! border border-card-border flex items-center justify-center text-text-primary hover:bg-card-hover transition-colors cursor-pointer"
                      >
                        <IoOpenOutline size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyUrl(entry.primaryUrl)}
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
                            className="max-w-full px-3 py-1 rounded-2xl! border border-card-border text-body-4 text-text-secondary hover:bg-card-hover cursor-pointer break-words"
                            style={getMerckSubtopicPillStyle(subLink.label)}
                            onClick={() => openReader(entry, subLink.url)}
                          >
                            {subLink.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="pt-1 flex flex-col gap-1">
          <div className="text-caption-1 text-text-secondary">{MERCK_COPYRIGHT_NOTICE}</div>
        </div>
      </div>

      {readerOpen && readerUrl && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-signing-overlay="true"
              className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
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
