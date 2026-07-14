import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { PackageRevamp } from '@/app/features/organization/types/revamp';
import PackageTopFields from './PackageTopFields';
import PackageDeleteModal from './PackageDeleteModal';
import PackageDraftTitleSlot from './PackageDraftTitleSlot';
import PackageFormActions from './PackageFormActions';
import PackageBreakdownSection from './PackageBreakdownSection';
import { usePackageFormDraftController } from './usePackageFormDraftController';

type PackageFormDraftProps = {
  specialityId: string;
  organisationId: string;
  editPackage?: PackageRevamp;
  onClose: () => void;
};

const PackageFormDraft = (props: PackageFormDraftProps) => {
  const { editPackage, onClose } = props;
  const form = usePackageFormDraftController(props);
  const draftTitleSlot = (
    <PackageDraftTitleSlot
      code={editPackage?.code}
      isBookable={form.effectiveBookable}
      isInpatientPreferred={form.effectiveInpatientPreferred}
    />
  );

  return (
    <SectionContainer
      title={form.draftTitle}
      titleSlot={draftTitleSlot}
      className="@container flex flex-col gap-5"
    >
      <PackageTopFields
        name={form.name}
        onNameChange={(value) => {
          form.setName(value);
          form.setErrors((p) => ({ ...p, name: undefined }));
        }}
        nameError={form.errors.name}
        description={form.description}
        onDescriptionChange={form.setDescription}
        descId={form.descId}
        durationText={form.durationText}
        onDurationTextChange={(value) => {
          form.setDurationText(value);
          form.setErrors((p) => ({ ...p, durationText: undefined }));
        }}
        durationTextError={form.errors.durationText}
        leadCount={form.leadCount}
        onLeadCountSelect={form.setLeadCount}
        supportCount={form.supportCount}
        onSupportCountSelect={form.setSupportCount}
        effectiveBookable={form.effectiveBookable}
        requiredBookable={form.requiredBookable}
        onIsBookableChange={form.setIsBookable}
        effectiveInpatientPreferred={form.effectiveInpatientPreferred}
        requiredInpatient={form.requiredInpatient}
        onIsInpatientPreferredChange={form.setIsInpatientPreferred}
      />

      <PackageBreakdownSection
        breakdown={form.breakdown}
        additionalDiscount={form.additionalDiscount}
        errors={form.errors}
        filteredSearch={form.filteredSearch}
        orgCurrency={form.orgCurrency}
        searchLoading={form.searchLoading}
        searchQuery={form.searchQuery}
        onAdditionalDiscountChange={(value) => {
          form.setAdditionalDiscount(value);
          form.setErrors((p) => ({ ...p, additionalDiscount: undefined }));
        }}
        onChangeDiscount={form.handleChangeDiscount}
        onChangeQty={form.handleChangeQty}
        onQueryChange={form.setSearchQuery}
        onRemoveItem={form.removeBreakdownItem}
        onSelectItem={form.addBreakdownItem}
      />

      <PackageFormActions
        isEditing={form.isEditing}
        onCancel={onClose}
        onDeleteClick={() => form.setConfirmDelete(true)}
        onSave={form.handleSave}
      />

      {form.confirmDelete && editPackage && (
        <PackageDeleteModal
          packageName={editPackage.name}
          onCancel={() => form.setConfirmDelete(false)}
          onConfirm={() => {
            Promise.resolve(form.handleDelete()).catch(() => undefined);
          }}
        />
      )}
    </SectionContainer>
  );
};

export default PackageFormDraft;
