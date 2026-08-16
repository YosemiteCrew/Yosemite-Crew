import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import {
  FormsCategoryOptions,
  FormsProps,
  FormsUsageOptions,
  getFormCategoryDisplayLabel,
} from '@/app/features/forms/types/forms';
import React from 'react';
import FormRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/FormRenderer';
import { useOrgStore } from '@/app/stores/orgStore';
import { Organisation } from '@yosemite-crew/types';
import { buildInitialValues } from '@/app/features/forms/pages/Forms/Sections/AddForm/reviewUtils';
import { TaskTemplateSummary } from '@/app/features/forms/pages/Forms/Sections/taskTemplateSummary';
import { baseDetailsFields } from '@/app/features/forms/pages/Forms/Sections/taskTemplateSummary.helpers';

type ReviewProps = {
  formData: FormsProps;
  onPublish: () => void;
  onSaveDraft: () => void;
  serviceOptions: { label: string; value: string; badge?: string }[];
  loading?: boolean;
  isEditing?: boolean;
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
    Organisation['type'] | undefined;
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
  const [prevSchemaKey, setPrevSchemaKey] = React.useState(schemaKey);
  if (prevSchemaKey !== schemaKey) {
    setPrevSchemaKey(schemaKey);
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
