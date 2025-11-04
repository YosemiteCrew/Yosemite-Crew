import React, { useState } from "react";
import { Primary, Secondary } from "../../Buttons";
import FormInput from "../../Inputs/FormInput/FormInput";
import FileInput from "../../Inputs/FileInput/FileInput";

import "./Step.css";

const ProfessionalStep = ({
  nextStep,
  prevStep,
  formData,
  setFormData,
}: any) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    yearsExperience?: string;
    specialisation?: string;
    qualification?: string;
  }>({});

  const handleNext = () => {
    const errors: {
      yearsExperience?: string;
      specialisation?: string;
      qualification?: string;
    } = {};
    if (!formData.yearsExperience)
      errors.yearsExperience = "Years of experience is required";
    if (!formData.specialisation)
      errors.specialisation = "Specialisation is required";
    if (!formData.qualification)
      errors.qualification = "Qualification is required";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    nextStep();
  };

  return (
    <div className="team-container">
      <div className="team-title">Professional details</div>

      <div className="team-personal-container">
        <FormInput
          intype="text"
          inname="linkedin"
          value={formData.linkedin}
          inlabel="LinkedIn"
          onChange={(e) =>
            setFormData({ ...formData, linkedin: e.target.value })
          }
        />
        <div className="team-personal-two">
          <FormInput
            intype="text"
            inname="license number"
            value={formData.licenseNumber}
            inlabel="Medical license number (optional)"
            onChange={(e) =>
              setFormData({ ...formData, licenseNumber: e.target.value })
            }
          />
          <FormInput
            intype="text"
            inname="Years of experience"
            value={formData.yearsExperience}
            inlabel="Years of experience"
            onChange={(e) =>
              setFormData({ ...formData, yearsExperience: e.target.value })
            }
            error={formDataErrors.yearsExperience}
          />
        </div>
        <FormInput
          intype="text"
          inname="Specialisation"
          value={formData.specialisation}
          inlabel="Specialisation"
          onChange={(e) =>
            setFormData({ ...formData, specialisation: e.target.value })
          }
          error={formDataErrors.specialisation}
        />
        <FormInput
          intype="text"
          inname="Qualification"
          value={formData.qualification}
          inlabel="Qualification (MBBS, MD, etc.)"
          onChange={(e) =>
            setFormData({ ...formData, qualification: e.target.value })
          }
          error={formDataErrors.qualification}
        />
        <FormInput
          intype="text"
          inname="Biography"
          value={formData.biography}
          inlabel="Biography or short description (optional)"
          onChange={(e) =>
            setFormData({ ...formData, biography: e.target.value })
          }
        />
        <FormInput
          intype="text"
          inname="UploadCV"
          value={formData.uploadCV}
          inlabel="UploadCV or resume (optional)"
          onChange={(e) =>
            setFormData({ ...formData, uploadCV: e.target.value })
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
