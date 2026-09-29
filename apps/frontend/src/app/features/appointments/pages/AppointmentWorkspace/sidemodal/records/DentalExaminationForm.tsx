'use client';

import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';
import { Primary } from '@/app/ui/primitives/Buttons';
import { Textarea } from '@/app/ui/Input';
import {
  createDentalExamination,
  listDentalExaminations,
  updateDentalExamination,
  type DentalExaminationRecord,
  type DentalToothFinding,
} from '@/app/features/appointments/services/workspaceClinicalService';
import {
  CONDITION_OPTIONS,
  conditionLabel,
  describeTooth,
  getDentalQuadrants,
  hasFinding,
  isTriadanTooth,
  resolveDentalSpecies,
  type Dentition,
} from './dentalChart';

const GRADE_OPTIONS = ['GRADE_0', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4'] as const;
const SCORE_OPTIONS = [0, 1, 2, 3];

const FIELD_CLASS =
  'min-h-10 rounded-xl border border-card-border bg-[var(--screen)] px-2 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand';
const LABEL_CLASS = 'flex flex-col gap-1 text-caption-2 font-medium text-text-secondary';

const asInputValue = (value: number | null | undefined) =>
  value === undefined || value === null ? '' : String(value);

const formatExamDate = (value: string | Date) =>
  formatDateInPreferredTimeZone(new Date(value), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const toothStateLabel = (finding?: DentalToothFinding) => {
  if (!hasFinding(finding)) return 'not charted';
  return finding?.condition
    ? `${conditionLabel(finding.condition).toLowerCase()} recorded`
    : 'finding recorded';
};

type ScoreKey = 'calculus' | 'plaque' | 'gingival';
type DraftField = 'overallGrade' | ScoreKey | 'procedures' | 'notes';

/** Everything the clinician edits for one visit, tagged with the patient it belongs to. */
type ExamDraft = Record<DraftField, string> & {
  patientId: string | null;
  findings: Record<string, DentalToothFinding>;
  selectedTooth: string | null;
  saved: boolean;
};

type DraftAction =
  | { type: 'hydrate'; patientId: string; exam?: DentalExaminationRecord }
  | { type: 'field'; key: DraftField; value: string }
  | { type: 'select'; tooth: string | null }
  | { type: 'finding'; patch: Partial<DentalToothFinding> }
  | { type: 'saved' };

const EMPTY_DRAFT: ExamDraft = {
  patientId: null,
  findings: {},
  selectedTooth: null,
  overallGrade: '',
  calculus: '',
  plaque: '',
  gingival: '',
  procedures: '',
  notes: '',
  saved: false,
};

const draftReducer = (draft: ExamDraft, action: DraftAction): ExamDraft => {
  switch (action.type) {
    case 'hydrate': {
      const { exam } = action;
      return {
        ...EMPTY_DRAFT,
        patientId: action.patientId,
        findings: Object.fromEntries((exam?.findings ?? []).map((f) => [f.tooth, f])),
        overallGrade: exam?.overallGrade ?? '',
        calculus: asInputValue(exam?.calculusScore),
        plaque: asInputValue(exam?.plaqueScore),
        gingival: asInputValue(exam?.gingivalScore),
        procedures: exam?.procedures.join(', ') ?? '',
        notes: exam?.notes ?? '',
      };
    }
    case 'field':
      return { ...draft, [action.key]: action.value, saved: false };
    case 'select':
      return { ...draft, selectedTooth: action.tooth };
    case 'finding': {
      const tooth = draft.selectedTooth;
      if (!tooth) return draft;
      const findings = { ...draft.findings };
      const finding = { ...(findings[tooth] ?? { tooth }), ...action.patch };
      if (hasFinding(finding)) findings[tooth] = finding;
      else delete findings[tooth];
      return { ...draft, findings, saved: false };
    }
    case 'saved':
      return { ...draft, saved: true };
  }
};

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
  const anatomy = describeTooth(tooth);
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
      aria-label={[`Tooth ${tooth}`, anatomy, toothStateLabel(finding)].filter(Boolean).join(', ')}
      onClick={() => onSelect(tooth)}
      disabled={disabled}
      className={`relative min-h-9 min-w-10 rounded-lg border px-1.5 text-caption-2 font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${stateClass} ${markerClass}`}
    >
      {tooth}
    </button>
  );
};

