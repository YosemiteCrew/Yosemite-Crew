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
import React, { useImperativeHandle, useMemo, useState } from 'react';
import { Organisation } from '@yosemite-crew/types';
import { useOrgStore } from '@/app/stores/orgStore';

type DetailsProps = {
  formData: FormsProps;
  setFormData: React.Dispatch<React.SetStateAction<FormsProps>>;
  onNext: () => void;
  serviceOptions: { label: string; value: string; badge?: string; isInpatient?: boolean }[];
  ref?: React.Ref<AddFormStepHandle>;
  /** Single-screen builder hides the step "Next" button; saving happens from the modal footer. */
  hideNext?: boolean;
};

export type AddFormStepHandle = { validate: () => boolean };

const YC_DEFAULT_CATEGORIES = new Set<FormsCategory>([
  'SOAP',
  'Prescription',
  'Task Template',
  'Discharge Form',
  'Consent form',
]);

const getTemplateTypeOption = (templateSource?: FormsProps['templateSource']) =>
  templateSource === 'YC_LIBRARY' ? 'YC_LIBRARY' : 'CUSTOM';

type FormDetailsErrors = {
  name?: string;
  category?: string;
  species?: string;
  description?: string;
  services?: string;
  requiredSigner?: string;
};

type FormDetailsFieldsProps = {
  formData: FormsProps;
  formDataErrors: FormDetailsErrors;
  isYcDefault: boolean;
  categoryOptions: FormsCategory[];
  effectiveOrgType: Organisation['type'] | undefined;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onOwnershipChange: (value: string) => void;
  onCategoryChange: (category: FormsCategory) => void;
  onRequiredSignerChange: (value: string) => void;
};

const FormDetailsFields = ({
  formData,
  formDataErrors,
  isYcDefault,
  categoryOptions,
  effectiveOrgType,
  onNameChange,
  onDescriptionChange,
  onOwnershipChange,
  onCategoryChange,
  onRequiredSignerChange,
}: FormDetailsFieldsProps) => (
  <div className="flex flex-col gap-3">
    <FormInput
      intype="text"
      inname="name"
      value={formData.name}
      inlabel="Form name"
      onChange={(e) => onNameChange(e.target.value)}
      error={formDataErrors.name}
      className="min-h-12!"
    />
    <FormInput
      intype="text"
      inname="description"
      value={formData.description || ''}
      inlabel="Description"
      onChange={(e) => onDescriptionChange(e.target.value)}
      error={formDataErrors.description}
      className="min-h-12!"
    />
    <LabelDropdown
      placeholder="Template Source"
      defaultOption={getTemplateTypeOption(formData.templateSource)}
      onSelect={(option) => onOwnershipChange(option.value)}
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
      onSelect={(option) => onCategoryChange(option.value as FormsCategory)}
      options={categoryOptions.map((cat) => ({
        label: getFormCategoryDisplayLabel(cat, effectiveOrgType),
        value: cat,
      }))}
      error={formDataErrors.category}
    />
    {!isYcDefault && (
      <LabelDropdown
        placeholder="Signed by"
        defaultOption={formData.requiredSigner}
        onSelect={(option) => onRequiredSignerChange(option.value)}
        options={
          formData.category === 'SOAP'
            ? RequiredSignerOptions.filter((option) => option.value === '')
            : RequiredSignerOptions
        }
        error={formDataErrors.requiredSigner}
      />
    )}
  </div>
);

type FormUsageFieldsProps = {
  formData: FormsProps;
  formDataErrors: FormDetailsErrors;
  isYcDefault: boolean;
  isInpatientOnlyCategory: boolean;
  effectiveServiceOptions: {
    label: string;
    value: string;
    badge?: string;
    isInpatient?: boolean;
  }[];
  onUsageChange: (value: FormsUsage) => void;
  onTemplateVisibilityChange: (value: FormsProps['templateSource']) => void;
  onServicesChange: (value: string[]) => void;
  onSpeciesChange: (value: string[]) => void;
};

