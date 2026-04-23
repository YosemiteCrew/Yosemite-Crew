import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary } from '@/app/ui/primitives/Buttons';
import Modal from '@/app/ui/overlays/Modal';
import React, { useEffect, useState } from 'react';
import SpecialityCard from '@/app/features/organization/pages/Organization/Sections/Specialities/SpecialityCard';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import SpecialitySearchWeb from '@/app/ui/inputs/SpecialitySearch/SpecialitySearchWeb';
import { createBulkSpecialityServices } from '@/app/features/organization/services/specialityService';
import Close from '@/app/ui/primitives/Icons/Close';
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
): Service =>
  ({
    ...service,
    id: '',
    organisationId: primaryOrgId ?? '',
    specialityId,
    isActive: true,
  }) as Service;

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

  useEffect(() => {
    setFormData((previous) => {
      let hasChanges = false;
      const nextState = previous.map((speciality) => {
        const result = applyStarterServices(speciality, businessType, primaryOrgId);
        if (result.changed) hasChanges = true;
        return result.speciality;
      });
      return hasChanges ? nextState : previous;
    });
  }, [businessType, primaryOrgId]);

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
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Add specialties</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <div className="flex overflow-y-auto flex-1 w-full flex-col gap-6 justify-between scrollbar-hidden">
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
          <Primary
            href="#"
            text="Save"
            className="max-h-12! text-lg! tracking-wide!"
            onClick={handleSubmit}
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddSpeciality;
