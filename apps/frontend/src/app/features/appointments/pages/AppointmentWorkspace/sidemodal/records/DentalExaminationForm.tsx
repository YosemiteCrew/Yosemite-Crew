'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';
import { Primary } from '@/app/ui/primitives/Buttons';
import { Textarea } from '@/app/ui/Input';
import {
  createDentalExamination,
  listDentalExaminations,
  updateDentalExamination,
  type DentalExaminationRecord,
  type DentalToothFinding,
} from '@/app/features/appointments/services/workspaceClinicalService';

type Dentition = 'PERMANENT' | 'DECIDUOUS';
type Quadrant = { id: string; label: string; teeth: string[] };

const PERMANENT_TEETH: Record<'dog' | 'cat', string[][]> = {
  dog: [
    ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110'],
    ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210'],
    ['301', '302', '303', '304', '305', '306', '307', '308', '309', '310', '311'],
    ['401', '402', '403', '404', '405', '406', '407', '408', '409', '410', '411'],
  ],
  cat: [
    ['101', '102', '103', '104', '106', '107', '108', '109'],
    ['201', '202', '203', '204', '206', '207', '208', '209'],
    ['301', '302', '303', '304', '307', '308', '309'],
    ['401', '402', '403', '404', '407', '408', '409'],
  ],
};

const DECIDUOUS_TEETH: Record<'dog' | 'cat', string[][]> = {
  dog: [
    ['501', '502', '503', '504', '506', '507', '508'],
    ['601', '602', '603', '604', '606', '607', '608'],
    ['701', '702', '703', '704', '706', '707', '708'],
    ['801', '802', '803', '804', '806', '807', '808'],
  ],
  cat: [
    ['501', '502', '503', '504', '506', '507', '508'],
    ['601', '602', '603', '604', '606', '607', '608'],
    ['701', '702', '703', '704', '707', '708'],
    ['801', '802', '803', '804', '807', '808'],
  ],
};

const QUADRANT_LABELS = [
  'Right maxillary',
  'Left maxillary',
  'Left mandibular',
  'Right mandibular',
];

export const getDentalQuadrants = (
  species: string | undefined,
  dentition: Dentition
): Quadrant[] => {
  const normalizedSpecies = species?.trim().toLowerCase();
  let dentalSpecies: keyof typeof PERMANENT_TEETH | undefined;
  if (normalizedSpecies?.includes('cat') || normalizedSpecies?.includes('feli')) {
    dentalSpecies = 'cat';
  } else if (
    normalizedSpecies?.includes('dog') ||
    normalizedSpecies?.includes('canis') ||
    normalizedSpecies?.includes('canin')
  ) {
    dentalSpecies = 'dog';
  }
  if (!dentalSpecies) return [];
  const teeth = (dentition === 'DECIDUOUS' ? DECIDUOUS_TEETH : PERMANENT_TEETH)[dentalSpecies];
  return teeth.map((quadrantTeeth, index) => ({
    id: quadrantTeeth[0]?.[0] ?? `${index + 1}00`,
    label: QUADRANT_LABELS[index] ?? 'Dental quadrant',
    teeth: quadrantTeeth,
  }));
};

const CONDITION_OPTIONS: Array<{
  value: NonNullable<DentalToothFinding['condition']>;
  label: string;
}> = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'FRACTURE', label: 'Fracture' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'EXTRACTED', label: 'Extracted' },
  { value: 'SUPERNUMERARY', label: 'Supernumerary' },
  { value: 'PERSISTENT_DECIDUOUS', label: 'Persistent deciduous' },
  { value: 'GINGIVITIS', label: 'Gingivitis' },
  { value: 'PERIODONTITIS', label: 'Periodontitis' },
  { value: 'TOOTH_RESORPTION', label: 'Tooth resorption' },
  { value: 'NEOPLASIA', label: 'Neoplasia' },
  { value: 'OTHER', label: 'Other' },
];

