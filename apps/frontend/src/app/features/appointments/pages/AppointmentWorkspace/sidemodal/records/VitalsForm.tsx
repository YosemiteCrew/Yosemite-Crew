'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LuCheck, LuEye, LuEyeOff } from 'react-icons/lu';
import Search from '@/app/ui/inputs/Search';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { Vitals } from '@/app/features/appointments/types/workspace';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';
import { saveVitalRecord } from '@/app/features/appointments/services/workspaceClinicalService';
import { listVitalsTemplates } from '@/app/features/appointments/services/workspaceTemplateService';
import { getCategoryTemplate } from '@/app/lib/forms';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import type { FormField } from '@/app/features/forms/types/forms';
import type {
  TemplateFieldDefinition,
  TemplateLike,
  TemplateSchemaSnapshot,
} from '@yosemite-crew/types';

type VitalsFormProps = {
  appointmentId: string;
  organisationId: string;
  encounterId?: string;
  authorId?: string;
  /** Display name of the logged-in clinician; recorded as the vitals recorder. */
  authorName?: string;
  vitals: Vitals[];
};

type Field = {
  key: keyof DraftVitals;
  label: string;
  unit: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
  min?: number;
  max?: number;
};

type DraftVitals = {
  weightLbs: string;
  tempF: string;
  heartRateBpm: string;
  respRateBpm: string;
  crtSec: string;
  mucousMembrane: string;
  painScore: string;
  bcs: string;
};

const EMPTY_DRAFT: DraftVitals = {
  weightLbs: '',
  tempF: '',
  heartRateBpm: '',
  respRateBpm: '',
  crtSec: '',
  mucousMembrane: '',
  painScore: '',
  bcs: '',
};

const FIELD_FALLBACKS: Record<keyof DraftVitals, Field> = {
  weightLbs: {
    key: 'weightLbs',
    label: 'Weight',
    unit: 'lbs',
    inputMode: 'decimal',
    min: 0,
    max: 2000,
  },
  tempF: {
    key: 'tempF',
    label: 'Temperature',
    unit: '°F',
    inputMode: 'decimal',
    min: 80,
    max: 110,
  },
  heartRateBpm: {
    key: 'heartRateBpm',
    label: 'Heart rate',
    unit: 'bpm',
    inputMode: 'numeric',
    min: 0,
    max: 300,
  },
  respRateBpm: {
    key: 'respRateBpm',
    label: 'Respiratory rate',
    unit: 'bpm',
    inputMode: 'numeric',
    min: 0,
    max: 150,
  },
  crtSec: { key: 'crtSec', label: 'CRT', unit: 'sec', inputMode: 'text' },
  mucousMembrane: { key: 'mucousMembrane', label: 'Mucous membrane', unit: '', inputMode: 'text' },
  painScore: {
    key: 'painScore',
    label: 'Pain score',
    unit: '/ 10',
    inputMode: 'numeric',
    min: 0,
    max: 10,
  },
  bcs: { key: 'bcs', label: 'BCS', unit: '/ 9', inputMode: 'numeric', min: 1, max: 9 },
};

const DEFAULT_FIELDS: Field[] = [
  FIELD_FALLBACKS.weightLbs,
  FIELD_FALLBACKS.tempF,
  FIELD_FALLBACKS.heartRateBpm,
  FIELD_FALLBACKS.respRateBpm,
  FIELD_FALLBACKS.crtSec,
  FIELD_FALLBACKS.mucousMembrane,
  FIELD_FALLBACKS.painScore,
  FIELD_FALLBACKS.bcs,
];

const normalizeKey = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

const resolveDraftKey = (field: { key?: string; id?: string; label?: string }) => {
  const value = normalizeKey([field.key, field.id, field.label].filter(Boolean).join(' '));
  if (value.includes('weight')) return 'weightLbs';
  if (value.includes('temp')) return 'tempF';
  if (value.includes('heart') || value.includes('pulse')) return 'heartRateBpm';
  if (value.includes('resp')) return 'respRateBpm';
  if (value.includes('crt')) return 'crtSec';
  if (value.includes('mucous') || value.includes('membrane')) return 'mucousMembrane';
  if (value.includes('pain')) return 'painScore';
  if (value.includes('bcs') || value.includes('bodyscore')) return 'bcs';
  return undefined;
};

