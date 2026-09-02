import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IoCloseOutline } from 'react-icons/io5';
import type { SoapCodedTerm } from '@yosemite-crew/types';
import Search from '@/app/ui/inputs/Search';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import WorkspaceSearchResultRow from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceSearchResultRow';
import {
  suggestClinicalTerms,
  type ClinicalTermDomain,
  type ClinicalTermSuggestion,
  type VocabularyFilter,
} from '@/app/features/appointments/services/clinicalTermsService';

/**
 * Vocabulary scope for the search. "All" offers every term and shows whichever
 * crosswalks exist; picking a vocabulary narrows the list to terms that can
 * actually be coded in it, which is what a practice working in SNOMED (or
 * VeNom) alone needs — a list with no dead ends.
 */
const VOCABULARY_SCOPES: Array<{ value: VocabularyFilter | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'VENOM', label: 'VeNom' },
  { value: 'SNOMED', label: 'SNOMED' },
];

const SCOPE_LABEL: Record<VocabularyFilter, string> = { VENOM: 'VeNom', SNOMED: 'SNOMED' };

/** Short vocabulary labels; the picker has no room for full system URIs. */
const SYSTEM_LABEL: Record<string, string> = {
  VENOM: 'VeNom',
  SNOMED: 'SNOMED',
  IDEXX: 'IDEXX',
  YOSEMITECODE: 'YC',
};

/**
 * An equivalence that is not exact is stated, never hidden: a vet reading
 * "SNOMED 422400008" should know at a glance whether that is the same concept
 * or a broader/narrower one.
 */
const INEXACT_EQUIVALENCES = new Set([
  'NARROWER',
  'SPECIALIZES',
  'WIDER',
  'SUBSUMES',
  'RELATEDTO',
  'INEXACT',
]);

const codingLabel = (coding: { system: string; code: string; equivalence?: string }) => {
  const system = SYSTEM_LABEL[coding.system] ?? coding.system;
  const qualifier =
    coding.equivalence && INEXACT_EQUIVALENCES.has(coding.equivalence.toUpperCase())
      ? ` (${coding.equivalence.toLowerCase()})`
      : '';
  return `${system} ${coding.code}${qualifier}`;
};

/** YC code, then each vocabulary crosswalk, then the synonym that matched. */
const buildOrigin = (suggestion: ClinicalTermSuggestion, synonym: string | undefined): string => {
  const parts: string[] = [suggestion.ycCode];
  for (const coding of suggestion.codings ?? []) parts.push(codingLabel(coding));
  if (synonym) parts.push(`matches “${synonym}”`);
  return parts.join(' · ');
};

const MIN_QUERY_LENGTH = 2;
const SUGGEST_DEBOUNCE_MS = 250;
const SUGGEST_LIMIT = 8;

/**
 * When the display label itself doesn't contain the query, the hit came from a
 * synonym (often another language). Surface which one so the clinician sees why
 * "anomalía" returned "Behavioural abnormality".
 */
const matchedSynonym = (suggestion: ClinicalTermSuggestion, query: string): string | undefined => {
  const q = query.trim().toLowerCase();
  if (!q || suggestion.label.toLowerCase().includes(q)) return undefined;
  return suggestion.synonyms.find((synonym) => synonym.toLowerCase().includes(q));
};

type SoapCodedTermPickerProps = {
  /** Section name used in accessible labels, e.g. "Assessment". */
  sectionLabel: string;
  /** Vocabulary domain to narrow suggestions to; omit to search every domain. */
  domain?: ClinicalTermDomain;
  selected: SoapCodedTerm[];
  onChange: (terms: SoapCodedTerm[]) => void;
};

/**
 * Coded-term chips for one SOAP section: type ≥2 characters to search the
 * clinical vocabulary (display + multilingual synonyms), pick a suggestion to
 * pin it as a chip. The picked codes ride the note's `diagnoses` channel so the
 * free-text prose gains exact vocabulary references.
 */
