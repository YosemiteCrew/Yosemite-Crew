'use client';

import React, { useEffect, useState } from 'react';
import { Primary } from '@/app/ui/primitives/Buttons';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';
import {
  createDermatologyAssessment,
  listDermatologyAssessments,
  type DermatologyAssessmentRecord,
} from '@/app/features/appointments/services/workspaceClinicalService';

const SMALL_ANIMAL_REGIONS = [
  'Head and face',
  'Ears',
  'Neck',
  'Back',
  'Chest and abdomen',
  'Front legs',
  'Paws',
  'Hind legs',
  'Tail and rump',
];

const EQUINE_REGIONS = [
  'Head and face',
  'Ears',
  'Neck and mane',
  'Back',
  'Chest and abdomen',
  'Front legs',
  'Hind legs',
  'Pasterns and hooves',
  'Tail and rump',
];

const isEquine = (species?: string) => /horse|equine|pony/i.test(species ?? '');

const getRegionScope = (species?: string) =>
  isEquine(species)
    ? { regions: EQUINE_REGIONS, hint: 'Regions for horses.' }
    : { regions: SMALL_ANIMAL_REGIONS, hint: 'Regions for dogs and cats.' };

const describeMatches = (count: number) =>
  count === 1
    ? '1 region selected today was also recorded previously.'
    : `${count} regions selected today were also recorded previously.`;

const parseLesions = (value: string) =>
  value.split(',').flatMap((item) => {
    const trimmed = item.trim();
    return trimmed ? [trimmed] : [];
  });

const formatList = (items: string[], empty: string) => (items.length ? items.join(', ') : empty);

const toIsoString = (value: string | Date) => (value instanceof Date ? value.toISOString() : value);

const fieldClassName =
  'min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand';

type HistoryState = {
  patientId: string;
  records: DermatologyAssessmentRecord[];
  failed: boolean;
};

const useDermatologyHistory = (organisationId: string, patientId?: string) => {
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!patientId) return;
    let active = true;
    listDermatologyAssessments(organisationId, patientId)
      .then((records) => {
        if (active) setHistory({ patientId, records, failed: false });
      })
      .catch(() => {
        if (active) setHistory({ patientId, records: [], failed: true });
      });
    return () => {
      active = false;
    };
  }, [loadAttempt, organisationId, patientId]);

  const current = history?.patientId === patientId ? history : null;
  return {
    assessments: current?.records ?? [],
    isLoading: Boolean(patientId) && current === null,
    loadFailed: current?.failed ?? false,
    retry: () => {
      setHistory(null);
      setLoadAttempt((attempt) => attempt + 1);
    },
  };
};

type RegionChecklistProps = {
  options: string[];
  hint: string;
  selected: Set<string>;
  disabled: boolean;
  onToggle: (region: string) => void;
};

const RegionChecklist = ({ options, hint, selected, disabled, onToggle }: RegionChecklistProps) => (
  <fieldset disabled={disabled} aria-describedby="dermatology-region-scope">
    <legend className="text-body-4 font-semibold text-text-primary">Affected body regions</legend>
    <p id="dermatology-region-scope" className="mb-2 text-[12px] text-text-secondary">
      {hint}
    </p>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((region) => (
        <label
          key={region}
          className="flex min-h-11 items-center gap-3 rounded-xl border border-card-border px-3 py-2 text-body-4 text-text-primary focus-within:ring-2 focus-within:ring-text-brand"
        >
          <input
            type="checkbox"
            checked={selected.has(region)}
            onChange={() => onToggle(region)}
            className="h-4 w-4 accent-[var(--blue-text)]"
          />
          {region}
        </label>
      ))}
    </div>
  </fieldset>
);

type LesionFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