const GRADE_OPTIONS = ['GRADE_0', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4'] as const;

const hasFinding = (finding?: DentalToothFinding) =>
  Boolean(
    finding &&
    (finding.condition ||
      finding.mobilityGrade ||
      finding.calculus !== undefined ||
      finding.periodontalDepth !== undefined ||
      finding.notes?.trim())
  );

const asInputValue = (value: number | undefined) => (value === undefined ? '' : String(value));

const ToothButton = ({
  tooth,
  finding,
  selected,
  disabled,
  onSelect,
}: {
  tooth: string;
  finding?: DentalToothFinding;
  selected: boolean;
  disabled: boolean;
  onSelect: (tooth: string) => void;
}) => {
  const charted = hasFinding(finding);
  const stateClass = selected
    ? 'border-text-brand bg-primary-100 text-blue-text'
    : 'border-card-border bg-[var(--screen)] text-text-primary hover:border-text-brand';
  const markerClass = charted
    ? "after:absolute after:right-1 after:top-1 after:size-1.5 after:rounded-full after:bg-text-brand after:content-['']"
    : '';

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Tooth ${tooth}${charted ? ', finding recorded' : ', not charted'}`}
      onClick={() => onSelect(tooth)}
      disabled={disabled}
      className={`relative min-h-9 min-w-10 rounded-lg border px-1.5 text-caption-2 font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${stateClass} ${markerClass}`}
    >
      {tooth}
    </button>
  );
};

const DentalToothChart = ({
  species,
  selectedTooth,
  draftFindings,
  disabled,
  onSelect,
}: {
  species?: string;
  selectedTooth: string | null;
  draftFindings: Record<string, DentalToothFinding>;
  disabled: boolean;
  onSelect: (tooth: string) => void;
}) => {
  const [dentition, setDentition] = useState<Dentition>('PERMANENT');
  const [manualTooth, setManualTooth] = useState('');
  const quadrants = useMemo(() => getDentalQuadrants(species, dentition), [species, dentition]);
  const addManualTooth = () => {
    const tooth = manualTooth.trim();
    if (!tooth || tooth.length > 10) return;
    onSelect(tooth);
    setManualTooth('');
  };

  if (quadrants.length === 0) {
    return (
      <section
        aria-labelledby="manual-tooth-heading"
        className="rounded-2xl border border-card-border p-3"
      >
        <h4 id="manual-tooth-heading" className="text-body-4 font-bold text-text-primary">
          Tooth identifier
        </h4>
        <p className="mt-1 text-[12px] text-text-secondary">
          Enter the practice’s tooth number or anatomical name for this species.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={manualTooth}
            onChange={(event) => setManualTooth(event.target.value.slice(0, 10))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addManualTooth();
              }
            }}
            aria-label="Tooth identifier"
            maxLength={10}
            disabled={disabled}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          />
          <button
            type="button"
            onClick={addManualTooth}
            disabled={!manualTooth.trim() || disabled}
            className="min-h-11 rounded-xl border border-card-border px-3 text-body-4 font-semibold text-text-brand disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            Select
          </button>
        </div>
      </section>
    );
  }

  let speciesLabel = 'Canine';
  if (species?.toLowerCase().includes('cat') || species?.toLowerCase().includes('feli')) {
    speciesLabel = 'Feline';
  }

  return (
    <section
      aria-labelledby="dental-chart-heading"
      className="rounded-2xl border border-card-border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 id="dental-chart-heading" className="text-body-4 font-bold text-text-primary">
            Tooth chart
          </h4>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            {speciesLabel} · Modified Triadan
          </p>
        </div>
        <div
          className="flex rounded-xl border border-card-border bg-[var(--screen)] p-1"
          role="group"
          aria-label="Dentition"
        >
          {(['PERMANENT', 'DECIDUOUS'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={dentition === value}
              onClick={() => {
                setDentition(value);
                onSelect('');
              }}
              className={`rounded-lg px-2.5 py-1.5 text-caption-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${dentition === value ? 'bg-primary-100 font-semibold text-blue-text' : 'text-text-secondary'}`}
            >
              {value === 'PERMANENT' ? 'Permanent' : 'Deciduous'}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {quadrants.map((quadrant) => (
          <section
            key={quadrant.id}
            aria-label={`${quadrant.label} teeth`}
            className="rounded-xl bg-card-hover p-2.5"
          >
            <h5 className="mb-2 text-caption-2 font-semibold text-text-secondary">
              {quadrant.label}
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {quadrant.teeth.map((tooth) => (
                <ToothButton
                  key={tooth}
                  tooth={tooth}
                  finding={draftFindings[tooth]}
                  selected={selectedTooth === tooth}
                  disabled={disabled}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
};

const DentalToothEditor = ({
  tooth,
  finding,
  previousFinding,
  previousExamDate,
  disabled,
  onUpdate,
}: {
  tooth: string | null;
  finding?: DentalToothFinding;
  previousFinding?: DentalToothFinding;
  previousExamDate?: string | Date;
  disabled: boolean;
  onUpdate: <K extends keyof DentalToothFinding>(
    key: K,
    value: DentalToothFinding[K] | undefined
  ) => void;
}) => {
  if (!tooth) return null;
  const previousCondition = previousFinding?.condition?.replaceAll('_', ' ') ?? 'finding recorded';
  let previousDate = '';
  if (previousExamDate instanceof Date) {
    previousDate = formatStampDate(previousExamDate.toISOString());
  } else if (previousExamDate) {
    previousDate = formatStampDate(previousExamDate);
  }

  return (
    <section
      aria-labelledby="selected-tooth-heading"
      className="rounded-2xl border border-card-border p-3"
    >
      <h4 id="selected-tooth-heading" className="text-body-4 font-bold text-text-primary">
        Tooth {tooth}
      </h4>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-caption-2 font-medium text-text-secondary">
          Condition
          <select
            value={finding?.condition ?? ''}
            onChange={(event) =>
              onUpdate(
                'condition',
                (event.target.value || undefined) as DentalToothFinding['condition']
              )
            }
            disabled={disabled}
            className="min-h-10 rounded-xl border border-card-border bg-[var(--screen)] px-2 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <option value="">Not recorded</option>
            {CONDITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-caption-2 font-medium text-text-secondary">
          Mobility grade
          <select
            value={finding?.mobilityGrade ?? ''}
            onChange={(event) =>
              onUpdate(
                'mobilityGrade',
                (event.target.value || undefined) as DentalToothFinding['mobilityGrade']
              )
            }
            disabled={disabled}
            className="min-h-10 rounded-xl border border-card-border bg-[var(--screen)] px-2 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <option value="">Not recorded</option>
            {[0, 1, 2, 3].map((grade) => (
              <option key={grade} value={`GRADE_${grade}`}>
                Grade {grade}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-caption-2 font-medium text-text-secondary">
          Calculus score
          <select
            value={asInputValue(finding?.calculus)}
            onChange={(event) =>
              onUpdate(
                'calculus',
                event.target.value === '' ? undefined : Number(event.target.value)
              )
            }
            disabled={disabled}
            className="min-h-10 rounded-xl border border-card-border bg-[var(--screen)] px-2 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <option value="">Not recorded</option>
            {[0, 1, 2, 3].map((score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-caption-2 font-medium text-text-secondary">
          Periodontal depth (mm)
          <input
            type="number"
            min="0"
            step="0.1"
            value={asInputValue(finding?.periodontalDepth)}
            onChange={(event) =>
              onUpdate(
                'periodontalDepth',
                event.target.value === '' ? undefined : Number(event.target.value)
              )
            }
            disabled={disabled}
            className="min-h-10 rounded-xl border border-card-border bg-[var(--screen)] px-2 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          />
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-caption-2 font-medium text-text-secondary">
        Tooth notes
        <input
          value={finding?.notes ?? ''}
          onChange={(event) => onUpdate('notes', event.target.value || undefined)}
          maxLength={500}
          disabled={disabled}
          className="min-h-10 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        />
      </label>
      {previousFinding ? (
        <p className="mt-2 rounded-lg bg-card-hover p-2 text-[12px] text-text-secondary">
          Previous visit: {previousCondition} · {previousDate}
        </p>
      ) : null}
    </section>
  );
};

const PreviousExamSummary = ({ exam }: { exam?: DentalExaminationRecord }) => {
  if (!exam) return null;
  const date = formatStampDate(
    exam.examinedAt instanceof Date ? exam.examinedAt.toISOString() : exam.examinedAt
  );
  const findingsSummary = exam.findings
    .map(
      (finding) =>
        `${finding.tooth}: ${finding.condition?.replaceAll('_', ' ') ?? 'finding recorded'}`
    )
    .join(' · ');

  return (
    <section
      aria-labelledby="previous-dental-heading"
      className="rounded-xl border border-card-border p-3"
    >
      <h4 id="previous-dental-heading" className="text-body-4 font-semibold text-text-primary">
        Previous examination
      </h4>
      <p className="mt-1 text-[12px] text-text-secondary">
        {date} · Grade {exam.overallGrade.slice(-1)} · {exam.findings.length} teeth charted
      </p>
      {findingsSummary ? (
        <p className="mt-1 text-body-4 text-text-primary">{findingsSummary}</p>
      ) : null}
    </section>
  );
};

type ExaminationScoreKey = 'calculus' | 'plaque' | 'gingival';

const ExaminationScores = ({
  values,
  onChange,
  disabled,
}: {
  values: { calculus: string; plaque: string; gingival: string };
  onChange: (key: ExaminationScoreKey, value: string) => void;
  disabled: boolean;
}) => (
  <section aria-label="Examination scores" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {(
      [
        ['Calculus score', 'calculus'],
        ['Plaque score', 'plaque'],
        ['Gingival score', 'gingival'],
      ] as const
    ).map(([label, key]) => (
      <label
        key={key}
        className="flex flex-col gap-1 text-caption-2 font-medium text-text-secondary"
      >
        {label}
        <select
          value={values[key]}
          onChange={(event) => onChange(key, event.target.value)}
          disabled={disabled}
          className="min-h-10 rounded-xl border border-card-border bg-[var(--screen)] px-2 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          <option value="">Not recorded</option>
          {[0, 1, 2, 3].map((score) => (
            <option key={score} value={score}>
              {score}
            </option>
          ))}
        </select>
      </label>
    ))}
  </section>
);

type Props = {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  species?: string;
};

const DentalExaminationForm = ({ organisationId, patientId, encounterId, species }: Props) => {
  const [history, setHistory] = useState<{
    patientId: string;
    records: DentalExaminationRecord[];
  } | null>(null);
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [draftFindings, setDraftFindings] = useState<Record<string, DentalToothFinding>>({});
  const [overallGrade, setOverallGrade] = useState('');
  const [calculusScore, setCalculusScore] = useState('');
  const [plaqueScore, setPlaqueScore] = useState('');
  const [gingivalScore, setGingivalScore] = useState('');
  const [procedures, setProcedures] = useState('');
  const [notes, setNotes] = useState('');
  const [loadState, setLoadState] = useState<{
    patientId: string | null;
    attempt: number;
    complete: boolean;
  }>({ patientId: null, attempt: -1, complete: false });
  const [isSaving, setIsSaving] = useState(false);
  const [savedPatientId, setSavedPatientId] = useState<string | null>(null);
  const [error, setError] = useState<{ patientId: string; message: string } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const records = history && history.patientId === patientId ? history.records : [];
  const currentExam = records.find((record) => encounterId && record.encounterId === encounterId);
  const previousExam = records.find((record) => record.id !== currentExam?.id);
  const isLoading = Boolean(
    patientId &&
    (loadState.patientId !== patientId || loadState.attempt !== loadAttempt || !loadState.complete)
  );
  const saved = Boolean(patientId && savedPatientId === patientId);
  const visibleError = error && error.patientId === patientId ? error.message : null;
  const selectedFinding = selectedTooth ? draftFindings[selectedTooth] : undefined;
  const findings = Object.values(draftFindings).filter(hasFinding);
  const canSave = Boolean(patientId && overallGrade && !isLoading && !isSaving);
  let saveLabel = 'Save examination';
  if (currentExam) saveLabel = 'Update examination';
  if (isSaving) saveLabel = 'Saving…';

  const updateScore = (key: ExaminationScoreKey, value: string) => {
    if (key === 'calculus') setCalculusScore(value);
    else if (key === 'plaque') setPlaqueScore(value);
    else setGingivalScore(value);
    setSavedPatientId(null);
  };

  useEffect(() => {
    if (!patientId) return;

    let active = true;
    listDentalExaminations(organisationId, patientId)
      .then((loadedRecords) => {
        if (!active) return;
        setLoadState({ patientId, attempt: loadAttempt, complete: true });
        setHistory({ patientId, records: loadedRecords });
        const savedExam = encounterId
          ? loadedRecords.find((record) => record.encounterId === encounterId)
          : undefined;
        setDraftFindings(
          Object.fromEntries((savedExam?.findings ?? []).map((finding) => [finding.tooth, finding]))
        );
        setOverallGrade(savedExam?.overallGrade ?? '');
        setCalculusScore(asInputValue(savedExam?.calculusScore ?? undefined));
        setPlaqueScore(asInputValue(savedExam?.plaqueScore ?? undefined));
        setGingivalScore(asInputValue(savedExam?.gingivalScore ?? undefined));
        setProcedures(savedExam?.procedures.join(', ') ?? '');
        setNotes(savedExam?.notes ?? '');
        setSelectedTooth(null);
      })
      .catch(() => {
        if (!active) return;
        setLoadState({ patientId, attempt: loadAttempt, complete: true });
        setError({
          patientId,
          message: 'Unable to load previous dental findings. Please try again.',
        });
      });

    return () => {
      active = false;
    };
  }, [encounterId, loadAttempt, organisationId, patientId]);

  const updateSelectedFinding = <K extends keyof DentalToothFinding>(
    key: K,
    value: DentalToothFinding[K] | undefined
  ) => {
    if (!selectedTooth) return;
    setDraftFindings((current) => {
      const next = { ...current };
      const finding = { ...(next[selectedTooth] ?? { tooth: selectedTooth }), [key]: value };
      if (hasFinding(finding)) next[selectedTooth] = finding;
      else delete next[selectedTooth];
      return next;
    });
    setSavedPatientId(null);
  };

  const save = async () => {
    if (!patientId || !overallGrade || !canSave) return;
    setError(null);
    setSavedPatientId(null);
    setIsSaving(true);
    const examFields = {
      overallGrade: overallGrade as DentalExaminationRecord['overallGrade'],
      findings,
      calculusScore: calculusScore === '' ? undefined : Number(calculusScore),
      plaqueScore: plaqueScore === '' ? undefined : Number(plaqueScore),
      gingivalScore: gingivalScore === '' ? undefined : Number(gingivalScore),
      procedures: procedures
        .split(',')
        .map((procedure) => procedure.trim())
        .filter(Boolean),
      notes: notes.trim() || undefined,
    };

    try {
      const record = currentExam
        ? await updateDentalExamination(organisationId, currentExam.id, {
            ...examFields,
            calculusScore: examFields.calculusScore ?? null,
            plaqueScore: examFields.plaqueScore ?? null,
            gingivalScore: examFields.gingivalScore ?? null,
            notes: examFields.notes ?? null,
          })
        : await createDentalExamination({
            organisationId,
            patientId,
            encounterId,
            examinedAt: new Date().toISOString(),
            ...examFields,
          });
      setHistory((current) => ({
        patientId,
        records: [
          record,
          ...(current?.patientId === patientId ? current.records : []).filter(
            (item) => item.id !== record.id
          ),
        ],
      }));
      setSavedPatientId(patientId);
    } catch {
      setError({ patientId, message: 'Unable to save dental findings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-2xl border border-card-border bg-[var(--screen)] p-4">
        <p className="text-caption-2 font-semibold uppercase tracking-[0.12em] text-text-brand">
          Clinical record
        </p>
        <h3 className="mt-1 text-body-2 font-bold text-text-primary">Dental examination</h3>
        <p className="mt-1 text-body-4 text-text-secondary">
          Chart each tooth with Modified Triadan numbers, then save the visit findings.
        </p>
      </header>

      {!patientId ? (
        <p className="rounded-xl border border-card-border p-3 text-body-4 text-text-secondary">
          Dental findings can be recorded once the patient is loaded.
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-body-4 font-medium text-text-primary">
        Overall periodontal grade <span className="text-text-error">Required</span>
        <select
          value={overallGrade}
          onChange={(event) => {
            setOverallGrade(event.target.value);
            setSavedPatientId(null);
          }}
          disabled={!patientId || isLoading || isSaving}
          className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          <option value="">Select a grade</option>
          {GRADE_OPTIONS.map((grade) => (
            <option key={grade} value={grade}>
              Grade {grade.slice(-1)}
            </option>
          ))}
        </select>
      </label>

      <DentalToothChart
        species={species}
        selectedTooth={selectedTooth}
        draftFindings={draftFindings}
        disabled={!patientId || isLoading || isSaving}
        onSelect={(tooth) => setSelectedTooth(tooth || null)}
      />

      <DentalToothEditor
        tooth={selectedTooth}
        finding={selectedFinding}
        previousFinding={previousExam?.findings.find((finding) => finding.tooth === selectedTooth)}
        previousExamDate={previousExam?.examinedAt}
        disabled={isLoading || isSaving}
        onUpdate={updateSelectedFinding}
      />
      <PreviousExamSummary exam={previousExam} />

      <ExaminationScores
        values={{ calculus: calculusScore, plaque: plaqueScore, gingival: gingivalScore }}
        onChange={updateScore}
        disabled={!patientId || isLoading || isSaving}
      />

      <label className="flex flex-col gap-1 text-caption-2 font-medium text-text-secondary">
        Procedures performed
        <input
          value={procedures}
          onChange={(event) => {
            setProcedures(event.target.value);
            setSavedPatientId(null);
          }}
          placeholder="Separate procedures with commas"
          disabled={!patientId || isLoading || isSaving}
          className="min-h-10 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        />
      </label>
      <label className="flex flex-col gap-1 text-caption-2 font-medium text-text-secondary">
        Examination notes
        <Textarea
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setSavedPatientId(null);
          }}
          maxLength={3000}
          rows={3}
          disabled={!patientId || isLoading || isSaving}
          className="rounded-xl border border-card-border bg-[var(--screen)] px-3 py-2 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        />
      </label>

      {isLoading ? (
        <p role="status" className="text-body-4 text-text-secondary">
          Loading previous dental findings…
        </p>
      ) : null}
      {visibleError ? (
        <p role="alert" className="text-body-4 text-text-error">
          {visibleError}
        </p>
      ) : null}
      {visibleError?.startsWith('Unable to load') ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoadAttempt((attempt) => attempt + 1);
          }}
          className="self-start text-body-4 text-text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          Retry loading previous findings
        </button>
      ) : null}
      {saved ? (
        <p role="status" className="text-body-4 text-pill-success-text">
          Dental examination saved.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Primary onClick={save} isDisabled={!canSave} text={saveLabel} />
      </div>
    </div>
  );
};

export default DentalExaminationForm;