const SoapCodedTermPicker = ({
  sectionLabel,
  domain,
  selected,
  onChange,
}: SoapCodedTermPickerProps) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState<VocabularyFilter | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClinicalTermSuggestion[]>([]);
  /* A scoped search that finds nothing must say so. Without this the dropdown
     simply does not open, which reads as "search is broken" rather than "no term
     in this vocabulary matches" - the one case the scope control makes common. */
  const [emptyQuery, setEmptyQuery] = useState<string | null>(null);
  // Monotonic request id: a slow earlier response must never overwrite a newer one.
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    const belowMinimum = trimmed.length < MIN_QUERY_LENGTH;
    // All setState runs inside the timer, never synchronously in the effect
    // (react-hooks cascading-render rule). Clearing uses a zero delay so the
    // dropdown hides immediately when the query drops below the minimum.
    const timer = setTimeout(
      () => {
        if (belowMinimum) {
          setResults([]);
          setEmptyQuery(null);
          return;
        }
        suggestClinicalTerms({
          q: trimmed,
          domain,
          limit: SUGGEST_LIMIT,
          ...(scope === 'ALL' ? {} : { vocabulary: scope }),
        })
          .then((items) => {
            if (requestSeqRef.current !== requestId) return;
            setResults(items);
            setEmptyQuery(items.length === 0 ? trimmed : null);
          })
          .catch((error) => {
            console.error('Unable to suggest clinical terms:', error);
            if (requestSeqRef.current !== requestId) return;
            setResults([]);
            // An error is not "nothing matched"; leave the explanation off.
            setEmptyQuery(null);
          });
      },
      belowMinimum ? 0 : SUGGEST_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [query, domain, scope]);

  /* Only worth explaining when a scope is on. An unscoped search that finds
     nothing is just a query with no matches, and the closed dropdown says that
     well enough. */
  const scopedEmpty = emptyQuery !== null && scope !== 'ALL' ? { query: emptyQuery, scope } : null;

  const selectedCodes = useMemo(() => new Set(selected.map((term) => term.ycCode)), [selected]);

  // Duplicates can't reach here: the result row for an already-picked code is
  // disabled, and the shared parser dedups again on the way back in.
  const addTerm = (suggestion: ClinicalTermSuggestion) => {
    onChange([
      ...selected,
      {
        ycCode: suggestion.ycCode,
        label: suggestion.label,
        ...(suggestion.domain ? { domain: suggestion.domain } : {}),
        ...(suggestion.codings?.length
          ? {
              codings: suggestion.codings.map((coding) => ({
                system: coding.system,
                code: coding.code,
                equivalence: coding.equivalence,
              })),
            }
          : {}),
      },
    ]);
    setQuery('');
  };

  const removeTerm = (ycCode: string) =>
    onChange(selected.filter((term) => term.ycCode !== ycCode));

  return (
    <div className="mt-3 flex flex-col gap-2">
      {selected.length > 0 && (
        <ul
          className="flex flex-wrap items-center gap-1.5"
          aria-label={`${sectionLabel} coded terms`}
        >
          {selected.map((term) => (
            <li
              key={term.ycCode}
              className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-neutral-100 py-1 pl-3 pr-1.5 text-caption-1 font-semibold text-text-primary"
            >
              <span>{term.label}</span>
              <span className="font-normal text-text-tertiary">{term.ycCode}</span>
              {term.codings?.map((coding) => (
                <span
                  key={`${coding.system}-${coding.code}`}
                  className="rounded-full bg-neutral-0 px-1.5 py-0.5 text-caption-2 font-normal text-text-secondary"
                >
                  {codingLabel(coding)}
                </span>
              ))}
              <button
                type="button"
                aria-label={`Remove ${term.label}`}
                onClick={() => removeTerm(term.ycCode)}
                className="flex size-5 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-neutral-200 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
              >
                <IoCloseOutline size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={`Vocabulary for ${sectionLabel} coded terms`}
      >
        {VOCABULARY_SCOPES.map((option) => {
          const active = scope === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setScope(option.value)}
              className={`rounded-full border px-2.5 py-1 text-caption-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${
                active
                  ? 'border-transparent bg-neutral-200 text-text-primary'
                  : 'border-card-border bg-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div ref={anchorRef} className="relative w-full sm:max-w-90">
        <Search
          value={query}
          setSearch={setQuery}
          placeholder="Add coded term"
          label={`Add coded term to ${sectionLabel}`}
          className="w-full!"
        />
        <SearchResultsDropdown
          anchorRef={anchorRef}
          open={results.length > 0 || scopedEmpty !== null}
          onClose={() => setQuery('')}
        >
          {scopedEmpty !== null ? (
            <p className="px-4 py-3 text-caption-1 text-text-secondary">
              No term with a {SCOPE_LABEL[scopedEmpty.scope]} code matches “{scopedEmpty.query}”.{' '}
              <button
                type="button"
                onClick={() => setScope('ALL')}
                className="font-semibold text-text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
              >
                Search all vocabularies
              </button>
            </p>
          ) : null}
          <ul>
            {results.map((suggestion) => {
              const synonym = matchedSynonym(suggestion, query);
              const alreadyAdded = selectedCodes.has(suggestion.ycCode);
              return (
                <WorkspaceSearchResultRow
                  key={suggestion.ycCode}
                  name={suggestion.label}
                  origin={buildOrigin(suggestion, synonym)}
                  disabled={alreadyAdded}
                  disabledReason={alreadyAdded ? 'Added' : undefined}
                  onSelect={() => addTerm(suggestion)}
                />
              );
            })}
          </ul>
        </SearchResultsDropdown>
      </div>
    </div>
  );
};

export default SoapCodedTermPicker;