type ChartProps = {
  species?: string;
  selectedTooth: string | null;
  findings: Record<string, DentalToothFinding>;
  disabled: boolean;
  onSelect: (tooth: string | null) => void;
};

/** Species without a built-in chart still use Modified Triadan numbers, typed in. */
const ManualToothEntry = ({ selectedTooth, findings, disabled, onSelect }: ChartProps) => {
  const [manualTooth, setManualTooth] = useState('');
  const [invalid, setInvalid] = useState(false);
  const chartedTeeth = Object.keys(findings).sort((a, b) => a.localeCompare(b));
  const addManualTooth = () => {
    const tooth = manualTooth.trim();
    if (!isTriadanTooth(tooth)) {
      setInvalid(true);
      return;
    }
    onSelect(tooth);
    setManualTooth('');
    setInvalid(false);
  };

  return (
    <section
      aria-labelledby="manual-tooth-heading"
      className="rounded-2xl border border-card-border p-3"
    >
      <h4 id="manual-tooth-heading" className="text-body-4 font-bold text-text-primary">
        Tooth number
      </h4>
      <p id="manual-tooth-hint" className="mt-1 text-[12px] text-text-secondary">
        There is no built-in chart for this species. Enter the Modified Triadan number, for example
        106.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={manualTooth}
          onChange={(event) => {
            setManualTooth(event.target.value.slice(0, 3));
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addManualTooth();
            }
          }}
          aria-label="Tooth number"
          aria-describedby={invalid ? 'manual-tooth-error' : 'manual-tooth-hint'}
          aria-invalid={invalid}
          inputMode="numeric"
          maxLength={3}
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
      {invalid ? (
        <p id="manual-tooth-error" className="mt-2 text-[12px] text-text-error">
          Use a quadrant from 1 to 8 followed by a position from 01 to 11, for example 106.
        </p>
      ) : null}
      {chartedTeeth.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Charted teeth">
          {chartedTeeth.map((tooth) => (
            <li key={tooth}>
              <ToothButton
                tooth={tooth}
                finding={findings[tooth]}
                selected={selectedTooth === tooth}
                disabled={disabled}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};

const DentalToothChart = (props: ChartProps) => {
  const { species, selectedTooth, findings, disabled, onSelect } = props;
  const [dentition, setDentition] = useState<Dentition>('PERMANENT');
  const quadrants = useMemo(() => getDentalQuadrants(species, dentition), [species, dentition]);

  if (quadrants.length === 0) return <ManualToothEntry {...props} />;

  const speciesLabel = resolveDentalSpecies(species) === 'cat' ? 'Feline' : 'Canine';

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
        <fieldset className="flex min-w-0 rounded-xl border border-card-border bg-[var(--screen)] p-1">
          <legend className="sr-only">Dentition</legend>
          {(['PERMANENT', 'DECIDUOUS'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={dentition === value}
              onClick={() => {
                setDentition(value);
                onSelect(null);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-caption-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${dentition === value ? 'bg-primary-100 font-semibold text-blue-text' : 'text-text-secondary'}`}
            >
              {value === 'PERMANENT' ? 'Permanent' : 'Deciduous'}
            </button>
          ))}
        </fieldset>
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
                  finding={findings[tooth]}
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

const ScoreSelect = ({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) => (
  <label className={LABEL_CLASS}>
    <span>{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={FIELD_CLASS}
    >
      <option value="">Not recorded</option>
      {SCORE_OPTIONS.map((score) => (
        <option key={score} value={score}>
          {score}
        </option>
      ))}
    </select>
  </label>
);

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
  onUpdate: (patch: Partial<DentalToothFinding>) => void;
}) => {
  if (!tooth) return null;
  const anatomy = describeTooth(tooth);

  return (
    <section
      aria-labelledby="selected-tooth-heading"
      className="rounded-2xl border border-card-border p-3"
    >
      <h4 id="selected-tooth-heading" className="text-body-4 font-bold text-text-primary">
        Tooth {tooth}
      </h4>
      {anatomy ? (
        <p className="text-[12px] text-text-secondary">
          {anatomy.charAt(0).toUpperCase() + anatomy.slice(1)}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          <span>Condition</span>
          <select
            value={finding?.condition ?? ''}
            onChange={(event) =>
              onUpdate({
                condition: (event.target.value || undefined) as DentalToothFinding['condition'],
              })
            }
            disabled={disabled}
            className={FIELD_CLASS}
          >
            <option value="">Not recorded</option>
            {CONDITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          <span>Mobility grade</span>
          <select
            value={finding?.mobilityGrade ?? ''}
            onChange={(event) =>
              onUpdate({
                mobilityGrade: (event.target.value ||
                  undefined) as DentalToothFinding['mobilityGrade'],
              })
            }
            disabled={disabled}
            className={FIELD_CLASS}
          >
            <option value="">Not recorded</option>
            {SCORE_OPTIONS.map((grade) => (
              <option key={grade} value={`GRADE_${grade}`}>
                Grade {grade}
              </option>
            ))}
          </select>
        </label>
        <ScoreSelect
          label="Calculus score"
          value={asInputValue(finding?.calculus)}
          disabled={disabled}
          onChange={(value) => onUpdate({ calculus: value === '' ? undefined : Number(value) })}
        />
        <label className={LABEL_CLASS}>
          <span>Periodontal depth (mm)</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={asInputValue(finding?.periodontalDepth)}
            onChange={(event) => {
              const depth = Number(event.target.value);
              onUpdate({
                periodontalDepth:
                  event.target.value === '' || Number.isNaN(depth) || depth < 0 ? undefined : depth,
              });
            }}
            disabled={disabled}
            className={FIELD_CLASS}
          />
        </label>
      </div>
      <label className={`mt-3 ${LABEL_CLASS}`}>
        <span>Tooth notes</span>
        <input
          value={finding?.notes ?? ''}
          onChange={(event) => onUpdate({ notes: event.target.value || undefined })}
          maxLength={500}
          disabled={disabled}
          className={`${FIELD_CLASS} px-3`}
        />
      </label>
      {previousFinding && previousExamDate ? (
        <p className="mt-2 rounded-lg bg-card-hover p-2 text-[12px] text-text-secondary">
          Previous visit: {conditionLabel(previousFinding.condition)} ·{' '}
          {formatExamDate(previousExamDate)}
        </p>
      ) : null}
    </section>
  );
};

const PreviousExamSummary = ({ exam }: { exam?: DentalExaminationRecord }) => {
  if (!exam) return null;
  const findingsSummary = exam.findings
    .map((finding) => `${finding.tooth}: ${conditionLabel(finding.condition)}`)
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
        {formatExamDate(exam.examinedAt)} · Grade {exam.overallGrade.slice(-1)} ·{' '}
        {exam.findings.length} {exam.findings.length === 1 ? 'tooth' : 'teeth'} charted
      </p>
      {findingsSummary ? (
        <p className="mt-1 text-body-4 text-text-primary">{findingsSummary}</p>
      ) : null}
    </section>
  );
};

const optionalScore = (value: string) => (value === '' ? null : Number(value));

type Props = {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  species?: string;
};

type History = {
  key: string;
  patientId: string;
  records: DentalExaminationRecord[];
  failed: boolean;
};

const Notice = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-xl border border-card-border p-3 text-body-4 text-text-secondary">
    {children}
  </p>
);

/**
 * Loads the patient's dental history once per patient (and per retry) and hands this visit's
 * examination to the draft. Results that arrive after the patient changed are dropped.
 */
const useDentalHistory = (
  organisationId: string,
  patientId: string | undefined,
  encounterId: string | undefined,
  canView: boolean,
  dispatch: React.Dispatch<DraftAction>
) => {
  const [history, setHistory] = useState<History | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loadKey = patientId ? `${patientId}:${loadAttempt}` : null;
  const isLoading = Boolean(canView && loadKey && history?.key !== loadKey);
  const loadFailed = Boolean(!isLoading && history?.failed && history.key === loadKey);
  const records =
    history && !history.failed && history.patientId === patientId ? history.records : [];

  useEffect(() => {
    if (!canView || !patientId) return;
    const key = `${patientId}:${loadAttempt}`;
    let active = true;
    listDentalExaminations(organisationId, patientId)
      .then((loaded) => {
        if (!active) return;
        setHistory({ key, patientId, records: loaded, failed: false });
        dispatch({
          type: 'hydrate',
          patientId,
          exam: encounterId
            ? loaded.find((record) => record.encounterId === encounterId)
            : undefined,
        });
      })
      .catch(() => {
        if (active) setHistory({ key, patientId, records: [], failed: true });
      });
    return () => {
      active = false;
    };
  }, [canView, dispatch, encounterId, loadAttempt, organisationId, patientId]);

  const remember = (savedFor: string, record: DentalExaminationRecord) =>
    setHistory((current) =>
      current?.patientId === savedFor
        ? {
            ...current,
            records: [record, ...current.records.filter((item) => item.id !== record.id)],
          }
        : current
    );

  return {
    records,
    isLoading,
    loadFailed,
    retry: () => setLoadAttempt((attempt) => attempt + 1),
    remember,
  };
};

/** Creates this visit's examination, or updates it; an update clears what was emptied. */
const persistExamination = (
  target: { organisationId: string; patientId: string; encounterId: string },
  currentExam: DentalExaminationRecord | undefined,
  draft: ExamDraft
) => {
  const examFields = {
    overallGrade: draft.overallGrade as DentalExaminationRecord['overallGrade'],
    findings: Object.values(draft.findings),
    procedures: draft.procedures.split(',').flatMap((procedure) => {
      const trimmed = procedure.trim();
      return trimmed ? [trimmed] : [];
    }),
  };
  const optional = {
    calculusScore: optionalScore(draft.calculus),
    plaqueScore: optionalScore(draft.plaque),
    gingivalScore: optionalScore(draft.gingival),
    notes: draft.notes.trim() || null,
  };
  if (currentExam) {
    return updateDentalExamination(target.organisationId, currentExam.id, {
      ...examFields,
      ...optional,
    });
  }
  return createDentalExamination({
    ...target,
    examinedAt: new Date().toISOString(),
    ...examFields,
    calculusScore: optional.calculusScore ?? undefined,
    plaqueScore: optional.plaqueScore ?? undefined,
    gingivalScore: optional.gingivalScore ?? undefined,
    notes: optional.notes ?? undefined,
  });
};

const findExams = (records: DentalExaminationRecord[], encounterId?: string) => {
  const currentExam = encounterId
    ? records.find((record) => record.encounterId === encounterId)
    : undefined;
  const currentExamTime = currentExam ? new Date(currentExam.examinedAt).getTime() : Infinity;
  const previousExam = records.find(
    (record) =>
      record.id !== currentExam?.id && new Date(record.examinedAt).getTime() < currentExamTime
  );
  return { currentExam, previousExam };
};

/** Why the form is not editable yet, or the history request's state. */
const LoadStatus = ({
  canEdit,
  hasVisit,
  isLoading,
  loadFailed,
  onRetry,
}: {
  canEdit: boolean;
  hasVisit: boolean;
  isLoading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
}) => (
  <>
    {canEdit ? null : (
      <Notice>
        You can review dental findings. Recording them needs permission to edit appointments.
      </Notice>
    )}
    {canEdit && !hasVisit ? (
      <Notice>Dental findings can be recorded once the visit is open.</Notice>
    ) : null}
    {isLoading ? (
      <output className="block text-body-4 text-text-secondary">
        Loading previous dental findings…
      </output>
    ) : null}
    {loadFailed ? (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="text-body-4 text-text-error">
          Unable to load previous dental findings. Please try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="text-body-4 text-text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          Retry loading previous findings
        </button>
      </div>
    ) : null}
  </>
);

const DentalExaminationForm = ({ organisationId, patientId, encounterId, species }: Props) => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.APPOINTMENTS_VIEW_ANY);
  const canEdit = permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const [rawDraft, dispatch] = useReducer(draftReducer, EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailedFor, setSaveFailedFor] = useState<string | null>(null);
  const { records, isLoading, loadFailed, retry, remember } = useDentalHistory(
    organisationId,
    patientId,
    encounterId,
    canView,
    dispatch
  );

  // A draft from another patient is never shown, not even for the frame before it reloads.
  const draft = rawDraft.patientId === patientId ? rawDraft : EMPTY_DRAFT;
  const { currentExam, previousExam } = findExams(records, encounterId);
  const chartReady = Boolean(patientId && canView && !isLoading && !loadFailed);
  const formDisabled = !chartReady || !canEdit || !encounterId || isSaving;
  const canSave = !formDisabled && Boolean(draft.overallGrade);
  const saveError = Boolean(patientId && saveFailedFor === patientId);
  const selectedFinding = draft.selectedTooth ? draft.findings[draft.selectedTooth] : undefined;
  let saveLabel = currentExam ? 'Update examination' : 'Save examination';
  if (isSaving) saveLabel = 'Saving…';

  const setField = (key: DraftField, value: string) => dispatch({ type: 'field', key, value });

  const save = async () => {
    if (!canSave || !patientId || !encounterId) return;
    setSaveFailedFor(null);
    setIsSaving(true);
    try {
      const record = await persistExamination(
        { organisationId, patientId, encounterId },
        currentExam,
        draft
      );
      remember(patientId, record);
      dispatch({ type: 'saved' });
    } catch {
      setSaveFailedFor(patientId);
    } finally {
      setIsSaving(false);
    }
  };

  if (!patientId) {
    return <Notice>Dental findings can be recorded once the patient is loaded.</Notice>;
  }
  if (!canView) {
    return <Notice>You do not have permission to view dental examinations.</Notice>;
  }

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

      <LoadStatus
        canEdit={canEdit}
        hasVisit={Boolean(encounterId)}
        isLoading={isLoading}
        loadFailed={loadFailed}
        onRetry={retry}
      />

      <label className="flex flex-col gap-1 text-body-4 font-medium text-text-primary">
        <span>
          Overall periodontal grade <span className="text-text-error">Required</span>
        </span>
        <select
          value={draft.overallGrade}
          onChange={(event) => setField('overallGrade', event.target.value)}
          disabled={formDisabled}
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
        selectedTooth={draft.selectedTooth}
        findings={draft.findings}
        disabled={!chartReady}
        onSelect={(tooth) => dispatch({ type: 'select', tooth })}
      />

      <DentalToothEditor
        tooth={draft.selectedTooth}
        finding={selectedFinding}
        previousFinding={previousExam?.findings.find(
          (finding) => finding.tooth === draft.selectedTooth
        )}
        previousExamDate={previousExam?.examinedAt}
        disabled={formDisabled}
        onUpdate={(patch) => dispatch({ type: 'finding', patch })}
      />
      <PreviousExamSummary exam={previousExam} />

      <section aria-label="Examination scores" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ScoreSelect
          label="Calculus score"
          value={draft.calculus}
          disabled={formDisabled}
          onChange={(value) => setField('calculus', value)}
        />
        <ScoreSelect
          label="Plaque score"
          value={draft.plaque}
          disabled={formDisabled}
          onChange={(value) => setField('plaque', value)}
        />
        <ScoreSelect
          label="Gingival score"
          value={draft.gingival}
          disabled={formDisabled}
          onChange={(value) => setField('gingival', value)}
        />
      </section>

      <label className={LABEL_CLASS}>
        <span>Procedures performed</span>
        <input
          value={draft.procedures}
          onChange={(event) => setField('procedures', event.target.value)}
          placeholder="Separate procedures with commas"
          disabled={formDisabled}
          className={`${FIELD_CLASS} px-3`}
        />
      </label>
      <label className={LABEL_CLASS}>
        <span>Examination notes</span>
        <Textarea
          value={draft.notes}
          onChange={(event) => setField('notes', event.target.value)}
          maxLength={3000}
          rows={3}
          disabled={formDisabled}
          className="rounded-xl border border-card-border bg-[var(--screen)] px-3 py-2 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        />
      </label>

      {saveError ? (
        <p role="alert" className="text-body-4 text-text-error">
          Unable to save dental findings. Please try again.
        </p>
      ) : null}
      {draft.saved ? (
        <output className="block text-body-4 text-pill-success-text">
          Dental examination saved.
        </output>
      ) : null}
      {canEdit ? (
        <div className="flex justify-end">
          <Primary onClick={save} isDisabled={!canSave} text={saveLabel} />
        </div>
      ) : null}
    </div>
  );
};

export default DentalExaminationForm;
