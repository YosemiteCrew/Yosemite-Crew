import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import {
  FormField,
  FormsCategoryOptions,
  FormsProps,
  RequiredSignerOptions,
  FormsUsageOptions,
  getFormCategoryDisplayLabel,
} from '@/app/features/forms/types/forms';
import React, { useEffect } from 'react';
import FormRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/FormRenderer';
import { useOrgStore } from '@/app/stores/orgStore';
import { Organisation } from '@yosemite-crew/types';

type ReviewProps = {
  formData: FormsProps;
  onPublish: () => void;
  onSaveDraft: () => void;
  serviceOptions: { label: string; value: string }[];
  loading?: boolean;
  isEditing?: boolean;
};

const baseDetailsFields = [
  { label: 'Form name', key: 'name', type: 'text' },
  { label: 'Description', key: 'description', type: 'text' },
  { label: 'Signed by', key: 'requiredSigner', type: 'dropdown', options: RequiredSignerOptions },
];

export const buildInitialValues = (fields: FormField[]): Record<string, any> => {
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
      } else if (field.type === 'boolean') {
        acc[field.id] = defaultValue ?? false;
      } else if (field.type === 'date') {
        acc[field.id] = defaultValue ?? '';
      } else if (field.type === 'number') {
        acc[field.id] = defaultValue ?? field.placeholder ?? '';
      } else {
        acc[field.id] = defaultValue ?? field.placeholder ?? '';
      }
    });
  };
  walk(fields);
  return acc;
};

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
  const detailsFields = React.useMemo(
    () => [
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
      baseDetailsFields[2],
    ],
    [effectiveOrgType]
  );
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
        options: ['Dog', 'Cat', 'Horse'],
      },
    ],
    [serviceOptions]
  );

  const [values, setValues] = React.useState<Record<string, any>>(() =>
    buildInitialValues(formData.schema ?? [])
  );

  useEffect(() => {
    setValues(buildInitialValues(formData.schema ?? []));
  }, [formData.schema]);

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
        {(formData.schema?.length ?? 0) > 0 && (
          <Accordion title="Form" defaultOpen showEditIcon={false} isEditing={true}>
            <FormRenderer
              fields={formData.schema ?? []}
              values={values}
              onChange={handleValueChange}
              readOnly
            />
          </Accordion>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 px-3">
        <Primary
          href="#"
          text={isEditing ? 'Update & publish' : 'Publish template'}
          className="w-full max-h-12! text-lg! tracking-wide!"
          onClick={onPublish}
          isDisabled={loading}
        />
        <Secondary
          href="#"
          text={isEditing ? 'Update draft' : 'Save as draft'}
          className="w-full max-h-12! text-lg! tracking-wide!"
          onClick={onSaveDraft}
          isDisabled={loading}
        />
      </div>
    </div>
  );
};

export default Review;
