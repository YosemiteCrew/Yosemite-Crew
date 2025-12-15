"use client";
import React, { useEffect, useState } from "react";
import { HiShoppingBag } from "react-icons/hi2";
import { IoLocationSharp } from "react-icons/io5";
import { FaSuitcaseMedical } from "react-icons/fa6";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import CreateOrgProgress from "@/app/components/Steps/Progress/Progress";
import OrgStep from "@/app/components/Steps/CreateOrg/OrgStep";
import AddressStep from "@/app/components/Steps/CreateOrg/AddressStep";
import SpecialityStep from "@/app/components/Steps/CreateOrg/SpecialityStep";
import { Organisation, Speciality } from "@yosemite-crew/types";
import { useOrgOnboarding } from "@/app/hooks/useOrgOnboarding";
import { useRouter, useSearchParams } from "next/navigation";

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

const EMPTY_ORG: Organisation = {
  _id: "",
  isActive: false,
  isVerified: false,
  imageURL: "",
  name: "",
  type: "HOSPITAL",
  DUNSNumber: "",
  phoneNo: "",
  taxId: "",
  website: "",
  healthAndSafetyCertNo: "",
  animalWelfareComplianceCertNo: "",
  fireAndEmergencyCertNo: "",
  googlePlacesId: "",
  address: {
    addressLine: "",
    country: "",
    city: "",
    state: "",
    postalCode: "",
    latitude: 0,
    longitude: 0,
  },
};

const CreateOrg = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgIdFromQuery = searchParams.get("orgId");

  const {
    org,
    step: computedStep,
    specialities: storeSpecialities,
  } = useOrgOnboarding(orgIdFromQuery);

  const [activeStep, setActiveStep] = useState<number>(computedStep);
  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [formData, setFormData] = useState<Organisation>(EMPTY_ORG);

  useEffect(() => {
    if (computedStep === 3) {
      router.replace("/dashboard");
      return;
    }
    if (computedStep >= 0 && computedStep <= 2) {
      setActiveStep(computedStep);
    }
    if (org) {
      setFormData(org);
    }
    if (storeSpecialities.length > 0) {
      setSpecialities(storeSpecialities);
    }
  }, [org, storeSpecialities, computedStep]);

  const nextStep = () =>
    setActiveStep((s) => Math.min(s + 1, OrgSteps.length - 1));
  const prevStep = () => setActiveStep((s) => Math.max(s - 1, 0));

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
