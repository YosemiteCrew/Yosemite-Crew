'use client';

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import EditableAccordion, {
  type FieldConfig,
} from '@/app/ui/primitives/Accordion/EditableAccordion';
import Input, { Textarea } from '@/app/ui/Input';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Text from '@/app/ui/Text';
import { useHasPermission } from '@/app/hooks/usePermissions';
import {
  createPracticeProfileField,
  deactivatePracticeProfileField,
  getPracticeProfileFields,
  savePracticeProfileFieldValues,
  type PracticeProfileEntityType,
  type PracticeProfileField,
  type PracticeProfileFieldType,
} from '@/app/features/companions/services/practiceProfileFieldsService';

type PracticeProfileFieldsProps = {
  entityType: PracticeProfileEntityType;
  entityId: string;
};

const TYPE_OPTIONS = [
  { label: 'Text', value: 'TEXT' },
  { label: 'Number', value: 'NUMBER' },
  { label: 'Date', value: 'DATE' },
  { label: 'Yes or no', value: 'BOOLEAN' },
  { label: 'Choice list', value: 'SELECT' },
];

const EDITOR_TYPE: Record<PracticeProfileFieldType, string> = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'checkbox',
  SELECT: 'select',
};

const displayValue = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return '';
};

const toStoredValue = (field: PracticeProfileField, value: unknown) => {
  if (field.type === 'NUMBER') return value === '' ? null : Number(value);
  if (field.type === 'BOOLEAN') return value === true || value === 'true';
  return value;
};

const isBlank = (value: unknown) => value === null || value === undefined || value === '';

type ChangedEntry = { fieldId: string; value: unknown } | null;

const UNCHANGED: ChangedEntry = null;

const isAnsweredBoolean = (value: unknown) => value === true || value === false;

/**
 * The checkbox is binary, so a Yes/No field that was never answered always
 * reads back as unchecked. Writing that straight through would answer every
 * question on the practice's behalf the first time anyone saved anything, and a
 * stored `false` could never be cleared again. So each field reports only what
 * really moved. A null value here is a real answer that clears the stored
 * value; anything UNCHANGED is left out of the request entirely.
 */
const toChangedEntry = (field: PracticeProfileField, next: unknown): ChangedEntry => {
  const stored = field.value;
  const value = toStoredValue(field, next);

  if (field.type === 'BOOLEAN' && !isAnsweredBoolean(stored)) {
    return value === true ? { fieldId: field.id, value } : UNCHANGED;
  }
  if (isBlank(value)) {
    return isBlank(stored) ? UNCHANGED : { fieldId: field.id, value: null };
  }
  if (isBlank(stored)) return { fieldId: field.id, value };
  return stored === value ? UNCHANGED : { fieldId: field.id, value };
};

const changedEntries = (fields: PracticeProfileField[], nextValues: Record<string, unknown>) =>
  fields
    .map((field) => toChangedEntry(field, nextValues[field.fieldKey]))
    .filter((entry): entry is { fieldId: string; value: unknown } => entry !== UNCHANGED);

type State = {
  fields: PracticeProfileField[];
  // Which profile the loaded fields belong to. The render guard compares this
  // against the current profile, so a failed load cannot leave the previous
  // profile's values on screen under this one's name - where a save would
  // copy them onto the wrong record. It is claimed in the same transition that
  // replaces the fields, never on its own.
  fieldsEntityId: string;
  loading: boolean;
  error: string;
  isManaging: boolean;
  draftLabel: string;
  draftType: PracticeProfileFieldType;
  draftOptions: string;
};

type Action =
  | { type: 'loadSucceeded'; entityId: string; fields: PracticeProfileField[] }
  | { type: 'loadFailed'; entityId: string }
  | { type: 'valuesSaved'; stored: Map<string, unknown> }
  | { type: 'fieldAdded'; field: PracticeProfileField }
  | { type: 'fieldRemoved'; fieldId: string }
  | { type: 'managingChanged'; isManaging: boolean }
  | { type: 'draftLabelChanged'; label: string }
  | { type: 'draftTypeChanged'; fieldType: PracticeProfileFieldType }
  | { type: 'draftOptionsChanged'; options: string }
  | { type: 'failed'; error: string };