const FormUsageFields = ({
  formData,
  formDataErrors,
  isYcDefault,
  isInpatientOnlyCategory,
  effectiveServiceOptions,
  onUsageChange,
  onTemplateVisibilityChange,
  onServicesChange,
  onSpeciesChange,
}: FormUsageFieldsProps) => (
  <div className="flex flex-col gap-3">
    <LabelDropdown
      placeholder="Visibility type"
      defaultOption={formData.usage}
      onSelect={(option) => onUsageChange(option.value as FormsUsage)}
      options={FormsUsageOptions.map((opt) => ({ label: opt, value: opt }))}
    />
    {!isYcDefault && (
      <LabelDropdown
        placeholder="Template visibility"
        defaultOption={formData.templateSource ?? 'ORG_TEMPLATE'}
        onSelect={(option) =>
          onTemplateVisibilityChange(option.value as FormsProps['templateSource'])
        }
        options={[
          { label: 'Organisation (team)', value: 'ORG_TEMPLATE' },
          { label: 'Personal', value: 'USER_TEMPLATE' },
        ]}
      />
    )}
    <MultiSelectDropdown
      placeholder={
        formData.category === 'Custom' ? 'Services / Packages (Optional)' : 'Services / Packages'
      }
      value={formData.services || []}
      error={formDataErrors.services}
      onChange={onServicesChange}
      options={effectiveServiceOptions}
    />
    {isInpatientOnlyCategory && (
      <p className="text-caption-2 text-text-secondary">
        Task templates apply to in-patient services / packages only.
      </p>
    )}
    <MultiSelectDropdown
      placeholder="Species"
      value={formData.species || []}
      error={formDataErrors.species}
      onChange={onSpeciesChange}
      options={['Canine', 'Feline', 'Equine']}
    />
  </div>
);

const Details = ({
  formData,
  setFormData,
  onNext,
  serviceOptions,
  ref,
  hideNext = false,
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

  // Task / Inpatient-Schedule templates only apply to in-patient services & packages, so the
  // service/package picker is filtered to inpatient-preferred catalog items for those categories.
  const isInpatientOnlyCategory =
    formData.category === 'Task Template' || formData.category === 'Inpatient Schedule';
  const effectiveServiceOptions = useMemo(
    () =>
      isInpatientOnlyCategory
        ? serviceOptions.filter((option) => option.isInpatient)
        : serviceOptions,
    [isInpatientOnlyCategory, serviceOptions]
  );

  const handleOwnershipChange = (value: string) => {
    if (value === 'YC_LIBRARY') {
      setFormData((prev) => ({
        ...prev,
        templateSource: 'YC_LIBRARY',
        isTemplateBacked: true,
        requiredSigner: '',
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
      requiredSigner:
        prev.templateSource === 'YC_LIBRARY' || category === 'SOAP' ? '' : prev.requiredSigner,
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
    if (!isYcDefault && formData.requiredSigner === undefined) {
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
      errors.services = 'Services / Packages is required for this form category';
    }
    setFormDataErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, isYcDefault]);

  const handleNext = () => {
    if (!validate()) return;
    onNext();
  };

  useImperativeHandle(ref, () => ({ validate }), [validate]);

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <Accordion title="Form details" defaultOpen showEditIcon={false} isEditing={true}>
          <FormDetailsFields
            formData={formData}
            formDataErrors={formDataErrors}
            isYcDefault={isYcDefault}
            categoryOptions={categoryOptions}
            effectiveOrgType={effectiveOrgType}
            onNameChange={(value) => {
              if (formDataErrors.name) {
                setFormDataErrors((prev) => ({ ...prev, name: undefined }));
              }
              setFormData({ ...formData, name: value });
            }}
            onDescriptionChange={(value) => {
              if (formDataErrors.description) {
                setFormDataErrors((errs) => ({ ...errs, description: undefined }));
              }
              setFormData((prev) => ({ ...prev, description: value }));
            }}
            onOwnershipChange={handleOwnershipChange}
            onCategoryChange={handleCategoryChange}
            onRequiredSignerChange={(value) => {
              if (formDataErrors.requiredSigner) {
                setFormDataErrors((prev) => ({ ...prev, requiredSigner: undefined }));
              }
              const nextSigner = value as FormsProps['requiredSigner'];
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
          />
        </Accordion>
        <Accordion title="Usage and visibility" defaultOpen showEditIcon={false} isEditing={true}>
          <FormUsageFields
            formData={formData}
            formDataErrors={formDataErrors}
            isYcDefault={isYcDefault}
            isInpatientOnlyCategory={isInpatientOnlyCategory}
            effectiveServiceOptions={effectiveServiceOptions}
            onUsageChange={(value) => setFormData({ ...formData, usage: value })}
            onTemplateVisibilityChange={(value) =>
              setFormData({ ...formData, templateSource: value })
            }
            onServicesChange={(value) => {
              setFormData({ ...formData, services: value });
              setFormDataErrors((prev) => ({ ...prev, services: undefined }));
            }}
            onSpeciesChange={(value) => {
              setFormData({ ...formData, species: value });
              setFormDataErrors((prev) => ({ ...prev, species: undefined }));
            }}
          />
        </Accordion>
      </div>
      {!hideNext && (
        <div className="px-3 pb-3 flex justify-center">
          <Primary href="#" text="Next" onClick={handleNext} className="w-fit" />
        </div>
      )}
    </div>
  );
};

export default Details;