const hasTemplateSchemaSnapshot = (value: unknown): value is TemplateSchemaSnapshot =>
  Boolean(
    value && typeof value === 'object' && Array.isArray((value as { sections?: unknown }).sections)
  );

const getTemplateSchemaSnapshot = (template: TemplateLike): TemplateSchemaSnapshot | undefined => {
  const rootSnapshot = (template as TemplateLike & { schemaSnapshot?: unknown }).schemaSnapshot;
  if (hasTemplateSchemaSnapshot(rootSnapshot)) return rootSnapshot;
  const version = template.versions?.find(
    (item) => item.version === template.publishedVersion || item.version === template.latestVersion
  );
  return hasTemplateSchemaSnapshot(version?.schemaSnapshot) ? version.schemaSnapshot : undefined;
};

const flattenFormFields = (fields: FormField[] = []): FormField[] =>
  fields.flatMap((field) =>
    field.type === 'group' ? flattenFormFields(field.fields ?? []) : [field]
  );

const getUnitFromRecord = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const unit = (value as { unit?: unknown }).unit;
  return typeof unit === 'string' ? unit : undefined;
};

const resolveVitalFieldUnit = (key: keyof DraftVitals, configuredUnit: string | undefined) => {
  if (key === 'mucousMembrane') return '';
  return configuredUnit ?? FIELD_FALLBACKS[key].unit;
};

const defaultVitalFieldsFromFormsSchema = (): Field[] => {
  const fields = flattenFormFields(getCategoryTemplate('Vitals'));
  const mapped = fields.flatMap((field) => {
    const key = resolveDraftKey({ id: field.id, label: field.label });
    if (!key) return [];
    const unit = resolveVitalFieldUnit(key, getUnitFromRecord(field.meta));
    return [
      {
        ...FIELD_FALLBACKS[key],
        label: field.label || FIELD_FALLBACKS[key].label,
        unit,
      },
    ];
  });
  return mapped.length > 0 ? mapped : DEFAULT_FIELDS;
};

const templateToVitalFields = (template: TemplateLike): Field[] => {
  const fields =
    getTemplateSchemaSnapshot(template)?.sections.flatMap((section) => section.fields) ?? [];
  const mapped = fields.flatMap((field: TemplateFieldDefinition) => {
    const key = resolveDraftKey(field);
    if (!key) return [];
    const unit = resolveVitalFieldUnit(key, getUnitFromRecord(field.rules));
    return [
      {
        ...FIELD_FALLBACKS[key],
        label: field.label || FIELD_FALLBACKS[key].label,
        unit,
      },
    ];
  });
  return mapped.length > 0 ? mapped : defaultVitalFieldsFromFormsSchema();
};

