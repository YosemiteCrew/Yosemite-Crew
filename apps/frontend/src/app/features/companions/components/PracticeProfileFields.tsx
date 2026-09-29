'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

const PracticeProfileFields = ({ entityType, entityId }: PracticeProfileFieldsProps) => {
  const canEdit = useHasPermission('companions:edit:any');
  const [fields, setFields] = useState<PracticeProfileField[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // Which profile the loaded fields belong to. The render guard compares this
  // against the current profile, so a failed load cannot leave the previous
  // profile's values on screen under this one's name - where a save would
  // copy them onto the wrong record.
  const [fieldsEntityId, setFieldsEntityId] = useState('');
  const [isManaging, setIsManaging] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<PracticeProfileFieldType>('TEXT');
  const [options, setOptions] = useState('');

  useEffect(() => {
    if (!entityId) return;
    let isCurrent = true;
    void getPracticeProfileFields(entityType, entityId)
      .then((nextFields) => {
        if (!isCurrent) return;
        setFields(nextFields);
        setFieldsEntityId(entityId);
        setError('');
      })
      .catch(() => {
        if (!isCurrent) return;
        // Claim the identity anyway: the fields are cleared, so nothing from
        // the previous profile can render, and the error replaces the spinner
        // instead of leaving it turning for ever.
        setFields([]);
        setFieldsEntityId(entityId);
        setError('Practice fields could not be loaded.');
      })
      .finally(() => {
        if (!isCurrent) return;
        setLoading(false);
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
      const stored = new Map(changed.map((entry) => [entry.fieldId, entry.value]));
      setFields((current) =>
        current.map((field) =>
          stored.has(field.id) ? { ...field, value: stored.get(field.id) ?? null } : field
        )
      );
      setError('');
    },
    [entityId, entityType, fields]
  );

  const handleCreate = async () => {
    const normalizedOptions =
      type === 'SELECT'
        ? options
            .split('\n')
            .map((option) => option.trim())
            .filter(Boolean)
        : [];
    try {
      const field = await createPracticeProfileField(entityType, {
        label,
        type,
        options: normalizedOptions,
      });
      setFields((current) => [...current, { ...field, value: null }]);
      setLabel('');
      setOptions('');
      setType('TEXT');
      setIsManaging(false);
      setError('');
    } catch {
      setError('This field could not be added. Check the label and choices, then try again.');
    }
  };

  const handleDeactivate = async (field: PracticeProfileField) => {
    try {
      await deactivatePracticeProfileField(field.id);
      setFields((current) => current.filter((item) => item.id !== field.id));
      setError('');
    } catch {
      setError('This field could not be removed. Please try again.');
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
                onClick={() => setIsManaging(true)}
              />
            ) : undefined
          }
          onSave={handleSave}
        />
      )}
      <Modal
        showModal={isManaging}
        setShowModal={setIsManaging}
        variant="centered"
        size="sm"
        aria-labelledby="practice-profile-fields-title"
      >
        <div className="flex flex-col gap-5">
          <ModalHeader
            title="Manage practice fields"
            titleId="practice-profile-fields-title"
            onClose={() => setIsManaging(false)}
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
              value={label}
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2">
            <Text variant="body-4-emphasis">Field type</Text>
            <LabelDropdown
              placeholder="Choose a type"
              defaultOption={type}
              options={TYPE_OPTIONS}
              onSelect={(option) => setType(option.value as PracticeProfileFieldType)}
            />
          </div>
          {type === 'SELECT' ? (
            <label
              className="flex flex-col gap-2 text-body-4-emphasis text-text-primary"
              htmlFor="practice-field-options"
            >
              Choices, one per line
              <Textarea
                id="practice-field-options"
                placeholder={'Morning\nAfternoon\nEvening'}
                value={options}
                maxLength={4000}
                onChange={(event) => setOptions(event.target.value)}
              />
            </label>
          ) : null}
          <div className="flex justify-end gap-3">
            <Secondary href="#" text="Cancel" onClick={() => setIsManaging(false)} />
            <Primary href="#" text="Add field" onClick={handleCreate} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PracticeProfileFields;
