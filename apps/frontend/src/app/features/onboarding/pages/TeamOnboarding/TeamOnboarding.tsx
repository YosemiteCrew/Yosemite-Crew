'use client';
import React, { useEffect, useRef, useState } from 'react';
import { FaUser, FaCalendar } from 'react-icons/fa';
import { IoDocument } from 'react-icons/io5';

import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import Progress from '@/app/features/onboarding/components/Steps/Progress/Progress';
import { StepContent } from '@/app/features/onboarding/components/Steps/types';
import PersonalStep, {
  StepHandle,
} from '@/app/features/onboarding/components/Steps/TeamOnboarding/PersonalStep';
import ProfessionalStep from '@/app/features/onboarding/components/Steps/TeamOnboarding/ProfessionalStep';
import AvailabilityStep from '@/app/features/onboarding/components/Steps/TeamOnboarding/AvailabilityStep';

import './TeamOnboarding.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTeamOnboarding } from '@/app/hooks/useTeamOnboarding';
import { UserProfile } from '@/app/features/users/types/profile';
import {
  AvailabilityState,
  convertFromGetApi,
  daysOfWeek,
  DEFAULT_INTERVAL,
} from '@/app/features/appointments/components/Availability/utils';

const TeamSteps: StepContent[] = [
  {
    title: 'Personal details',
    logo: <FaUser color="#fff" size={20} />,
  },
  {
    title: 'Professional details',
    logo: <IoDocument color="#fff" size={20} />,
  },
  {
    title: 'Availability and consultation',
    logo: <FaCalendar color="#fff" size={18} />,
  },
];

const EMPTY_PROFILE: UserProfile = {
  _id: '',
  organizationId: '',
  personalDetails: {
    gender: 'MALE',
    dateOfBirth: '',
    employmentType: 'FULL_TIME',
    address: {
      addressLine: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      latitude: undefined,
      longitude: undefined,
    },
    phoneNumber: '',
    profilePictureUrl: '',
  },
  professionalDetails: {
    medicalLicenseNumber: '',
    yearsOfExperience: undefined,
    specialization: '',
    qualification: '',
    biography: '',
    linkedin: '',
    documents: [],
  },
  status: 'DRAFT',
  createdAt: '',
  updatedAt: '',
};

const RedirectingOverlay = () => (
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-white/80 backdrop-blur-sm">
    <div className="w-10 h-10 rounded-full border-4 border-neutral-200 border-t-text-brand animate-spin" />
    <div className="text-body-3 text-text-secondary">Setting up your profile…</div>
  </div>
);

const TeamOnboarding = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgIdFromQuery = searchParams.get('orgId');

  const {
    profile,
    step: computedStep,
    slots: storeSlots,
    shouldRedirectToOrganizations,
    isReady,
  } = useTeamOnboarding(orgIdFromQuery);

  const [activeStep, setActiveStep] = useState(0);
  const [initialStepApplied, setInitialStepApplied] = useState(false);
  const [formData, setFormData] = useState<UserProfile>(EMPTY_PROFILE);
  const [availability, setAvailability] = useState<AvailabilityState>(
    daysOfWeek.reduce<AvailabilityState>((acc, day) => {
      const isWeekday =
        day === 'Monday' ||
        day === 'Tuesday' ||
        day === 'Wednesday' ||
        day === 'Thursday' ||
        day === 'Friday';

      acc[day] = {
        enabled: isWeekday,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      return acc;
    }, {} as AvailabilityState)
  );
  // Shown while saving a step (API in-flight)
  const [isSaving, setIsSaving] = useState(false);
  // Shown after the final step saves and we're about to redirect
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Refs to each step's validate() handle
  const personalRef = useRef<StepHandle>(null);
  const professionalRef = useRef<StepHandle>(null);
  const availabilityRef = useRef<StepHandle>(null);

  const stepRefs: React.RefObject<StepHandle | null>[] = [
    personalRef,
    professionalRef,
    availabilityRef,
  ];

  useEffect(() => {
    // Once the page has initialised, don't let store loading states cause a blank screen.
    // isReady can flip false again when a save triggers a store reload — we stay visible.
    if (!isReady && initialStepApplied) return;

    if (!isReady) return;

    if (shouldRedirectToOrganizations) {
      router.replace('/organizations');
      return;
    }
    if (computedStep === 3) {
      setIsRedirecting(true);
      router.replace('/dashboard');
      return;
    }
    // Only set active step from store on very first load.
    if (!initialStepApplied) {
      setInitialStepApplied(true);
      if (computedStep >= 0 && computedStep <= 2) {
        setActiveStep(computedStep);
      }
    }
    if (profile) {
      setFormData(profile);
    }
    if (storeSlots.length > 0) {
      const temp = convertFromGetApi(storeSlots);
      setAvailability(temp);
    }
  }, [
    profile,
    computedStep,
    shouldRedirectToOrganizations,
    isReady,
    router,
    storeSlots,
    initialStepApplied,
  ]);

  // Show initial load spinner (first page load, before store is ready)
  if (!isReady && !initialStepApplied) {
    return (
      <div className="create-profile-wrapper flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-neutral-200 border-t-text-brand animate-spin" />
          <div className="text-body-4 text-text-secondary">Loading your profile…</div>
        </div>
      </div>
    );
  }

  const nextStep = () => setActiveStep((s) => Math.min(s + 1, TeamSteps.length - 1));
  const prevStep = () => setActiveStep((s) => Math.max(s - 1, 0));

  const canSelectStep = (target: number): boolean => {
    if (target <= activeStep) return true;
    if (target === activeStep + 1) return true;
    return activeStep >= target - 1;
  };

  const handleStepSelect = (target: number) => {
    if (target === activeStep || isSaving) return;

    if (target < activeStep) {
      setActiveStep(target);
      return;
    }

    for (let i = activeStep; i < target; i++) {
      const valid = stepRefs[i]?.current?.validate();
      if (!valid) {
        setActiveStep(i);
        return;
      }
    }

    setActiveStep(target);
  };

  return (
    <>
      {isRedirecting && <RedirectingOverlay />}
      <div className="create-profile-wrapper">
        <Progress
          activeStep={activeStep}
          steps={TeamSteps}
          canSelectStep={canSelectStep}
          onStepSelect={handleStepSelect}
        />
        <div className="flex flex-col gap-6">
          <div className="create-profile-title">Create profile</div>
          {activeStep === 0 && (
            <PersonalStep
              ref={personalRef}
              nextStep={nextStep}
              formData={formData}
              setFormData={setFormData}
              orgIdFromQuery={orgIdFromQuery}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
            />
          )}
          {activeStep === 1 && (
            <ProfessionalStep
              ref={professionalRef}
              nextStep={nextStep}
              prevStep={prevStep}
              formData={formData}
              setFormData={setFormData}
              orgIdFromQuery={orgIdFromQuery}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
            />
          )}
          {activeStep === 2 && (
            <AvailabilityStep
              ref={availabilityRef}
              prevStep={prevStep}
              orgIdFromQuery={orgIdFromQuery}
              availability={availability}
              setAvailability={setAvailability}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              setIsRedirecting={setIsRedirecting}
            />
          )}
        </div>
      </div>
    </>
  );
};

const ProtectedTeamOnboarding = () => {
  return (
    <ProtectedRoute>
      <TeamOnboarding />
    </ProtectedRoute>
  );
};

export default ProtectedTeamOnboarding;
