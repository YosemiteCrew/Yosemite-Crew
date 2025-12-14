import React, { useState } from "react";
import { Primary } from "@/app/components/Buttons";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { updateOrg } from "@/app/services/orgService";
import { Organisation } from "@yosemite-crew/types";

import "./Step.css";

type AddressStepProps = {
  nextStep: () => void;
  prevStep: () => void;
  formData: Organisation;
  setFormData: React.Dispatch<React.SetStateAction<Organisation>>;
};

const AddressStep = ({
  nextStep,
  prevStep,
  formData,
  setFormData,
}: AddressStepProps) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }>({});

  const handleNext = async () => {
    const errors: {
      address?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    } = {};
    if (!formData.address?.addressLine) errors.address = "Address is required";
    if (!formData.address?.city) errors.city = "City is required";
    if (!formData.address?.state) errors.state = "State is required";
    if (!formData.address?.postalCode)
      errors.postalCode = "PostalCode is required";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await updateOrg(formData)
      nextStep();
    } catch (error: any) {
      console.error("Error updating organization:", error);
    }
  };

  return (
    <div className="step-container">
      <div className="step-title">Address</div>

      <div className="step-inputs">
        <FormInput
          intype="text"
          inname="nameaddres line"
          value={formData.address?.addressLine || ""}
          inlabel="Address line 1"
          onChange={(e) =>
            setFormData({
              ...formData,
              address: { ...formData.address, addressLine: e.target.value },
            })
          }
          error={formDataErrors.address}
        />
        <div className="step-two-input">
          <FormInput
            intype="text"
            inname="city"
            value={formData.address?.city || ""}
            inlabel="City"
            onChange={(e) =>
              setFormData({
                ...formData,
                address: { ...formData.address, city: e.target.value },
              })
            }
            error={formDataErrors.city}
          />
          <FormInput
            intype="text"
            inname="state"
            value={formData.address?.state || ""}
            inlabel="State/Province"
            onChange={(e) =>
              setFormData({
                ...formData,
                address: { ...formData.address, state: e.target.value },
              })
            }
            error={formDataErrors.state}
          />
        </div>
        <FormInput
          intype="text"
          inname="postal code"
          value={formData.address?.postalCode || ""}
          inlabel="Postal code"
          onChange={(e) =>
            setFormData({
              ...formData,
              address: { ...formData.address, postalCode: e.target.value },
            })
          }
          error={formDataErrors.postalCode}
        />
      </div>

      <div className="step-buttons w-full justify-end!">
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

export default AddressStep;
