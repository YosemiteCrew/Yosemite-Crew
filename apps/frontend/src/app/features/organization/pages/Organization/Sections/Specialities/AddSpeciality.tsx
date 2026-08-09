import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary } from '@/app/ui/primitives/Buttons';
import Modal from '@/app/ui/overlays/Modal';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import React, { useState } from 'react';
import SpecialityCard from '@/app/features/organization/pages/Organization/Sections/Specialities/SpecialityCard';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import SpecialitySearchWeb from '@/app/ui/inputs/SpecialitySearch/SpecialitySearchWeb';
import { createBulkSpecialityServices } from '@/app/features/organization/services/specialityService';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  buildStarterServicesForSpeciality,
  getResolvedBusinessType,
  OnboardingServiceTemplate,
} from '@/app/lib/onboardingSpecialityCatalog';
import { BusinessType } from '@/app/features/organization/types/org';
import { Service } from '@yosemite-crew/types';

type AddSpecialityProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  specialities: SpecialityWeb[];
};

const buildServiceItem = (
  service: OnboardingServiceTemplate,
  primaryOrgId: string | null,
  specialityId: string | undefined
): Service => ({
  ...service,
  id: '',
  organisationId: primaryOrgId ?? '',
  specialityId,
  isActive: true,
});

const applyStarterServices = (
  speciality: SpecialityWeb,
  businessType: BusinessType,
  primaryOrgId: string | null
): { speciality: SpecialityWeb; changed: boolean } => {
  if (Array.isArray(speciality.services) && speciality.services.length > 0) {
    return { speciality, changed: false };
  }
  const starterServices = buildStarterServicesForSpeciality(speciality.name, businessType).map(
    (service) => buildServiceItem(service, primaryOrgId, speciality._id)
  );
  if (starterServices.length === 0) return { speciality, changed: false };
  return { speciality: { ...speciality, services: starterServices }, changed: true };
};

const AddSpeciality = ({ showModal, setShowModal, specialities }: AddSpecialityProps) => {
  const [formData, setFormData] = useState<SpecialityWeb[]>([]);
  const { notify } = useNotify();
  const primaryOrgId = useOrgStore((state) => state.primaryOrgId);
  const primaryOrg = useOrgStore((state) =>
    state.primaryOrgId ? (state.orgsById[state.primaryOrgId] ?? null) : null
  );
  const businessType = getResolvedBusinessType(primaryOrg?.type);

  // Re-apply the starter services when the business type or org resolves late
  // (adjusted during render, per React's "adjusting state when a prop changes" pattern).
  const [prevStarterKey, setPrevStarterKey] = useState({ businessType, primaryOrgId });
  if (
    prevStarterKey.businessType !== businessType ||
    prevStarterKey.primaryOrgId !== primaryOrgId
  ) {
    setPrevStarterKey({ businessType, primaryOrgId });
    setFormData((previous) => {
      let hasChanges = false;
      const nextState = previous.map((speciality) => {
        const result = applyStarterServices(speciality, businessType, primaryOrgId);
        if (result.changed) hasChanges = true;
        return result.speciality;
      });
      return hasChanges ? nextState : previous;
    });
  }

  const removeSpeciality = (index: number) => {
    setFormData((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      await createBulkSpecialityServices(formData);
      notify('success', {
        title: 'Specialities saved',
        text: 'Specialities have been saved successfully.',
      });
      setFormData([]);
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save specialities:', err);
      notify('error', {
        title: 'Unable to save specialities',
        text: 'Failed to save specialities. Please try again.',
      });
    }
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal} size="md">
      <div className="flex flex-col h-full gap-6">
        <ModalHeader title="Add specialties" onClose={() => setShowModal(false)} />

        <div className="flex overflow-y-auto flex-1 w-full flex-col gap-6 scrollbar-hidden">
          <div className="flex flex-col gap-3">
            <SpecialitySearchWeb
              specialities={formData}
              setSpecialities={setFormData}
              currentSpecialities={specialities}
            />
            {formData.map((speciality, i) => (
              <Accordion
                key={speciality.name}
                title={speciality.name}
                defaultOpen
                showEditIcon={false}
                isEditing={false}
                showDeleteIcon
                onDeleteClick={() => removeSpeciality(i)}
              >
                <SpecialityCard setFormData={setFormData} speciality={speciality} index={i} />
              </Accordion>
            ))}
          </div>
        </div>

        <ModalFooter align="stretch">
          <Primary href="#" text="Save" onClick={handleSubmit} />
        </ModalFooter>
      </div>
    </Modal>
  );
};

export default AddSpeciality;
