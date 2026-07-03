import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import {
  FormsCategoryOptions,
  FormsProps,
  RequiredSignerOptions,
  FormsUsageOptions,
  getFormCategoryDisplayLabel,
} from '@/app/features/forms/types/forms';
import React, { useRef } from 'react';
import FormRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/FormRenderer';
import { useOrgStore } from '@/app/stores/orgStore';
import { Organisation } from '@yosemite-crew/types';
import { buildInitialValues } from '@/app/features/forms/pages/Forms/Sections/AddForm/reviewUtils';
import type { FormField } from '@/app/features/forms/types/forms';

/** Read a task block's authored value for a given taskBlockKey (defaultValue, else placeholder). */
const taskBlockValue = (block: FormField & { fields?: FormField[] }, key: string): string => {
  const field = (block.fields ?? []).find(
    (f) => (f.meta as { taskBlockKey?: string })?.taskBlockKey === key
  );
  if (!field) return '';
  const value = (field as FormField & { defaultValue?: unknown }).defaultValue;
  if (value !== undefined && value !== '') return String(value);
  return field.placeholder ?? '';
};

const labelForOption = (options: { label: string; value: string }[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? value;

/** Read-only summary of the task blocks authored in a Task Template. */
const TaskTemplateSummary = ({ schema }: { schema: FormField[] }) => {
  const group = schema.find(
    (field): field is FormField & { fields?: FormField[] } =>
      field.type === 'group' && Boolean((field.meta as { taskGroup?: boolean })?.taskGroup)
  );
  const blocks = (group?.fields ?? []).filter(
    (f): f is FormField & { fields?: FormField[] } => f.type === 'group'
  );
  if (blocks.length === 0) {
    return <p className="text-body-4 text-text-secondary">No tasks added yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {blocks.map((block, index) => {
        const categoryField = (block.fields ?? []).find(
          (f) => (f.meta as { taskBlockKey?: string })?.taskBlockKey === 'category'
        ) as (FormField & { options?: { label: string; value: string }[] }) | undefined;
        const repeatField = (block.fields ?? []).find(
          (f) => (f.meta as { taskBlockKey?: string })?.taskBlockKey === 'recurrence.type'
        ) as (FormField & { options?: { label: string; value: string }[] }) | undefined;
        const reminderField = (block.fields ?? []).find(
          (f) => (f.meta as { taskBlockKey?: string })?.taskBlockKey === 'reminderOffsetMinutes'
        ) as (FormField & { options?: { label: string; value: string }[] }) | undefined;
        const duration = taskBlockValue(block, 'durationDays');
        return (
          <li
            key={block.id}
            className="flex flex-col gap-1 rounded-2xl border border-card-border p-3"
          >
            <span className="text-body-3-emphasis text-text-primary">
              {taskBlockValue(block, 'name') || `Task ${index + 1}`}
            </span>
            <span className="text-caption-1 text-text-secondary">
              {labelForOption(categoryField?.options ?? [], taskBlockValue(block, 'category'))} ·{' '}
              {labelForOption(repeatField?.options ?? [], taskBlockValue(block, 'recurrence.type'))}
              {reminderField &&
                taskBlockValue(block, 'reminderOffsetMinutes') &&
                ` · ${labelForOption(reminderField.options ?? [], taskBlockValue(block, 'reminderOffsetMinutes'))}`}
              {duration && ` · ${duration} day${duration === '1' ? '' : 's'}`}
            </span>
            {taskBlockValue(block, 'additionalNotes') && (
              <span className="text-caption-1 text-text-secondary">
                {taskBlockValue(block, 'additionalNotes')}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};

type ReviewProps = {
  formData: FormsProps;
  onPublish: () => void;
  onSaveDraft: () => void;
  serviceOptions: { label: string; value: string; badge?: string }[];
  loading?: boolean;
  isEditing?: boolean;
};

const baseDetailsFields = [
  { label: 'Form name', key: 'name', type: 'text' },
  { label: 'Description', key: 'description', type: 'text' },
  { label: 'Signed by', key: 'requiredSigner', type: 'dropdown', options: RequiredSignerOptions },
];

const Review = ({
  formData,
  onPublish,
  onSaveDraft,
  serviceOptions,
  loading = false,
  isEditing = false,
}: ReviewProps) => {
  const orgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE as
    | Organisation['type']
    | undefined;
  const effectiveOrgType = orgTypeOverride || orgType;
  const detailsFields = React.useMemo(() => {
    const fields = [
      baseDetailsFields[0],
      baseDetailsFields[1],
      {
        label: 'Category',
        key: 'category',
        type: 'dropdown',
        options: FormsCategoryOptions.map((category) => ({
          label: getFormCategoryDisplayLabel(category, effectiveOrgType),
          value: category,
        })),
      },
    ];
    if (formData.templateSource !== 'YC_LIBRARY') {
      fields.push(baseDetailsFields[2]);
    }
    return fields;
  }, [effectiveOrgType, formData.templateSource]);
  const UsageFields = React.useMemo(
    () => [
      {
        label: 'Visibility type',
        key: 'usage',
        type: 'dropdown',
        options: FormsUsageOptions,
      },
      {
        label: 'Service',
        key: 'services',
        type: 'multiSelect',
        options: serviceOptions,
      },
      {
        label: 'Species',
        key: 'species',
        type: 'multiSelect',
        options: ['Canine', 'Feline', 'Equine'],
      },
    ],
    [serviceOptions]
  );

  const [values, setValues] = React.useState<Record<string, any>>(() =>
    buildInitialValues(formData.schema ?? [])
  );
  const schemaKey = JSON.stringify(formData.schema ?? []);
  const prevSchemaKeyRef = useRef(schemaKey);
  if (prevSchemaKeyRef.current !== schemaKey) {
    prevSchemaKeyRef.current = schemaKey;
    setValues(buildInitialValues(formData.schema ?? []));
  }

  const handleValueChange = (id: string, value: any) => {
    setValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <EditableAccordion
          title="Form details"
          fields={detailsFields}
          data={formData}
          defaultOpen={true}
          showEditIcon={false}
          readOnly
        />
        <EditableAccordion
          title="Usage & visibility"
          fields={UsageFields}
          data={formData}
          defaultOpen={true}
          showEditIcon={false}
          readOnly
        />
        {formData.category === 'Task Template' ? (
          <Accordion title="Tasks" defaultOpen showEditIcon={false} isEditing={true}>
            <TaskTemplateSummary schema={formData.schema ?? []} />
          </Accordion>
        ) : (
          (formData.schema?.length ?? 0) > 0 && (
            <Accordion title="Form" defaultOpen showEditIcon={false} isEditing={true}>
              <FormRenderer
                fields={formData.schema ?? []}
                values={values}
                onChange={handleValueChange}
                readOnly
              />
            </Accordion>
          )
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 px-3">
        <Primary
          href="#"
          text={isEditing ? 'Update & publish' : 'Publish template'}
          className="w-full max-h-12! text-lg! tracking-[-0.36px]!"
          onClick={onPublish}
          isDisabled={loading}
        />
        <Secondary
          href="#"
          text={isEditing ? 'Update draft' : 'Save as draft'}
          className="w-full max-h-12! text-lg! tracking-[-0.36px]!"
          onClick={onSaveDraft}
          isDisabled={loading}
        />
      </div>
    </div>
  );
};

export default Review;