// The blank form a new field starts from. Reused as a reset so "open an empty
// form" and "start the next field from scratch" cannot drift apart.
const BLANK_DRAFT = {
  draftLabel: '',
  draftType: 'TEXT' as PracticeProfileFieldType,
  draftOptions: '',
};

const initialState: State = {
  fields: [],
  fieldsEntityId: '',
  loading: true,
  error: '',
  isManaging: false,
  ...BLANK_DRAFT,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'loadSucceeded':
      return {
        ...state,
        fields: action.fields,
        fieldsEntityId: action.entityId,
        loading: false,
        error: '',
      };
    // The identity is claimed even on failure: the fields are cleared, so
    // nothing from the previous profile can render, and the error replaces the
    // spinner instead of leaving it turning for ever.
    case 'loadFailed':
      return {
        ...state,
        fields: [],
        fieldsEntityId: action.entityId,
        loading: false,
        error: 'Practice fields could not be loaded.',
      };
    case 'valuesSaved':
      return {
        ...state,
        fields: state.fields.map((field) =>
          action.stored.has(field.id)
            ? { ...field, value: action.stored.get(field.id) ?? null }
            : field
        ),
        error: '',
      };
    // Adding a field closes the modal and blanks the form together, so the next
    // one starts empty instead of showing what was just submitted.
    case 'fieldAdded':
      return {
        ...state,
        fields: [...state.fields, { ...action.field, value: null }],
        error: '',
        isManaging: false,
        ...BLANK_DRAFT,
      };
    case 'fieldRemoved':
      return {
        ...state,
        fields: state.fields.filter((field) => field.id !== action.fieldId),
        error: '',
      };
    case 'managingChanged':
      return { ...state, isManaging: action.isManaging };
    case 'draftLabelChanged':
      return { ...state, draftLabel: action.label };
    case 'draftTypeChanged':
      return { ...state, draftType: action.fieldType };
    case 'draftOptionsChanged':
      return { ...state, draftOptions: action.options };
    case 'failed':
      return { ...state, error: action.error };
    default:
      return state;
  }
};

