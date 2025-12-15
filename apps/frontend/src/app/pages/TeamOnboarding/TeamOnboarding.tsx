"use client";
import React, { useEffect, useState } from "react";
import { FaUser, FaCalendar } from "react-icons/fa";
import { IoDocument } from "react-icons/io5";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import Progress from "@/app/components/Steps/Progress/Progress";
import { StepContent } from "@/app/components/Steps/types";
import PersonalStep from "@/app/components/Steps/TeamOnboarding/PersonalStep";
import ProfessionalStep from "@/app/components/Steps/TeamOnboarding/ProfessionalStep";
import AvailabilityStep from "@/app/components/Steps/TeamOnboarding/AvailabilityStep";

import "./TeamOnboarding.css";
import { useRouter, useSearchParams } from "next/navigation";
import { useTeamOnboarding } from "@/app/hooks/useTeamOnboarding";
import { UserProfile } from "@/app/types/profile";
import {
  AvailabilityState,
  convertFromGetApi,
  daysOfWeek,
  DEFAULT_INTERVAL,
} from "@/app/components/Availability/utils";

const TeamSteps: StepContent[] = [
  {
    title: "Personal details",
    logo: <FaUser color="#fff" size={20} />,
  },
  {
    title: "Professional details",
    logo: <IoDocument color="#fff" size={20} />,
  },
  {
    title: "Availability and consultation",
    logo: <FaCalendar color="#fff" size={18} />,
  },
];

const EMPTY_PROFILE: UserProfile = {
  _id: "",
  organizationId: "",
  personalDetails: {
    gender: "MALE",
    dateOfBirth: "",
    employmentType: "FULL_TIME",
    address: {
      addressLine: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      latitude: undefined,
      longitude: undefined,
    },
    phoneNumber: "",
    profilePictureUrl: "",
  },
  professionalDetails: {
    medicalLicenseNumber: "",
    yearsOfExperience: undefined,
    specialization: "",
    qualification: "",
    biography: "",
    linkedin: "",
    documents: [],
  },
  status: "DRAFT",
  createdAt: "",
  updatedAt: "",
};

const TeamOnboarding = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgIdFromQuery = searchParams.get("orgId");

  const {
    profile,
    step: computedStep,
    slots: storeSlots,
    shouldRedirectToOrganizations,
  } = useTeamOnboarding(orgIdFromQuery);

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<UserProfile>(EMPTY_PROFILE);
  const [availability, setAvailability] = useState<AvailabilityState>(
    daysOfWeek.reduce<AvailabilityState>((acc, day) => {
      const isWeekday =
        day === "Monday" ||
        day === "Tuesday" ||
        day === "Wednesday" ||
        day === "Thursday" ||
        day === "Friday";

      acc[day] = {
        enabled: isWeekday,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      return acc;
    }, {} as AvailabilityState)
  );

  useEffect(() => {
    if (shouldRedirectToOrganizations) {
      router.replace("/organizations");
      return;
    }
    if (computedStep === 3) {
      router.replace("/dashboard");
      return;
    }
    if (computedStep >= 0 && computedStep <= 2) {
      setActiveStep(computedStep);
    }
    if (profile) {
      setFormData(profile);
    }
    if (storeSlots.length > 0) {
      const temp = convertFromGetApi(storeSlots)
      setAvailability(temp);
    }
  }, [profile, computedStep, shouldRedirectToOrganizations, router, storeSlots]);

  const nextStep = () =>
    setActiveStep((s) => Math.min(s + 1, TeamSteps.length - 1));
  const prevStep = () => setActiveStep((s) => Math.max(s - 1, 0));

  return (
    <div className="create-profile-wrapper">
      <div className="create-profile-title">Create profile</div>
      <Progress activeStep={activeStep} steps={TeamSteps} />
      {activeStep === 0 && (
        <PersonalStep
          nextStep={nextStep}
          formData={formData}
          setFormData={setFormData}
          orgIdFromQuery={orgIdFromQuery}
        />
      )}
      {activeStep === 1 && (
        <ProfessionalStep
          nextStep={nextStep}
          prevStep={prevStep}
          formData={formData}
          setFormData={setFormData}
          orgIdFromQuery={orgIdFromQuery}
        />
      )}
      {activeStep === 2 && (
        <AvailabilityStep
          prevStep={prevStep}
          orgIdFromQuery={orgIdFromQuery}
          availability={availability}
          setAvailability={setAvailability}
        />
      )}
    </div>
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
