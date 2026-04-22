'use client';
import React, { useEffect, useState } from 'react';
import { HiShoppingBag } from 'react-icons/hi2';
import { IoLocationSharp } from 'react-icons/io5';
import { FaSuitcaseMedical } from 'react-icons/fa6';

import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import CreateOrgProgress from '@/app/features/onboarding/components/Steps/Progress/Progress';
import OrgStep from '@/app/features/onboarding/components/Steps/CreateOrg/OrgStep';
import AddressStep from '@/app/features/onboarding/components/Steps/CreateOrg/AddressStep';
import SpecialityStep from '@/app/features/onboarding/components/Steps/CreateOrg/SpecialityStep';
import { Organisation, Speciality } from '@yosemite-crew/types';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { useOrgOnboarding } from '@/app/hooks/useOrgOnboarding';
import { useSpecialitiesWithServiceNamesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { useRouter, useSearchParams } from 'next/navigation';
import { findPhoneData } from '@/app/features/companions/components/AddCompanion/type';
import { validateOrgAddress, validateOrgBasics } from '@/app/lib/organizationOnboardingValidation';
import {
  buildOnboardingServiceDrafts,
  getResolvedBusinessType,
} from '@/app/lib/onboardingSpecialityCatalog';

import './CreateOrg.css';

const OrgSteps = [
  {
    title: 'Organization',
    logo: <HiShoppingBag color="#fff" size={20} />,
  },
  {
    title: 'Address',
    logo: <IoLocationSharp color="#fff" size={20} />,
  },
  {
    title: 'Specialties',
    logo: <FaSuitcaseMedical color="#fff" size={18} />,
  },
];

const EMPTY_ORG: Organisation = {
  _id: '',
  isActive: false,
  isVerified: false,
  imageURL: '',
  name: '',
  type: 'HOSPITAL',
  DUNSNumber: '',
  phoneNo: '',
  taxId: '',
  website: '',
  googlePlacesId: '',
  appointmentCheckInBufferMinutes: 5,
  appointmentCheckInRadiusMeters: 200,
  address: {
    addressLine: '',
    country: '',
    city: '',
    state: '',
    postalCode: '',
    latitude: 0,
    longitude: 0,
  },
};

type OrgStepErrors = {
  name?: string;
  country?: string;
  dunsNumber?: string;
  number?: string;
  taxId?: string;
  website?: string;
};

type AddressStepErrors = {
  address?: string;
  appointmentCheckInBufferMinutes?: string;
  appointmentCheckInRadiusMeters?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  state?: string;
};

const CreateOrg = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgIdFromQuery = searchParams.get('orgId');

  const {
    org,
    step: computedStep,
    specialities: storeSpecialities,
    isReady,
  } = useOrgOnboarding(orgIdFromQuery);
  const storeSpecialitiesWithServices = useSpecialitiesWithServiceNamesForPrimaryOrg();

  const [activeStep, setActiveStep] = useState<number>(computedStep);
  const [addressErrors, setAddressErrors] = useState<AddressStepErrors>({});
  const [initialSpecialities, setInitialSpecialities] = useState<SpecialityWeb[]>([]);
  const [orgErrors, setOrgErrors] = useState<OrgStepErrors>({});
  const [specialities, setSpecialities] = useState<SpecialityWeb[]>([]);
  const [formData, setFormData] = useState<Organisation>(EMPTY_ORG);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (computedStep === 3) {
      router.replace('/dashboard');
      return;
    }
    if (computedStep >= 0 && computedStep <= 2) {
      setActiveStep(computedStep);
    }
    if (org) {
      setFormData(org);
    }
    if (storeSpecialities.length > 0) {
      setInitialSpecialities(storeSpecialitiesWithServices);
      setSpecialities(
        storeSpecialitiesWithServices.map((speciality) => ({
          ...speciality,
          services: (speciality.services ?? []).map((service) => ({
            ...service,
            organisationId:
              service.organisationId || speciality.organisationId || org?._id?.toString() || '',
          })),
        }))
      );
    }
  }, [org, storeSpecialities, storeSpecialitiesWithServices, computedStep, isReady, router]);

  if (!isReady) {
    return null;
  }

  const validateOrgStep = () => {
    const phoneData = findPhoneData(formData.phoneNo || '', formData.address?.country);
    const { errors, normalizedData } = validateOrgBasics({
      formData,
      localPhoneNumber: phoneData.localNumber,
      selectedCountryCode: phoneData.selectedCode,
    });
    setOrgErrors(errors);
    if (Object.keys(errors).length > 0) {
      return false;
    }
    setFormData(normalizedData);
    return true;
  };

  const validateAddressStep = () => {
    const { errors, normalizedData } = validateOrgAddress(formData);
    setAddressErrors(errors);
    if (Object.keys(errors).length > 0) {
      return false;
    }
    setFormData(normalizedData);
    return true;
  };

  const canSelectStep = (stepIndex: number) => stepIndex <= activeStep;

  const handleStepSelect = (stepIndex: number) => {
    if (stepIndex === activeStep) {
      return;
    }
    if (stepIndex < activeStep) {
      setActiveStep(stepIndex);
      return;
    }

    if (stepIndex >= 1 && !validateOrgStep()) {
      setActiveStep(0);
      return;
    }

    if (stepIndex >= 2 && !validateAddressStep()) {
      setActiveStep(1);
      return;
    }

    setActiveStep(stepIndex);
  };

  const nextStep = () => setActiveStep((s) => Math.min(s + 1, OrgSteps.length - 1));
  const prevStep = () => setActiveStep((s) => Math.max(s - 1, 0));

  return (
    <div className="create-org-wrapper">
      <CreateOrgProgress
        activeStep={activeStep}
        canSelectStep={canSelectStep}
        onStepSelect={handleStepSelect}
        steps={OrgSteps}
      />
      <div className="flex flex-col gap-6">
        <div className="create-org-title">Create organization</div>
        {activeStep === 0 && (
          <OrgStep
            errors={orgErrors}
            nextStep={nextStep}
            formData={formData}
            setFormData={setFormData}
          />
        )}
        {activeStep === 1 && (
          <AddressStep
            errors={addressErrors}
            nextStep={nextStep}
            prevStep={prevStep}
            formData={formData}
            setFormData={setFormData}
          />
        )}
        {activeStep === 2 && (
          <SpecialityStep
            formData={formData}
            initialSpecialities={initialSpecialities}
            isExistingOrg={Boolean(orgIdFromQuery)}
            prevStep={prevStep}
            specialities={specialities}
            setFormData={setFormData}
            setSpecialities={setSpecialities}
          />
        )}
      </div>
    </div>
  );
};

const ProtectedCreateOrg = () => {
  return (
    <ProtectedRoute>
      <CreateOrg />
    </ProtectedRoute>
  );
};

export default ProtectedCreateOrg;
