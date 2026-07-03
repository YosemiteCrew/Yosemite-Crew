'use client';
import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { HiShoppingBag } from 'react-icons/hi2';
import { IoLocationSharp } from 'react-icons/io5';

import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { Organisation } from '@yosemite-crew/types';
import { useOrgOnboarding } from '@/app/hooks/useOrgOnboarding';
import { useRouter, useSearchParams } from 'next/navigation';
import { findPhoneData } from '@/app/features/companions/components/AddCompanion/type';
import { validateOrgAddress, validateOrgBasics } from '@/app/lib/organizationOnboardingValidation';
import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';
import { createOrg, updateOrg } from '@/app/features/organization/services/orgService';

import './CreateOrg.css';

const OrgSteps = [
  {
    title: 'Organization',
    logo: <HiShoppingBag color="var(--color-neutral-0)" size={20} />,
  },
  {
    title: 'Address',
    logo: <IoLocationSharp color="var(--color-neutral-0)" size={20} />,
  },
];

const CreateOrgStepSkeleton = () => (
  <div className="min-h-80 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const CreateOrgProgress = dynamic(
  () => import('@/app/features/onboarding/components/Steps/Progress/Progress')
);
const OrgStep = dynamic(
  () => import('@/app/features/onboarding/components/Steps/CreateOrg/OrgStep'),
  { loading: () => <CreateOrgStepSkeleton /> }
);
const AddressStep = dynamic(
  () => import('@/app/features/onboarding/components/Steps/CreateOrg/AddressStep'),
  { loading: () => <CreateOrgStepSkeleton /> }
);

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

  const { org, step: computedStep, isReady } = useOrgOnboarding(orgIdFromQuery);

  const [activeStep, setActiveStep] = useState<number>(computedStep);
  const [addressErrors, setAddressErrors] = useState<AddressStepErrors>({});
  const [orgErrors, setOrgErrors] = useState<OrgStepErrors>({});
  const [formData, setFormData] = useState<Organisation>(EMPTY_ORG);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isCompletedRedirect = isReady && computedStep === 2;
  const shouldBlockForTransition = isTransitioning || isCompletedRedirect;
  useFullscreenLoader('create-org-transition', shouldBlockForTransition);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (computedStep === 2) {
      setIsTransitioning(true);
      router.replace('/dashboard');
      return;
    }
    if (computedStep >= 0 && computedStep <= 1) {
      setActiveStep(computedStep);
    }
    if (org) {
      setFormData(org);
    }
  }, [org, computedStep, isReady, router]);

  if (!isReady || isCompletedRedirect) {
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

  const submitOrg = async () => {
    const { errors, normalizedData } = validateOrgAddress(formData);
    setAddressErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setFormData(normalizedData);
    setIsTransitioning(true);

    try {
      if (org) {
        await updateOrg(normalizedData);
      } else {
        await createOrg(normalizedData);
      }
      router.replace('/dashboard');
    } catch {
      setIsTransitioning(false);
    }
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
    <div className={`create-org-wrapper${isTransitioning ? ' invisible pointer-events-none' : ''}`}>
      <CreateOrgProgress
        activeStep={activeStep}
        canSelectStep={canSelectStep}
        onStepSelect={handleStepSelect}
        steps={OrgSteps}
      />
      <div className="flex flex-col gap-6">
        <h1 className="create-org-title">Create organization</h1>
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
            submitText={org ? 'Save' : 'Create'}
            onSubmit={submitOrg}
            formData={formData}
            setFormData={setFormData}
          />
        )}
      </div>
    </div>
  );
};

const ProtectedCreateOrg = () => {
  return (
    <ProtectedRoute>
      <Suspense>
        <CreateOrg />
      </Suspense>
    </ProtectedRoute>
  );
};

export default ProtectedCreateOrg;
