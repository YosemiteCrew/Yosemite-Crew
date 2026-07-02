import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import Modal from '@/app/ui/overlays/Modal';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import {
  FormsCategoryOptions,
  FormField,
  FormsProps,
  RequiredSignerOptions,
  FormsUsageOptions,
  getFormCategoryDisplayLabel,
} from '@/app/features/forms/types/forms';
import React from 'react';
import { archiveForm, publishForm, unpublishForm } from '@/app/features/forms/services/formService';
import {
  archiveTemplateForm,
  publishTemplateForm,
  unpublishTemplateForm,
} from '@/app/features/forms/services/templateFormsService';
import FormRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/FormRenderer';
import Close from '@/app/ui/primitives/Icons/Close';
import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { Icon } from '@iconify/react';
import { useOrgStore } from '@/app/stores/orgStore';
import { Organisation } from '@yosemite-crew/types';

const taskBlockValue = (block: FormField & { fields?: FormField[] }, key: string): string => {
  const field = (block.fields ?? []).find(
    (item) => (item.meta as { taskBlockKey?: string })?.taskBlockKey === key
  );
  if (!field && key === 'additionalNotes') {
    return taskBlockValue(block, 'description');
  }
  if (!field) return '';
  const value = (field as FormField & { defaultValue?: unknown }).defaultValue;
  if (value !== undefined && value !== '') return String(value);
  return field.placeholder ?? '';
};