const PracticeProfileFields = ({ entityType, entityId }: PracticeProfileFieldsProps) => {
  const canEdit = useHasPermission('companions:edit:any');
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    fields,
    fieldsEntityId,
    loading,
    error,
    isManaging,
    draftLabel,
    draftType,
    draftOptions,
  } = state;

  useEffect(() => {
    if (!entityId) return;
    let isCurrent = true;
    void getPracticeProfileFields(entityType, entityId)
      .then((nextFields) => {
        if (!isCurrent) return;
        dispatch({ type: 'loadSucceeded', entityId, fields: nextFields });
      })
      .catch(() => {
        if (!isCurrent) return;
        dispatch({ type: 'loadFailed', entityId });
      });
    return () => {
      isCurrent = false;
    };
  }, [entityId, entityType]);

  const fieldConfigs = useMemo<FieldConfig[]>(
    () =>
      fields.map((field) => ({
        key: field.fieldKey,
        label: field.label,
        type: EDITOR_TYPE[field.type],
        options: field.options,
      })),
    [fields]
  );
  const values = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.fieldKey, displayValue(field.value)])),
    [fields]
  );

  const handleSave = useCallback(
    async (nextValues: Record<string, unknown>) => {
      const changed = changedEntries(fields, nextValues);
      if (changed.length === 0) return;
      await savePracticeProfileFieldValues(entityType, entityId, changed);
      dispatch({
        type: 'valuesSaved',
        stored: new Map(changed.map((entry) => [entry.fieldId, entry.value])),
      });
    },
    [entityId, entityType, fields]
  );

  const handleCreate = async () => {
    const normalizedOptions =
      draftType === 'SELECT'
        ? draftOptions.split('\n').flatMap((option) => {
            const trimmed = option.trim();
            return trimmed ? [trimmed] : [];
          })
        : [];
    try {
      const field = await createPracticeProfileField(entityType, {
        label: draftLabel,
        type: draftType,
        options: normalizedOptions,
      });
      dispatch({ type: 'fieldAdded', field });
    } catch {
      dispatch({
        type: 'failed',
        error: 'This field could not be added. Check the label and choices, then try again.',
      });
    }
  };

  const handleDeactivate = async (field: PracticeProfileField) => {
    try {
      await deactivatePracticeProfileField(field.id);
      dispatch({ type: 'fieldRemoved', fieldId: field.id });
    } catch {
      dispatch({ type: 'failed', error: 'This field could not be removed. Please try again.' });
    }
  };

  if (!entityId) return null;

  return (
    <div className="flex w-full flex-col gap-3">
      {error ? (
        <Text role="alert" variant="caption-1" className="text-[var(--danger-text)]">
          {error}
        </Text>
      ) : null}
      {loading || fieldsEntityId !== entityId ? (
        <Text role="status" variant="caption-1" className="text-[var(--ink-muted)]">
          Loading practice fields…
        </Text>
      ) : (
        <EditableAccordion
          title="Practice fields"
          fields={fieldConfigs}
          data={values}
          defaultOpen={true}
          showEditIcon={canEdit}
          readOnly={!canEdit || fieldConfigs.length === 0}
          rightElement={
            canEdit ? (
              <Secondary
                href="#"
                size="compact"
                text="Add field"
                onClick={() => dispatch({ type: 'managingChanged', isManaging: true })}
              />
            ) : undefined
          }
          onSave={handleSave}
        />
      )}
      <Modal
        showModal={isManaging}
        setShowModal={(next) =>
          dispatch({
            type: 'managingChanged',
            isManaging: typeof next === 'function' ? next(isManaging) : next,
          })
        }
        variant="centered"
        size="sm"
        aria-labelledby="practice-profile-fields-title"
      >
        <div className="flex flex-col gap-5">
          <ModalHeader
            title="Manage practice fields"
            titleId="practice-profile-fields-title"
            onClose={() => dispatch({ type: 'managingChanged', isManaging: false })}
          />
          {fields.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Text variant="body-4-emphasis">Current fields</Text>
              {fields.map((field) => (
                <div key={field.id} className="flex items-center justify-between gap-3">
                  <Text variant="body-4">{field.label}</Text>
                  <Secondary
                    href="#"
                    danger
                    size="compact"
                    text={`Remove ${field.label}`}
                    onClick={() => void handleDeactivate(field)}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <label
            className="flex flex-col gap-2 text-body-4-emphasis text-text-primary"
            htmlFor="practice-field-label"
          >
            Field name
            <Input
              id="practice-field-label"
              placeholder="For example, preferred contact time"
              value={draftLabel}
              maxLength={80}
              onChange={(event) =>
                dispatch({ type: 'draftLabelChanged', label: event.target.value })
              }
            />
          </label>
          <div className="flex flex-col gap-2">
            <Text variant="body-4-emphasis">Field type</Text>
            <LabelDropdown
              placeholder="Choose a type"
              defaultOption={draftType}
              options={TYPE_OPTIONS}
              onSelect={(option) =>
                dispatch({
                  type: 'draftTypeChanged',
                  fieldType: option.value as PracticeProfileFieldType,
                })
              }
            />
          </div>
          {draftType === 'SELECT' ? (
            <label
              className="flex flex-col gap-2 text-body-4-emphasis text-text-primary"
              htmlFor="practice-field-options"
            >
              Choices, one per line
              <Textarea
                id="practice-field-options"
                placeholder={'Morning\nAfternoon\nEvening'}
                value={draftOptions}
                maxLength={4000}
                onChange={(event) =>
                  dispatch({ type: 'draftOptionsChanged', options: event.target.value })
                }
              />
            </label>
          ) : null}
          <div className="flex justify-end gap-3">
            <Secondary
              href="#"
              text="Cancel"
              onClick={() => dispatch({ type: 'managingChanged', isManaging: false })}
            />
            <Primary href="#" text="Add field" onClick={handleCreate} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PracticeProfileFields;
