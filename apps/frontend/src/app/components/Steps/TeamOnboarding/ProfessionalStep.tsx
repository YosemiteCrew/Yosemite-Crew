import React, { useState } from "react";
import { Primary, Secondary } from "../../Buttons";
import FormInput from "../../Inputs/FormInput/FormInput";
import FileInput from "../../Inputs/FileInput/FileInput";
import { UserProfile } from "@/app/types/profile";

import "./Step.css";
import { updateUserProfile } from "@/app/services/profileService";

type ProfessionalStepProps = {
  nextStep: () => void;
  prevStep: () => void;
  formData: UserProfile;
  setFormData: React.Dispatch<React.SetStateAction<UserProfile>>;
  orgIdFromQuery: string | null
};

const ProfessionalStep = ({
  nextStep,
  prevStep,
  formData,
  setFormData,
  orgIdFromQuery
}: ProfessionalStepProps) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    yearsExperience?: string;
    specialisation?: string;
    qualification?: string;
  }>({});

  const handleNext = async () => {
    const errors: {
      yearsExperience?: string;
      specialisation?: string;
      qualification?: string;
    } = {};
    if (!formData.professionalDetails?.yearsOfExperience)
      errors.yearsExperience = "Years of experience is required";
    if (!formData.professionalDetails?.specialization)
      errors.specialisation = "Specialisation is required";
    if (!formData.professionalDetails?.qualification)
      errors.qualification = "Qualification is required";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await updateUserProfile(formData, orgIdFromQuery);
      nextStep();
    } catch (error: any) {
      console.error("Error updating profile:", error);
    }
  };

  return (
    <div className="team-container">
      <div className="team-title">Professional details</div>

      <div className="team-personal-container">
        <FormInput
          intype="text"
          inname="linkedin"
          value={formData.professionalDetails?.linkedin || ""}
          inlabel="LinkedIn"
          onChange={(e) =>
            setFormData({
              ...formData,
              professionalDetails: {
                ...formData.professionalDetails,
                linkedin: e.target.value,
              },
            })
          }
        />
        <div className="team-personal-two">
          <FormInput
            intype="text"
            inname="license number"
            value={formData.professionalDetails?.medicalLicenseNumber || ""}
            inlabel="Medical license number (optional)"
            onChange={(e) =>
              setFormData({
                ...formData,
                professionalDetails: {
                  ...formData.professionalDetails,
                  medicalLicenseNumber: e.target.value,
                },
              })
            }
          />
          <FormInput
            intype="number"
            inname="Years of experience"
            value={formData.professionalDetails?.yearsOfExperience + ""}
            inlabel="Years of experience"
            onChange={(e) =>
              setFormData({
                ...formData,
                professionalDetails: {
                  ...formData.professionalDetails,
                  yearsOfExperience: Number(e.target.value),
                },
              })
            }
            error={formDataErrors.yearsExperience}
          />
        </div>
        <FormInput
          intype="text"
          inname="Specialisation"
          value={formData.professionalDetails?.specialization || ""}
          inlabel="Specialisation"
          onChange={(e) =>
            setFormData({
              ...formData,
              professionalDetails: {
                ...formData.professionalDetails,
                specialization: e.target.value,
              },
            })
          }
          error={formDataErrors.specialisation}
        />
        <FormInput
          intype="text"
          inname="Qualification"
          value={formData.professionalDetails?.qualification || ""}
          inlabel="Qualification (MBBS, MD, etc.)"
          onChange={(e) =>
            setFormData({
              ...formData,
              professionalDetails: {
                ...formData.professionalDetails,
                qualification: e.target.value,
              },
            })
          }
          error={formDataErrors.qualification}
        />
        <FormInput
          intype="text"
          inname="Biography"
          value={formData.professionalDetails?.biography || ""}
          inlabel="Biography or short description (optional)"
          onChange={(e) =>
            setFormData({
              ...formData,
              professionalDetails: {
                ...formData.professionalDetails,
                biography: e.target.value,
              },
            })
          }
        />
        <FileInput />
      </div>

      <div className="team-buttons">
        <Secondary
          href="#"
          text="Back"
          style={{ width: "160px" }}
          onClick={() => prevStep()}
        />
        <Primary
          href="#"
          text="Next"
          style={{ width: "160px" }}
          onClick={handleNext}
        />
      </div>
    </div>
  );
};

export default ProfessionalStep;
