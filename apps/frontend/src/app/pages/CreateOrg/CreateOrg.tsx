"use client";
import React, { useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import CreateOrgProgress from "@/app/components/Steps/CreateOrgProgress/CreateOrgProgress";
import OrgStep from "@/app/components/Steps/CreateOrg/OrgStep";
import AddressStep from "@/app/components/Steps/CreateOrg/AddressStep";
import SpecialityStep from "@/app/components/Steps/CreateOrg/SpecialityStep";

import "./CreateOrg.css";

const CreateOrg = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    duns: "",
    number: "",
    taxId: "",
    website: "",
    healthCertficate: "",
    animalWelfareCompliance: "",
    fireCompliance: "",
    address: "",
    area: "",
    city: "",
    state: "",
    postalCode: "",
  });

  const nextStep = () => setActiveStep((s) => s + 1);
  const prevStep = () => setActiveStep((s) => s - 1);

  return (
    <div className="create-org-wrapper">
      <div className="create-org-title">Create organisation</div>
      <CreateOrgProgress activeStep={activeStep} />
      {activeStep === 0 && (
        <OrgStep
          nextStep={nextStep}
          formData={formData}
          setFormData={setFormData}
        />
      )}
      {activeStep === 1 && (
        <AddressStep
          nextStep={nextStep}
          prevStep={prevStep}
          formData={formData}
          setFormData={setFormData}
        />
      )}
      {activeStep === 2 && <SpecialityStep prevStep={prevStep} />}
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