const VitalsField = ({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-[12px] font-medium text-neutral-700">{field.label}</span>
    <span className="flex items-stretch overflow-hidden rounded-2xl border border-input-border-default focus-within:border-input-border-active">
      <input
        type="text"
        inputMode={field.inputMode ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={field.label}
        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-body-4 text-text-primary outline-none"
      />
      {field.unit ? (
        <span className="flex items-center bg-neutral-100 px-3 text-body-4 text-neutral-700">
          {field.unit}
        </span>
      ) : null}
    </span>
  </label>
);

const parseNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const FIELD_LIMITS: Partial<Record<keyof DraftVitals, { min?: number; max?: number }>> = {
  weightLbs: { min: 0, max: 2000 },
  tempF: { min: 80, max: 110 },
  heartRateBpm: { min: 0, max: 300 },
  respRateBpm: { min: 0, max: 150 },
  painScore: { min: 0, max: 10 },
  bcs: { min: 1, max: 9 },
};

const validateNumericField = (
  label: string,
  rawValue: string,
  bounds?: { min?: number; max?: number }
) => {
  if (!rawValue.trim()) return `${label} is required.`;
  const value = parseNumber(rawValue);
  if (value === undefined) return `${label} must be a number.`;
  if (bounds?.min !== undefined && value < bounds.min) {
    return `${label} must be at least ${bounds.min}.`;
  }
  if (bounds?.max !== undefined && value > bounds.max) {
    return `${label} must be ${bounds.max} or less.`;
  }
  return null;
};

const VitalRow = ({
  entry,
  resolveRecorderName,
}: {
  entry: Vitals;
  resolveRecorderName: (entry: Vitals) => string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-2 border-b border-card-border py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col leading-[120%]">
          <span className="text-[12px] font-medium text-pill-success-text">
            {formatStampDate(entry.recordedAt)}
          </span>
          <span className="text-body-4 font-medium text-text-primary">{entry.code}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-neutral-100 px-3 py-1 text-body-4 text-text-primary">
            {resolveRecorderName(entry)}
          </span>
          <CircleIconButton
            icon={
              open ? (
                <LuEyeOff size={16} aria-hidden="true" />
              ) : (
                <LuEye size={16} aria-hidden="true" />
              )
            }
            label={open ? `Hide ${entry.code}` : `View ${entry.code}`}
            variant="dark"
            onClick={() => setOpen((v) => !v)}
          />
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-2xl border border-card-border p-3 text-body-4 text-text-primary">
          <span>Weight: {entry.weightLbs ?? '-'} kg</span>
          <span>Temp: {entry.tempF ?? '-'} °F</span>
          <span>Heart rate: {entry.heartRateBpm ?? '-'} bpm</span>
          <span>Resp. rate: {entry.respRateBpm ?? '-'} bpm</span>
          <span>CRT: {entry.crtSec ?? '-'}</span>
          <span>MM: {entry.mucousMembrane ?? '-'}</span>
          <span>Pain: {entry.painScore ?? '-'} / 10</span>
          <span>BCS: {entry.bcs ?? '-'} / 9</span>
        </div>
      )}
    </li>
  );
};