const LesionField = ({ label, value, placeholder, disabled, onChange }: LesionFieldProps) => (
  <label className="flex flex-col gap-1 text-body-4 font-medium text-text-primary">
    <span>{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={fieldClassName}
      disabled={disabled}
    />
  </label>
);

type PreviousFindingsProps = {
  previous: DermatologyAssessmentRecord;
  matchingRegionCount: number;
};

const PreviousFindings = ({ previous, matchingRegionCount }: PreviousFindingsProps) => (
  <section
    aria-labelledby="dermatology-compare-heading"
    className="rounded-xl border border-card-border p-3"
  >
    <h4 id="dermatology-compare-heading" className="text-body-4 font-semibold text-text-primary">
      Compare with previous visit
    </h4>
    <p className="mt-1 text-[12px] text-text-secondary">
      {`${formatStampDate(toIsoString(previous.assessedAt))} · Previously affected`}
    </p>
    <p className="mt-1 text-body-4 text-text-primary">
      {formatList(previous.affectedRegions, 'No regions recorded')}
    </p>
    <dl className="mt-2 grid grid-cols-1 gap-1 text-[12px] text-text-secondary">
      <div>
        <dt className="inline font-medium">Primary lesions: </dt>
        <dd className="inline">{formatList(previous.primaryLesions, 'Not recorded')}</dd>
      </div>
      <div>
        <dt className="inline font-medium">Secondary lesions: </dt>
        <dd className="inline">{formatList(previous.secondaryLesions, 'Not recorded')}</dd>
      </div>
    </dl>
    <p className="mt-2 text-[12px] text-text-secondary">{describeMatches(matchingRegionCount)}</p>
  </section>
);

type Props = {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  assessedBy?: string;
  species?: string;
};

const DermatologyAssessmentForm = ({
  organisationId,
  patientId,
  encounterId,
  assessedBy,
  species,
}: Props) => {
  const { regions: regionOptions, hint: regionHint } = getRegionScope(species);
  const { assessments, isLoading, loadFailed, retry } = useDermatologyHistory(
    organisationId,
    patientId
  );
  const [regions, setRegions] = useState<string[]>([]);
  const [primaryLesions, setPrimaryLesions] = useState('');
  const [secondaryLesions, setSecondaryLesions] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasContext = Boolean(patientId && assessedBy);
  const selected = new Set(regions);
  const previous = assessments.find((record) => !encounterId || record.encounterId !== encounterId);
  const previousRegions = new Set(previous?.affectedRegions);
  const matchingRegionCount = regions.filter((region) => previousRegions.has(region)).length;
  const canSave = hasContext && regions.length > 0 && !isSaving && !saved;
  const inputsDisabled = !hasContext || isLoading || isSaving;

  const toggleRegion = (region: string) => {
    setRegions((current) =>
      current.includes(region) ? current.filter((item) => item !== region) : [...current, region]
    );
    setSaved(false);
  };

  const editLesions = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setSaved(false);
  };

  const save = async () => {
    if (!patientId || !canSave) return;
    setSaveFailed(false);
    setIsSaving(true);
    try {
      await createDermatologyAssessment({
        organisationId,
        patientId,
        encounterId,
        assessedAt: new Date().toISOString(),
        affectedRegions: regions,
        primaryLesions: parseLesions(primaryLesions),
        secondaryLesions: parseLesions(secondaryLesions),
      });
      setSaved(true);
    } catch {
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-body-2 font-bold text-text-primary">Dermatology findings</h3>
        <p className="mt-1 text-body-4 text-text-secondary">
          Select affected body regions and record observed lesion types.
        </p>
      </div>

      {!hasContext && (
        <p className="rounded-xl border border-card-border p-3 text-body-4 text-text-secondary">
          Findings can be recorded once the patient and clinician are loaded.
        </p>
      )}

      <RegionChecklist
        options={regionOptions}
        hint={regionHint}
        selected={selected}
        disabled={inputsDisabled}
        onToggle={toggleRegion}
      />
      <LesionField
        label="Primary lesions"
        value={primaryLesions}
        placeholder="For example: papules, pustules"
        disabled={inputsDisabled}
        onChange={editLesions(setPrimaryLesions)}
      />
      <LesionField
        label="Secondary lesions"
        value={secondaryLesions}
        placeholder="For example: crusts, excoriations"
        disabled={inputsDisabled}
        onChange={editLesions(setSecondaryLesions)}
      />

      {previous && (
        <PreviousFindings previous={previous} matchingRegionCount={matchingRegionCount} />
      )}

      {isLoading && (
        <output className="text-body-4 text-text-secondary">Loading previous findings…</output>
      )}
      {loadFailed && (
        <>
          <p role="alert" className="text-body-4 text-text-error">
            Unable to load previous findings. Please try again.
          </p>
          <button
            type="button"
            className="self-start text-body-4 text-text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
            onClick={retry}
          >
            Retry loading previous findings
          </button>
        </>
      )}
      {saveFailed && (
        <p role="alert" className="text-body-4 text-text-error">
          Unable to save findings. Please try again.
        </p>
      )}
      {saved && <output className="text-body-4 text-pill-success-text">Findings saved.</output>}
      <div className="flex flex-col items-start gap-2">
        <Primary
          text={isSaving ? 'Saving…' : 'Save findings'}
          onClick={save}
          isDisabled={!canSave}
        />
        {hasContext && !isLoading && regions.length === 0 && (
          <p className="text-[12px] text-text-secondary">
            Select at least one affected region to save.
          </p>
        )}
      </div>
    </div>
  );
};

export default DermatologyAssessmentForm;
