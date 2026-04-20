import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import { UserProfile } from '@/app/features/users/types/profile';
import { updateUserProfile } from '@/app/features/organization/services/profileService';

import './Step.css';
import type { StepHandle } from './PersonalStep';

type ProfessionalStepProps = {
  nextStep: () => void;
  prevStep: () => void;
  formData: UserProfile;
  setFormData: React.Dispatch<React.SetStateAction<UserProfile>>;
  orgIdFromQuery: string | null;
  isSaving: boolean;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
};

type ProfessionalStepErrors = {
  yearsExperience?: string;
  specialisation?: string;
  qualification?: string;
  linkedin?: string;
};

const LINKEDIN_PATTERN = /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?$/;

const buildProfessionalErrors = (formData: UserProfile): ProfessionalStepErrors => {
  const errors: ProfessionalStepErrors = {};
  const prof = formData.professionalDetails;

  const linkedin = prof?.linkedin?.trim();
  if (linkedin && !LINKEDIN_PATTERN.test(linkedin)) {
    errors.linkedin = 'Enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/yourname)';
  }

  const years = prof?.yearsOfExperience;
  if (years === undefined || years === null || String(years) === '') {
    errors.yearsExperience = 'Years of experience is required';
  } else if (!Number.isInteger(years) || years < 0 || years > 60) {
    errors.yearsExperience = 'Enter a value between 0 and 60';
  }

  if (!prof?.specialization?.trim()) {
    errors.specialisation = 'Specialisation is required';
  }

  if (!prof?.qualification?.trim()) {
    errors.qualification = 'Qualification is required';
  }

  return errors;
};

const ProfessionalStep = forwardRef<StepHandle, ProfessionalStepProps>(
  ({ nextStep, prevStep, formData, setFormData, orgIdFromQuery, isSaving, setIsSaving }, ref) => {
    const [formDataErrors, setFormDataErrors] = useState<ProfessionalStepErrors>({});

    useImperativeHandle(ref, () => ({
      validate: () => {
        const errors = buildProfessionalErrors(formData);
        setFormDataErrors(errors);
        return Object.keys(errors).length === 0;
      },
    }));

    const handleNext = async () => {
      if (isSaving) return;
      const errors = buildProfessionalErrors(formData);
      setFormDataErrors(errors);
      if (Object.keys(errors).length > 0) {
        return;
      }
      try {
        setIsSaving(true);
        await updateUserProfile(formData, orgIdFromQuery);
        nextStep();
      } catch (error: any) {
        console.error('Error updating profile:', error);
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="team-container">
        <div className="team-title">Professional details</div>

        <div className="team-personal-container">
          <FormInput
            intype="url"
            inname="linkedin"
            value={formData.professionalDetails?.linkedin || ''}
            inlabel="LinkedIn profile URL (optional)"
            onChange={(e) =>
              setFormData({
                ...formData,
                professionalDetails: {
                  ...formData.professionalDetails,
                  linkedin: e.target.value,
                },
              })
            }
            error={formDataErrors.linkedin}
          />

          <div className="team-personal-two">
            <FormInput
              intype="text"
              inname="Specialisation"
              value={formData.professionalDetails?.specialization || ''}
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
              value={formData.professionalDetails?.qualification || ''}
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
          </div>

          <div className="team-personal-two">
            <FormInput
              intype="text"
              inname="license number"
              value={formData.professionalDetails?.medicalLicenseNumber || ''}
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
              value={
                formData.professionalDetails?.yearsOfExperience !== undefined
                  ? String(formData.professionalDetails.yearsOfExperience)
                  : ''
              }
              inlabel="Years of experience"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  professionalDetails: {
                    ...formData.professionalDetails,
                    yearsOfExperience: e.target.value === '' ? undefined : Number(e.target.value),
                  },
                })
              }
              error={formDataErrors.yearsExperience}
            />
          </div>

          <FormDesc
            intype="text"
            inname="Biography"
            value={formData.professionalDetails?.biography || ''}
            inlabel="Short bio (optional)"
            onChange={(e) =>
              setFormData({
                ...formData,
                professionalDetails: {
                  ...formData.professionalDetails,
                  biography: e.target.value,
                },
              })
            }
            className="min-h-28 resize-none"
          />
        </div>

        <div className="team-buttons">
          <Secondary href="#" text="Back" onClick={prevStep} />
          <Primary
            href="#"
            text={isSaving ? 'Saving...' : 'Next'}
            onClick={handleNext}
            isDisabled={isSaving}
          />
        </div>
      </div>
    );
  }
);

ProfessionalStep.displayName = 'ProfessionalStep';

export default ProfessionalStep;
