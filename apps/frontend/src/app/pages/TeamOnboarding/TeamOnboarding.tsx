"use client";
import React, { useState } from "react";
import { FaUser, FaCalendar } from "react-icons/fa";
import { IoDocument } from "react-icons/io5";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import Progress from "@/app/components/Steps/Progress/Progress";
import { StepContent } from "@/app/components/Steps/types";
import PersonalStep from "@/app/components/Steps/TeamOnboarding/PersonalStep";
import ProfessionalStep from "@/app/components/Steps/TeamOnboarding/ProfessionalStep";
import AvailabilityStep from "@/app/components/Steps/TeamOnboarding/AvailabilityStep";

import "./TeamOnboarding.css";

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

const TeamOnboarding = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    gender: "male",
    country: "",
    number: "",
    address: "",
    area: "",
    city: "",
    state: "",
    postalCode: "",
    linkedin: "",
    licenseNumber: "",
    yearsExperience: "",
    specialisation: "",
    qualification: "",
    biography: "",
    uploadCV: "",
  });

  const nextStep = () => setActiveStep((s) => s + 1);
  const prevStep = () => setActiveStep((s) => s - 1);

  return (
    <div className="create-profile-wrapper">
      <div className="create-profile-title">Create profile</div>
      <Progress activeStep={activeStep} steps={TeamSteps} />
      {activeStep === 0 && (
        <PersonalStep
          nextStep={nextStep}
          formData={formData}
          setFormData={setFormData}
        />
      )}
      {activeStep === 1 && (
        <ProfessionalStep
          nextStep={nextStep}
          prevStep={prevStep}
          formData={formData}
          setFormData={setFormData}
        />
      )}
      {activeStep === 2 && (
        <AvailabilityStep
          prevStep={prevStep}
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
