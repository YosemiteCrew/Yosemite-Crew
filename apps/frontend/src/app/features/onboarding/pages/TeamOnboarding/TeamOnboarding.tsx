'use client';
import React, { Suspense, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { IoCalendarOutline, IoDocument, IoPersonOutline } from 'react-icons/io5';

import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { StepContent } from '@/app/features/onboarding/components/Steps/types';
import type { StepHandle } from '@/app/features/onboarding/components/Steps/TeamOnboarding/PersonalStep';

import './TeamOnboarding.css';
import { redirect, useSearchParams } from 'next/navigation';
import { useTeamOnboarding } from '@/app/hooks/useTeamOnboarding';
import { UserProfile } from '@/app/features/users/types/profile';
import {
  AvailabilityState,
  convertFromGetApi,
  daysOfWeek,
  DEFAULT_INTERVAL,
} from '@/app/features/appointments/components/Availability/utils';
import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';

const TeamSteps: StepContent[] = [
  {
    title: 'Personal',
    logo: <IoPersonOutline size={17} />,
  },
  {
    title: 'Professional',
    logo: <IoDocument size={18} />,
  },
  {
    title: 'Availability & consultation',
    logo: <IoCalendarOutline size={16} />,
  },
];

const OnboardingStepSkeleton = () => (
  <div className="min-h-80 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const Progress = dynamic(
  () => import('@/app/features/onboarding/components/Steps/Progress/Progress')
);
const PersonalStep = dynamic(
  () => import('@/app/features/onboarding/components/Steps/TeamOnboarding/PersonalStep'),
  { loading: () => <OnboardingStepSkeleton /> }
);
const ProfessionalStep = dynamic(
  () => import('@/app/features/onboarding/components/Steps/TeamOnboarding/ProfessionalStep'),
  { loading: () => <OnboardingStepSkeleton /> }
);
const AvailabilityStep = dynamic(
  () => import('@/app/features/onboarding/components/Steps/TeamOnboarding/AvailabilityStep'),
  { loading: () => <OnboardingStepSkeleton /> }
);

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

const createDefaultAvailability = () =>
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
  }, {} as AvailabilityState);

type TeamOnboardingStepProps = {
  activeStep: number;
  personalRef: React.RefObject<StepHandle | null>;
  professionalRef: React.RefObject<StepHandle | null>;
  availabilityRef: React.RefObject<StepHandle | null>;
  formData: UserProfile;
  setFormData: React.Dispatch<React.SetStateAction<UserProfile>>;
  orgIdFromQuery: string | null;
  isSaving: boolean;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  availability: AvailabilityState;
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityState>>;
  setIsRedirecting: React.Dispatch<React.SetStateAction<boolean>>;
  nextStep: () => void;
  prevStep: () => void;
};

const TeamOnboardingStep = ({
  activeStep,
  personalRef,
  professionalRef,
  availabilityRef,
  formData,
  setFormData,
  orgIdFromQuery,
  isSaving,
  setIsSaving,
  availability,
  setAvailability,
  setIsRedirecting,
  nextStep,
  prevStep,
}: TeamOnboardingStepProps) => {
  if (activeStep === 0) {
    return (
      <PersonalStep
        ref={personalRef}
        nextStep={nextStep}
        formData={formData}
        setFormData={setFormData}
        orgIdFromQuery={orgIdFromQuery}
        isSaving={isSaving}
        setIsSaving={setIsSaving}
      />
    );
  }

  if (activeStep === 1) {
    return (
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
    );
  }

  return (
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
  );
};

type StoreAvailabilitySlots = Parameters<typeof convertFromGetApi>[0];

