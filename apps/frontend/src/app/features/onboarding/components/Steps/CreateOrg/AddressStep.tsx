import React, { useState } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';
import { Organisation } from '@yosemite-crew/types';
import { validateOrgAddress } from '@/app/lib/organizationOnboardingValidation';

import './Step.css';

type AddressStepProps = {
  errors?: {
    address?: string;
    appointmentCheckInBufferMinutes?: string;
    appointmentCheckInRadiusMeters?: string;
    city?: string;
    country?: string;
    state?: string;
    postalCode?: string;
  };
  nextStep: () => void;
  prevStep: () => void;
  formData: Organisation;
  setFormData: React.Dispatch<React.SetStateAction<Organisation>>;
};

const AddressStep = ({ errors, nextStep, prevStep, formData, setFormData }: AddressStepProps) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    address?: string;
    appointmentCheckInBufferMinutes?: string;
    appointmentCheckInRadiusMeters?: string;
    city?: string;
    country?: string;
    state?: string;
    postalCode?: string;
  }>({});

  React.useEffect(() => {
    if (!errors) {
      return;
    }
    setFormDataErrors(errors);
  }, [errors]);

  const handleNext = () => {
    const { errors, normalizedData } = validateOrgAddress(formData);
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setFormData(normalizedData);
    nextStep();
  };

  return (
    <div className="step-container">
      <div className="step-title">Address</div>

      <div className="step-inputs">
        <GoogleSearchDropDown
          intype="text"
          inname="addressLine"
          value={formData.address?.addressLine || ''}
          inlabel="Address line"
          onChange={(e) => {
            setFormData({
              ...formData,
              address: { ...formData.address, addressLine: e.target.value },
            });
            setFormDataErrors((prev) => ({ ...prev, address: undefined }));
          }}
          error={formDataErrors.address}
          onlyAddress={true}
          onAddressSelect={(address) =>
            setFormData((prev) => ({
              ...prev,
              address: {
                ...prev.address,
                addressLine: address.addressLine,
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                ...(address.country ? { country: address.country } : {}),
              },
            }))
          }
        />
        <div className="step-two-input">
          <FormInput
            intype="text"
            inname="city"
            value={formData.address?.city || ''}
            inlabel="City"
            onChange={(e) => {
              setFormData({
                ...formData,
                address: { ...formData.address, city: e.target.value },
              });
              setFormDataErrors((prev) => ({ ...prev, city: undefined }));
            }}
            error={formDataErrors.city}
          />
          <FormInput
            intype="text"
            inname="state"
            value={formData.address?.state || ''}
            inlabel="State/Province"
            onChange={(e) => {
              setFormData({
                ...formData,
                address: { ...formData.address, state: e.target.value },
              });
              setFormDataErrors((prev) => ({ ...prev, state: undefined }));
            }}
            error={formDataErrors.state}
          />
        </div>
        <FormInput
          intype="text"
          inname="postal code"
          value={formData.address?.postalCode || ''}
          inlabel="Postal code"
          onChange={(e) => {
            setFormData({
              ...formData,
              address: { ...formData.address, postalCode: e.target.value },
            });
            setFormDataErrors((prev) => ({ ...prev, postalCode: undefined }));
          }}
          error={formDataErrors.postalCode}
        />
        <div className="step-two-input">
          <FormInput
            intype="number"
            inname="appointment-checkin-buffer-minutes"
            value={String(formData.appointmentCheckInBufferMinutes ?? 5)}
            inlabel="Check-in opens (minutes before appointment)"
            onChange={(e) => {
              setFormData({
                ...formData,
                appointmentCheckInBufferMinutes: Number(e.target.value || 0),
              });
              setFormDataErrors((prev) => ({
                ...prev,
                appointmentCheckInBufferMinutes: undefined,
              }));
            }}
            error={formDataErrors.appointmentCheckInBufferMinutes}
          />
          <FormInput
            intype="number"
            inname="appointment-checkin-radius-meters"
            value={String(formData.appointmentCheckInRadiusMeters ?? 200)}
            inlabel="Check-in radius (meters)"
            onChange={(e) => {
              setFormData({
                ...formData,
                appointmentCheckInRadiusMeters: Number(e.target.value || 0),
              });
              setFormDataErrors((prev) => ({
                ...prev,
                appointmentCheckInRadiusMeters: undefined,
              }));
            }}
            error={formDataErrors.appointmentCheckInRadiusMeters}
          />
        </div>
      </div>

      <div className="step-buttons">
        <Secondary href="#" text="Back" style={{ width: '160px' }} onClick={prevStep} />
        <Primary href="#" text="Next" style={{ width: '160px' }} onClick={handleNext} />
      </div>
    </div>
  );
};

export default AddressStep;