/** Vitals tab: a "New vitals" form plus the recorded-vitals list. */
const VitalsForm = ({
  appointmentId,
  organisationId,
  encounterId,
  authorId,
  authorName,
  vitals,
}: VitalsFormProps) => {
  const addVitals = useAppointmentWorkspaceStore((s) => s.addVitals);
  const team = useTeamForPrimaryOrg();
  // Map every team-member id (practitioner id and `_id`) to a display name so a
  // hydrated vital that only carries a recorder id resolves to a real name.
  const recorderNamesById = useMemo(() => {
    const map = new Map<string, string>();
    (team ?? []).forEach((member) => {
      const name = member.name?.trim();
      if (!name) return;
      if (member.practionerId) map.set(member.practionerId, name);
      if (member._id) map.set(member._id, name);
    });
    return map;
  }, [team]);
  // Prefer a stored real name; otherwise resolve the recorder id against the
  // roster; fall back to whatever name was stored ("Clinician" when unknown).
  const resolveRecorderName = useCallback(
    (entry: Vitals) => {
      const stored = entry.recordedByName?.trim();
      if (stored && stored !== 'Clinician') return stored;
      const resolved = entry.recordedById ? recorderNamesById.get(entry.recordedById) : undefined;
      return resolved ?? stored ?? 'Clinician';
    },
    [recorderNamesById]
  );
  const [draft, setDraft] = useState<DraftVitals>(EMPTY_DRAFT);
  const [notes, setNotes] = useState('');
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateState, setTemplateState] = useState<{
    templates: TemplateLike[];
    error: string | null;
  }>({ templates: [], error: null });
  const [activeFields, setActiveFields] = useState<Field[]>(defaultVitalFieldsFromFormsSchema);
  const [creating, setCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof DraftVitals, string>>>({});

  useEffect(() => {
    listVitalsTemplates(organisationId)
      .then((items) => {
        setTemplateState({ templates: items, error: null });
      })
      .catch((error) => {
        console.error('Failed to load vitals templates:', error);
        setTemplateState({ templates: [], error: 'Unable to load vitals templates.' });
      });
  }, [organisationId]);

  const templateMatches = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    if (!query) return [];
    return templateState.templates.filter((template) =>
      template.name.toLowerCase().includes(query)
    );
  }, [templateQuery, templateState.templates]);

  const updateField = (key: keyof DraftVitals, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validateDraft = () => {
    const nextErrors: Partial<Record<keyof DraftVitals, string>> = {};
    (Object.keys(FIELD_LIMITS) as Array<keyof DraftVitals>).forEach((key) => {
      const field = FIELD_FALLBACKS[key];
      const error = validateNumericField(field.label, draft[key], FIELD_LIMITS[key]);
      if (error) nextErrors[key] = error;
    });
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateDraft()) {
      setSaveError('Please fix the highlighted vitals fields.');
      return;
    }
    const nextVitals = {
      weightLbs: parseNumber(draft.weightLbs),
      tempF: parseNumber(draft.tempF),
      heartRateBpm: parseNumber(draft.heartRateBpm),
      respRateBpm: parseNumber(draft.respRateBpm),
      crtSec: draft.crtSec || undefined,
      mucousMembrane: draft.mucousMembrane || undefined,
      painScore: parseNumber(draft.painScore),
      bcs: parseNumber(draft.bcs),
      notes: notes || undefined,
      // The recorder is always the logged-in clinician — no manual selection.
      recordedByName: authorName?.trim() || 'Clinician',
      recordedById: authorId,
      recordedAt: new Date().toISOString(),
    };
    setIsSaving(true);
    setSaveError(null);
    try {
      const savedVital = await saveVitalRecord(
        { organisationId, appointmentId, encounterId, authorId },
        nextVitals
      );
      addVitals(appointmentId, nextVitals, (savedVital as { id?: string } | undefined)?.id);
    } catch (error) {
      console.error('Failed to save vitals', error);
      setSaveError('Unable to save vitals. Please try again.');
      return;
    } finally {
      setIsSaving(false);
    }
    setDraft(EMPTY_DRAFT);
    setNotes('');
    setCreating(false);
  };

  const handleDiscard = () => {
    setDraft(EMPTY_DRAFT);
    setNotes('');
    setCreating(false);
  };

  if (!creating) {
    return (
      <div className="flex flex-col gap-3">
        {vitals.length === 0 ? (
          <p className="py-6 text-center text-body-4 text-text-secondary">
            No vitals recorded yet.
          </p>
        ) : (
          <ul className="rounded-2xl border border-card-border px-4">
            {vitals.map((entry) => (
              <VitalRow key={entry.id} entry={entry} resolveRecorderName={resolveRecorderName} />
            ))}
          </ul>
        )}
        <div className="flex justify-center">
          <Primary
            text="New Vital"
            icon={<span aria-hidden="true">+</span>}
            onClick={() => setCreating(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-body-2 font-bold text-text-primary">New vitals</h3>
      <div className="relative">
        <Search
          value={templateQuery}
          setSearch={setTemplateQuery}
          placeholder="Search vitals templates"
          label="Search vitals templates"
          className="w-full!"
        />
        {templateMatches.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
            {templateMatches.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFields(templateToVitalFields(template));
                    setTemplateQuery('');
                  }}
                  className="flex w-full items-center px-4 py-2 text-left text-body-4 text-text-primary hover:bg-neutral-100"
                >
                  {template.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {templateQuery.trim() && templateMatches.length === 0 && !templateState.error && (
          <p className="absolute z-20 mt-1 w-full rounded-2xl border border-card-border bg-neutral-0 px-4 py-3 text-body-4 text-text-secondary shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
            No vitals templates match this search.
          </p>
        )}
        {templateState.error && (
          <p className="mt-2 text-caption-1 text-danger-600">{templateState.error}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {activeFields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <VitalsField
              field={field}
              value={draft[field.key]}
              onChange={(value) => updateField(field.key, value)}
            />
            {fieldErrors[field.key] ? (
              <p className="text-caption-1 text-danger-600">{fieldErrors[field.key]}</p>
            ) : null}
          </div>
        ))}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-neutral-700">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-label="Vitals notes"
          rows={3}
          className="rounded-2xl border border-input-border-default px-4 py-2.5 text-body-4 text-text-primary outline-none focus:border-input-border-active"
        />
      </label>
      <div className="flex items-center justify-center gap-3">
        {saveError && <p className="text-caption-1 text-red-600">{saveError}</p>}
        <Primary
          text={isSaving ? 'Saving...' : 'Save vitals'}
          icon={<LuCheck aria-hidden="true" />}
          onClick={handleSave}
          isDisabled={isSaving}
        />
        <Secondary text="Discard" onClick={handleDiscard} />
      </div>
    </div>
  );
};

export default VitalsForm;