const useTeamOnboardingHydration = ({
  isReady,
  computedStep,
  profile,
  storeSlots,
  setActiveStep,
  setFormData,
  setAvailability,
}: {
  isReady: boolean;
  computedStep: number;
  profile: UserProfile | null | undefined;
  storeSlots: StoreAvailabilitySlots;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  setFormData: React.Dispatch<React.SetStateAction<UserProfile>>;
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityState>>;
}) => {
  const [initialStepApplied, setInitialStepApplied] = useState(false);
  const [hydratedProfile, setHydratedProfile] = useState<UserProfile | null>(null);
  const [hydratedSlots, setHydratedSlots] = useState<StoreAvailabilitySlots | null>(null);

  if (!isReady) return { initialStepApplied };

  if (!initialStepApplied) {
    setInitialStepApplied(true);
    if (computedStep >= 0 && computedStep <= 2) setActiveStep(computedStep);
  }

  if (profile && profile !== hydratedProfile) {
    setHydratedProfile(profile);
    setFormData(profile);
  }

  if (storeSlots.length > 0 && storeSlots !== hydratedSlots) {
    setHydratedSlots(storeSlots);
    setAvailability(convertFromGetApi(storeSlots));
  }

  return { initialStepApplied };
};

const TeamOnboarding = () => {
  const searchParams = useSearchParams();
  const orgIdFromQuery = searchParams.get('orgId');

  const {
    profile,
    step: computedStep,
    slots: storeSlots,
    shouldRedirectToOrganizations,
    isReady,
  } = useTeamOnboarding(orgIdFromQuery);

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<UserProfile>(EMPTY_PROFILE);
  const [availability, setAvailability] = useState<AvailabilityState>(createDefaultAvailability);
  // Shown while saving a step (API in-flight)
  const [isSaving, setIsSaving] = useState(false);
  // Shown after the final step saves and we're about to redirect
  const [isRedirecting, setIsRedirecting] = useState(false);
  const shouldBlockForRedirect =
    isRedirecting || (isReady && (computedStep === 3 || shouldRedirectToOrganizations));
  useFullscreenLoader('team-onboarding-submit', isSaving || shouldBlockForRedirect);

  // Refs to each step's validate() handle
  const personalRef = useRef<StepHandle>(null);
  const professionalRef = useRef<StepHandle>(null);
  const availabilityRef = useRef<StepHandle>(null);

  const stepRefs: React.RefObject<StepHandle | null>[] = [
    personalRef,
    professionalRef,
    availabilityRef,
  ];

  // Render-phase hydration: adjust local editable state when the store data changes.
  const { initialStepApplied } = useTeamOnboardingHydration({
    isReady,
    computedStep,
    profile,
    storeSlots,
    setActiveStep,
    setFormData,
    setAvailability,
  });

  // Show initial load spinner (first page load, before store is ready)
  if (!isReady && !initialStepApplied) {
    return (
      <div className="create-profile-wrapper flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-4 border-neutral-200 border-t-text-brand animate-spin" />
          <div className="text-body-4 text-text-secondary">Loading your profile…</div>
        </div>
      </div>
    );
  }

  if (shouldBlockForRedirect) {
    redirect(shouldRedirectToOrganizations ? '/organizations' : '/dashboard');
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
    <div className="create-profile-wrapper">
      <Progress
        activeStep={activeStep}
        steps={TeamSteps}
        canSelectStep={canSelectStep}
        onStepSelect={handleStepSelect}
      />
      <div className="flex w-full flex-col items-center gap-7">
        <h1 className="create-profile-title">Create organization profile</h1>
        <TeamOnboardingStep
          activeStep={activeStep}
          personalRef={personalRef}
          professionalRef={professionalRef}
          availabilityRef={availabilityRef}
          formData={formData}
          setFormData={setFormData}
          orgIdFromQuery={orgIdFromQuery}
          isSaving={isSaving}
          setIsSaving={setIsSaving}
          availability={availability}
          setAvailability={setAvailability}
          setIsRedirecting={setIsRedirecting}
          nextStep={nextStep}
          prevStep={prevStep}
        />
      </div>
    </div>
  );
};

const ProtectedTeamOnboarding = () => {
  return (
    <ProtectedRoute>
      <Suspense>
        <TeamOnboarding />
      </Suspense>
    </ProtectedRoute>
  );
};

export default ProtectedTeamOnboarding;