const labelForOption = (options: { label: string; value: string }[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? value;

const TaskTemplateSummary = ({ schema }: { schema: FormField[] }) => {
  const group = schema.find(
    (field): field is FormField & { fields?: FormField[] } =>
      field.type === 'group' && Boolean((field.meta as { taskGroup?: boolean })?.taskGroup)
  );
  const blocks = (group?.fields ?? []).filter(
    (field): field is FormField & { fields?: FormField[] } => field.type === 'group'
  );

  if (blocks.length === 0) {
    return <p className="text-body-4 text-text-secondary">No tasks added yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {blocks.map((block, index) => {
        const categoryField = (block.fields ?? []).find(
          (field) => (field.meta as { taskBlockKey?: string })?.taskBlockKey === 'category'
        ) as (FormField & { options?: { label: string; value: string }[] }) | undefined;
        const repeatField = (block.fields ?? []).find(
          (field) => (field.meta as { taskBlockKey?: string })?.taskBlockKey === 'recurrence.type'
        ) as (FormField & { options?: { label: string; value: string }[] }) | undefined;
        const reminderField = (block.fields ?? []).find(
          (field) =>
            (field.meta as { taskBlockKey?: string })?.taskBlockKey === 'reminderOffsetMinutes'
        ) as (FormField & { options?: { label: string; value: string }[] }) | undefined;
        const duration = taskBlockValue(block, 'durationDays');
        const instructions = taskBlockValue(block, 'additionalNotes');

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
            {instructions && (
              <span className="text-caption-1 text-text-secondary">{instructions}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const buildPreviewValues = (fields: FormField[]): Record<string, any> => {
  const acc: Record<string, any> = {};
  const walk = (items: FormField[]) => {
    items.forEach((field) => {
      if (field.type === 'group') {
        walk(field.fields ?? []);
        return;
      }
      // Check for defaultValue first (for readonly fields from inventory)
      const defaultValue = (field as any).defaultValue;

      if (field.type === 'checkbox') {
        acc[field.id] = defaultValue ?? [];
        return;
      }
      if (field.type === 'boolean') {
        acc[field.id] = defaultValue ?? false;
        return;
      }
      if (field.type === 'date') {
        acc[field.id] = defaultValue ?? '';
        return;
      }
      if (field.type === 'number') {
        acc[field.id] = defaultValue ?? field.placeholder ?? '';
        return;
      }
      acc[field.id] = defaultValue ?? field.placeholder ?? '';
    });
  };
  walk(fields);
  return acc;
};

type FormInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeForm: FormsProps;
  onEdit: (form: FormsProps) => void;
  serviceOptions: { label: string; value: string; badge?: string }[];
  canEdit?: boolean;
};

const baseDetailsFields = [
  { label: 'Form name', key: 'name', type: 'text' },
  { label: 'Description', key: 'description', type: 'text' },
  { label: 'Signed by', key: 'requiredSigner', type: 'dropdown', options: RequiredSignerOptions },
];

const UsageFields = [
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
  },
  {
    label: 'Species',
    key: 'species',
    type: 'multiSelect',
    options: ['Canine', 'Feline', 'Equine'],
  },
];

const getModalTitle = (activeForm: FormsProps, canMutateLegacyForm: boolean) => {
  if (activeForm.isTemplateBacked) return 'View template';
  if (canMutateLegacyForm) return 'Edit form';
  return 'View form';
};

const FormInfo = ({
  showModal,
  setShowModal,
  activeForm,
  onEdit,
  serviceOptions,
  canEdit = true,
}: FormInfoProps) => {
  const orgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE as
    | Organisation['type']
    | undefined;
  const effectiveOrgType = orgTypeOverride || orgType;
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  const [publishLoading, setPublishLoading] = React.useState(false);
  const [unpublishLoading, setUnpublishLoading] = React.useState(false);
  const [archiveLoading, setArchiveLoading] = React.useState(false);
  const actionLoading = publishLoading || unpublishLoading || archiveLoading;
  const canEditTemplateStructure = canEdit;
  const canMutateTemplateState = canEdit && Boolean(activeForm._id);
  const modalTitle = getModalTitle(activeForm, canEditTemplateStructure);
  const usageData = React.useMemo(
    () => ({
      ...activeForm,
      templateSource: activeForm.templateSource === 'YC_LIBRARY' ? 'YC_LIBRARY' : 'CUSTOM',
    }),
    [activeForm]
  );
  const detailsData = React.useMemo(
    () => ({
      ...activeForm,
      templateSource: activeForm.templateSource === 'YC_LIBRARY' ? 'YC_LIBRARY' : 'CUSTOM',
    }),
    [activeForm]
  );
  const detailsFields = React.useMemo(() => {
    const fields = [
      baseDetailsFields[0],
      baseDetailsFields[1],
      {
        label: 'Template Source',
        key: 'templateSource',
        type: 'dropdown',
        options: [
          { label: 'YC default (locked structure)', value: 'YC_LIBRARY' },
          { label: 'Custom', value: 'CUSTOM' },
        ],
      },
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
    if (activeForm.templateSource !== 'YC_LIBRARY') {
      fields.push(baseDetailsFields[2]);
    }
    return fields;
  }, [activeForm.templateSource, effectiveOrgType]);

  const showActionError = (message: string) =>
    showErrorTost({
      message,
      errortext: 'Error',
      iconElement: (
        <Icon
          icon="solar:danger-triangle-bold"
          width="20"
          height="20"
          color="var(--color-danger-600)"
        />
      ),
      className: 'errofoundbg',
    });

  const handlePublish = async () => {
    if (!activeForm._id) return;
    setPublishLoading(true);
    try {
      if (activeForm.isTemplateBacked) {
        if (!primaryOrgId) throw new Error('No primary organisation selected');
        await publishTemplateForm(activeForm, primaryOrgId);
      } else {
        await publishForm(activeForm._id);
      }
      setShowModal(false);
    } catch (err: any) {
      console.error('Failed to publish form', err);
      showActionError(err?.response?.data?.message || err?.message || 'Unable to publish form');
    } finally {
      setPublishLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!activeForm._id) return;
    setUnpublishLoading(true);
    try {
      if (activeForm.isTemplateBacked) {
        if (!primaryOrgId) throw new Error('No primary organisation selected');
        await unpublishTemplateForm(activeForm, primaryOrgId);
      } else {
        await unpublishForm(activeForm._id);
      }
      setShowModal(false);
    } catch (err: any) {
      console.error('Failed to unpublish form', err);
      showActionError(err?.response?.data?.message || err?.message || 'Unable to unpublish form');
    } finally {
      setUnpublishLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!activeForm._id) return;
    setArchiveLoading(true);
    try {
      if (activeForm.isTemplateBacked) {
        if (!primaryOrgId) throw new Error('No primary organisation selected');
        await archiveTemplateForm(activeForm, primaryOrgId);
      } else {
        await archiveForm(activeForm._id);
      }
      setShowModal(false);
    } catch (err: any) {
      console.error('Failed to archive form', err);
      showActionError(err?.response?.data?.message || err?.message || 'Unable to archive form');
    } finally {
      setArchiveLoading(false);
    }
  };

  const renderActions = () => {
    switch (activeForm.status) {
      case 'Published':
        return (
          <div className="grid grid-cols-2 gap-3">
            <Secondary
              href="#"
              text={unpublishLoading ? 'Unpublishing...' : 'Unpublish'}
              onClick={handleUnpublish}
              className="h-12! text-[16px]!"
              isDisabled={unpublishLoading || publishLoading || archiveLoading}
            />
            <Secondary
              href="#"
              text={archiveLoading ? 'Archiving...' : 'Archive'}
              onClick={handleArchive}
              className="h-12! text-[16px]!"
              isDisabled={publishLoading || unpublishLoading || archiveLoading}
            />
          </div>
        );
      case 'Archived':
        return (
          <div className="grid grid-cols-2 gap-3">
            <Secondary
              href="#"
              text={unpublishLoading ? 'Moving...' : 'Move to draft'}
              onClick={handleUnpublish}
              className="h-12! text-[16px]!"
              isDisabled={publishLoading || unpublishLoading || archiveLoading}
            />
            <Primary
              href="#"
              text={publishLoading ? 'Publishing...' : 'Publish'}
              onClick={handlePublish}
              className="h-12! text-[16px]!"
              isDisabled={publishLoading || unpublishLoading || archiveLoading}
            />
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-2 gap-3">
            <Primary
              href="#"
              text={publishLoading ? 'Publishing...' : 'Publish'}
              onClick={handlePublish}
              className="h-12! text-[16px]!"
              isDisabled={publishLoading || unpublishLoading || archiveLoading}
            />
            <Secondary
              href="#"
              text={archiveLoading ? 'Archiving...' : 'Archive'}
              onClick={handleArchive}
              className="h-12! text-[16px]!"
              isDisabled={publishLoading || unpublishLoading || archiveLoading}
            />
          </div>
        );
    }
  };

  return (
    <Modal
      key={activeForm._id || activeForm.name}
      showModal={showModal}
      setShowModal={setShowModal}
    >
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">{modalTitle}</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto pr-1 scrollbar-hidden">
          <div className="flex flex-col gap-6">
            <EditableAccordion
              key={`details-${activeForm._id || activeForm.name}`}
              title="Form details"
              fields={detailsFields}
              data={detailsData}
              defaultOpen={true}
              showEditIcon={false}
              readOnly
            />
            <EditableAccordion
              key={`usage-${activeForm._id || activeForm.name}`}
              title="Usage & visibility"
              fields={[
                ...UsageFields.slice(0, 1),
                { ...UsageFields[1], options: serviceOptions },
                ...UsageFields.slice(2),
              ]}
              data={usageData}
              defaultOpen={true}
              showEditIcon={false}
              readOnly
            />
            {(activeForm.schema?.length ?? 0) > 0 &&
              (activeForm.category === 'Task Template' ? (
                <Accordion title="Tasks" defaultOpen showEditIcon={false} isEditing={true}>
                  <TaskTemplateSummary schema={activeForm.schema ?? []} />
                </Accordion>
              ) : (
                <Accordion title="Form preview" defaultOpen showEditIcon={false} isEditing={true}>
                  <FormRenderer
                    fields={activeForm.schema ?? []}
                    values={buildPreviewValues(activeForm.schema ?? [])}
                    onChange={() => {}}
                    readOnly
                  />
                </Accordion>
              ))}
          </div>
          <div className="flex flex-col gap-3 px-3 pb-3">
            {canMutateTemplateState && renderActions()}
            {canEditTemplateStructure ? (
              <Secondary
                href="#"
                text="Edit form"
                onClick={() => {
                  setShowModal(false);
                  onEdit(activeForm);
                }}
                className="h-12! text-[16px]!"
                isDisabled={actionLoading}
              />
            ) : (
              <Secondary
                href="#"
                text="Close"
                onClick={() => setShowModal(false)}
                className="h-12! text-[16px]!"
              />
            )}
          </div>
        </div>
        {ErrorTostPopup}
      </div>
    </Modal>
  );
};

export default FormInfo;
