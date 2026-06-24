import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary } from '@/app/ui/primitives/Buttons';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import {
  FormsCategory,
  FormsCategoryOptions,
  FormsProps,
  RequiredSignerOptions,
  FormsUsage,
  FormsUsageOptions,
  getFormCategoryDisplayLabel,
} from '@/app/features/forms/types/forms';
import {
  getCategoryTemplate,
  ensureSingleSignatureAtEnd,
  hasSignatureField,
  removeSignatureFields,
} from '@/app/lib/forms';
import React, { useMemo, useState } from 'react';
import { Organisation } from '@yosemite-crew/types';
import { useOrgStore } from '@/app/stores/orgStore';

type DetailsProps = {
  formData: FormsProps;
  setFormData: React.Dispatch<React.SetStateAction<FormsProps>>;
  onNext: () => void;
  serviceOptions: { label: string; value: string; badge?: string }[];
  registerValidator?: (fn: () => boolean) => void;
};

const YC_DEFAULT_CATEGORIES = new Set<FormsCategory>([
  'SOAP',
  'Prescription',
  'Task Template',
  'Discharge Form',
  'Consent form',
]);

const Details = ({
  formData,
  setFormData,
  onNext,
  serviceOptions,
  registerValidator,
}: DetailsProps) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    category?: string;
    species?: string;
    description?: string;
    services?: string;
    requiredSigner?: string;
  }>({});
  const orgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE as
    | Organisation['type']
    | undefined;
  const effectiveOrgType = orgTypeOverride || orgType;
  // Ownership: a "YC default" template is structure-locked (content-only, see
  // Build.tsx `structureLocked`); a "Custom" template is fully editable and may
  // be scoped to the whole org or a single user. The selector lives above
  // Category because it gates what the rest of the builder can do.
  const isYcDefault = formData.templateSource === 'YC_LIBRARY';
  const categoryOptions = useMemo(() => {
    if (isYcDefault) {
      return FormsCategoryOptions.filter((c) => YC_DEFAULT_CATEGORIES.has(c));
    }
    const base = new Set([
      'Consent form',
      'Prescription',
      'SOAP',
      'Discharge Form',
      'Vitals',
      'Prescription Template',
      'Inpatient Schedule',
      'Task Template',
      'Custom',
    ]);
    if (effectiveOrgType === 'HOSPITAL') {
      return FormsCategoryOptions.filter((c) => base.has(c));
    }
    if (effectiveOrgType === 'BOARDER') {
      return FormsCategoryOptions.filter((c) => base.has(c) || c.startsWith('Boarder'));
    }
    if (effectiveOrgType === 'BREEDER') {
      return FormsCategoryOptions.filter((c) => base.has(c) || c.startsWith('Breeder'));
    }
    if (effectiveOrgType === 'GROOMER') {
      return FormsCategoryOptions.filter((c) => base.has(c) || c.startsWith('Groomer'));
    }
    return FormsCategoryOptions;
  }, [effectiveOrgType, isYcDefault]);

  const handleOwnershipChange = (value: string) => {
    if (value === 'YC_LIBRARY') {
      setFormData((prev) => ({
        ...prev,
        templateSource: 'YC_LIBRARY',
        isTemplateBacked: true,
        category: YC_DEFAULT_CATEGORIES.has(prev.category) ? prev.category : ('' as FormsCategory),
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      // Fall back to org-shared when leaving YC default so a custom template
      // always has a concrete scope; keep an existing custom scope otherwise.
      templateSource:
        prev.templateSource && prev.templateSource !== 'YC_LIBRARY'
          ? prev.templateSource
          : 'ORG_TEMPLATE',
      isTemplateBacked: false,
    }));
  };

  const handleCategoryChange = (category: FormsCategory) => {
    const shouldApplyTemplate = !formData._id || (formData.schema?.length ?? 0) === 0;
    if (formDataErrors.category) {
      setFormDataErrors((prev) => ({ ...prev, category: undefined }));
    }
    const template =
      category && shouldApplyTemplate ? getCategoryTemplate(category) : formData.schema;
    const clinicalCategories = new Set(['Prescription', 'Discharge Form']);
    let normalizedTemplate = template;
    if (clinicalCategories.has(category)) {
      normalizedTemplate = formData.requiredSigner
        ? ensureSingleSignatureAtEnd(template ?? [])
        : removeSignatureFields(template ?? []);
    }

    setFormData((prev) => ({
      ...prev,
      category,
      requiredSigner: category === 'SOAP' ? '' : prev.requiredSigner,
      schema: normalizedTemplate,
    }));
  };

  const validate = React.useCallback(() => {
    const errors: {
      name?: string;
      category?: string;
      species?: string;
      description?: string;
      services?: string;
      requiredSigner?: string;
    } = {};
    if (!formData.name.trim()) {
      errors.name = 'Form name is required';
    }
    if (!formData.category) {
      errors.category = 'Category is required';
    }
    if (formData.requiredSigner === undefined) {
      errors.requiredSigner = 'Signed by is required';
    }
    if (!formData.description?.trim()) {
      errors.description = 'Description is required';
    }
    if (!formData.species || formData.species.length === 0) {
      errors.species = 'Select at least one species';
    }
    // Service is required for all categories except "Custom"
    if (formData.category !== 'Custom' && (!formData.services || formData.services.length === 0)) {
      errors.services = 'Service is required for this form category';
    }
    setFormDataErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleNext = () => {
    if (!validate()) return;
    onNext();
  };

  React.useEffect(() => {
    registerValidator?.(validate);
  }, [registerValidator, validate]);

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <Accordion title="Form details" defaultOpen showEditIcon={false} isEditing={true}>
          <div className="flex flex-col gap-3">
            <FormInput
              intype="text"
              inname="name"
              value={formData.name}
              inlabel="Form name"
              onChange={(e) => {
                if (formDataErrors.name) {
                  setFormDataErrors((prev) => ({ ...prev, name: undefined }));
                }
                setFormData({
                  ...formData,
                  name: e.target.value,
                });
              }}
              error={formDataErrors.name}
              className="min-h-12!"
            />
            <FormInput
              intype="text"
              inname="description"
              value={formData.description || ''}
              inlabel="Description"
              onChange={(e) => {
                if (formDataErrors.description) {
                  setFormDataErrors((errs) => ({
                    ...errs,
                    description: undefined,
                  }));
                }
                setFormData((prev) => ({ ...prev, description: e.target.value }));
              }}
              error={formDataErrors.description}
              className="min-h-12!"
            />
            <LabelDropdown
              placeholder="Template type"
              defaultOption={isYcDefault ? 'YC_LIBRARY' : 'CUSTOM'}
              onSelect={(option) => handleOwnershipChange(option.value)}
              options={[
                { label: 'YC default (locked structure)', value: 'YC_LIBRARY' },
                { label: 'Custom', value: 'CUSTOM' },
              ]}
            />
            {isYcDefault && (
              <p className="text-caption-2 text-text-secondary">
                YC default templates have a fixed structure. You can edit field content, but adding,
                removing, or reordering fields is locked.
              </p>
            )}
            <LabelDropdown
              placeholder="Category"
              defaultOption={formData.category || ''}
              onSelect={(option) => handleCategoryChange(option.value as FormsCategory)}
              options={categoryOptions.map((cat) => ({
                label: getFormCategoryDisplayLabel(cat, effectiveOrgType),
                value: cat,
              }))}
              error={formDataErrors.category}
            />
            <LabelDropdown
              placeholder="Signed by"
              defaultOption={formData.requiredSigner}
              onSelect={(option) => {
                if (formDataErrors.requiredSigner) {
                  setFormDataErrors((prev) => ({
                    ...prev,
                    requiredSigner: undefined,
                  }));
                }
                const nextSigner = option.value as FormsProps['requiredSigner'];
                setFormData((prev) => {
                  const next: FormsProps = {
                    ...prev,
                    requiredSigner: nextSigner,
                  };
                  if (!nextSigner) {
                    next.schema = removeSignatureFields(next.schema ?? []);
                  } else if (
                    new Set(['Prescription', 'Discharge Form']).has(next.category) &&
                    !hasSignatureField(next.schema ?? [])
                  ) {
                    next.schema = ensureSingleSignatureAtEnd(next.schema ?? []);
                  }
                  return next;
                });
              }}
              options={
                formData.category === 'SOAP'
                  ? RequiredSignerOptions.filter((option) => option.value === '')
                  : RequiredSignerOptions
              }
              error={formDataErrors.requiredSigner}
            />
          </div>
        </Accordion>
        <Accordion title="Usage and visibility" defaultOpen showEditIcon={false} isEditing={true}>
          <div className="flex flex-col gap-3">
            <LabelDropdown
              placeholder="Visibility type"
              defaultOption={formData.usage}
              onSelect={(option) => setFormData({ ...formData, usage: option.value as FormsUsage })}
              options={FormsUsageOptions.map((opt) => ({ label: opt, value: opt }))}
            />
            {!isYcDefault && (
              <LabelDropdown
                placeholder="Template scope"
                defaultOption={formData.templateSource ?? 'ORG_TEMPLATE'}
                onSelect={(option) =>
                  setFormData({
                    ...formData,
                    templateSource: option.value as FormsProps['templateSource'],
                  })
                }
                options={[
                  { label: 'Organisation (shared with your team)', value: 'ORG_TEMPLATE' },
                  { label: 'Personal (only you)', value: 'USER_TEMPLATE' },
                ]}
              />
            )}
            <MultiSelectDropdown
              placeholder={formData.category === 'Custom' ? 'Service (Optional)' : 'Service'}
              value={formData.services || []}
              error={formDataErrors.services}
              onChange={(e) => {
                setFormData({ ...formData, services: e });
                setFormDataErrors((prev) => ({ ...prev, services: undefined }));
              }}
              options={serviceOptions}
            />
            <MultiSelectDropdown
              placeholder="Species"
              value={formData.species || []}
              error={formDataErrors.species}
              onChange={(e) => {
                setFormData({ ...formData, species: e });
                setFormDataErrors((prev) => ({ ...prev, species: undefined }));
              }}
              options={['Canine', 'Feline', 'Equine']}
            />
          </div>
        </Accordion>
      </div>
      <div className="px-3 pb-3 flex justify-center">
        <Primary href="#" text="Next" onClick={handleNext} className="w-fit" />
      </div>
    </div>
  );
};

export default Details;
