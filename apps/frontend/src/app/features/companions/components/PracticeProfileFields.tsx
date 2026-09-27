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

const PracticeProfileFields = ({ entityType, entityId }: PracticeProfileFieldsProps) => {
  const canEdit = useHasPermission('companions:edit:any');
  const [fields, setFields] = useState<PracticeProfileField[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadedEntityId, setLoadedEntityId] = useState('');
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
        setError('');
      })
      .catch(() => {
        if (isCurrent) setError('Practice fields could not be loaded.');
      })
      .finally(() => {
        if (!isCurrent) return;
        setLoading(false);
        setLoadedEntityId(entityId);
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
      await savePracticeProfileFieldValues(
        entityType,
        entityId,
        fields.map((field) => ({
          fieldId: field.id,
          value: toStoredValue(field, nextValues[field.fieldKey]),
        }))
      );
      setFields((current) =>
        current.map((field) => ({
          ...field,
          value: toStoredValue(field, nextValues[field.fieldKey]),
        }))
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
      {loading || loadedEntityId !== entityId ? (
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
          readOnly={fieldConfigs.length === 0}
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
