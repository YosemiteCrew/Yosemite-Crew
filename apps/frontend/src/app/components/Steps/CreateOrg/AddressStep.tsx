import React, { useState } from "react";
import { Primary, Secondary } from "@/app/components/Buttons";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";

import "./Step.css";

const AddressStep = ({ nextStep, prevStep, formData, setFormData }: any) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    address?: string;
    area?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }>({});

  const handleNext = () => {
    const errors: {
      address?: string;
      area?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    } = {};
    if (!formData.address) errors.address = "Address is required";
    if (!formData.area) errors.area = "Area is required";
    if (!formData.city) errors.city = "City is required";
    if (!formData.state) errors.state = "State is required";
    if (!formData.postalCode) errors.postalCode = "PostalCode is required";

    setFormDataErrors(errors);

    // if (Object.keys(errors).length > 0) {
    //   return;
    // }

    nextStep();
  };

  return (
    <div className="step-container">
      <div className="step-title">Address</div>

      <div className="step-inputs">
        <FormInput
          intype="text"
          inname="nameaddres line"
          value={formData.address}
          inlabel="Address line 1"
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          error={formDataErrors.address}
        />
        <div className="step-two-input">
          <FormInput
            intype="text"
            inname="area"
            value={formData.area}
            inlabel="Area"
            onChange={(e) => setFormData({ ...formData, area: e.target.value })}
            error={formDataErrors.area}
          />
          <FormInput
            intype="text"
            inname="state"
            value={formData.state}
            inlabel="State/Province"
            onChange={(e) =>
              setFormData({ ...formData, state: e.target.value })
            }
            error={formDataErrors.state}
          />
        </div>
        <div className="step-two-input">
          <FormInput
            intype="text"
            inname="city"
            value={formData.city}
            inlabel="City"
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            error={formDataErrors.city}
          />
          <FormInput
            intype="text"
            inname="postal code"
            value={formData.postalCode}
            inlabel="Postal code"
            onChange={(e) =>
              setFormData({ ...formData, postalCode: e.target.value })
            }
            error={formDataErrors.postalCode}
          />
        </div>
      </div>

      <div className="step-buttons">
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

export default AddressStep;
