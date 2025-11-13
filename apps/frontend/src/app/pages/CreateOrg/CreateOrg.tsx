"use client";
import React, { useState } from "react";
import { HiShoppingBag } from "react-icons/hi2";
import { IoLocationSharp } from "react-icons/io5";
import { FaSuitcaseMedical } from "react-icons/fa6";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import CreateOrgProgress from "@/app/components/Steps/Progress/Progress";
import OrgStep from "@/app/components/Steps/CreateOrg/OrgStep";
import AddressStep from "@/app/components/Steps/CreateOrg/AddressStep";
import SpecialityStep from "@/app/components/Steps/CreateOrg/SpecialityStep";
import Specialities from "@/app/utils/specialities.json";

import "./CreateOrg.css";

const OrgSteps = [
  {
    title: "Organisation",
    logo: <HiShoppingBag color="#fff" size={20} />,
  },
  {
    title: "Address",
    logo: <IoLocationSharp color="#fff" size={20} />,
  },
  {
    title: "Specialties",
    logo: <FaSuitcaseMedical color="#fff" size={18} />,
  },
];

const CreateOrg = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [specialities, setSpecialities] = useState(Specialities);
  const [formData, setFormData] = useState({
    logoURL: "",
    name: "",
    latitude: null,
    longitude: null,
    businessType: "Hospital",
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
      <CreateOrgProgress activeStep={activeStep} steps={OrgSteps} />
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
      {activeStep === 2 && (
        <SpecialityStep
          prevStep={prevStep}
          specialities={specialities}
          setSpecialities={setSpecialities}
        />
      )}
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
