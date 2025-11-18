import React, { useState } from "react";
import classNames from "classnames";
import FormInput from "../../Inputs/FormInput/FormInput";
import CountryDropdown from "../../Inputs/CountryDropdown/CountryDropdown";
import GoogleSearchDropDown from "../../Inputs/GoogleSearchDropDown/GoogleSearchDropDown";
import { Primary, Secondary } from "../../Buttons";
import LogoUploader from "../../UploadImage/LogoUploader";
import { convertOrgToFHIR } from "@/app/utils/fhir";

import "./Step.css";

const businessTypes = [
  {
    name: "Hospital",
    key: "Hospital",
  },
  {
    name: "Breeder",
    key: "Breeder",
  },
  {
    name: "Boarder",
    key: "Boarder",
  },
  {
    name: "Groomer",
    key: "Groomer",
  },
];

const OrgStep = ({ nextStep, formData, setFormData }: any) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    country?: string;
    number?: string;
    taxId?: string;
  }>({});

  const handleNext = async () => {
    const errors: {
      name?: string;
      country?: string;
      number?: string;
      taxId?: string;
    } = {};
    if (!formData.name) errors.name = "Name is required";
    if (!formData.country) errors.country = "Country is required";
    if (!formData.number) errors.number = "Number is required";
    if (!formData.taxId) errors.taxId = "TaxID is required";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      const fhirPayload = convertOrgToFHIR(formData);
      console.log(fhirPayload);
      nextStep();
    } catch (error: any) {
      console.error("Error creating organization:", error);
    }
  };

  return (
    <div className="step-container">
      <div className="step-title">Organisation</div>

      <LogoUploader
        title="Add logo (optional)"
        apiUrl="/fhir/v1/organization/logo/presigned-url"
        setFormData={setFormData}
      />

      <div className="step-type">
        <div className="step-type-title">Select your organisation type</div>
        <div className="step-type-options">
          {businessTypes.map((type) => (
            <button
              key={type.name}
              className={classNames("step-type-option", {
                activetype: formData.businessType === type.key,
              })}
              onClick={() =>
                setFormData({ ...formData, businessType: type.key })
              }
            >
              {type.name}
            </button>
          ))}
        </div>
        <div className="step-type-desc">
          <span className="step-type-desc-span">Note: </span>This is also
          tailored for small vet practices and clinics
        </div>
      </div>

      <div className="step-inputs">
        <GoogleSearchDropDown
          intype="text"
          inname="name"
          value={formData.name}
          inlabel="Organisation name"
          onChange={(e: any) =>
            setFormData({ ...formData, name: e.target.value })
          }
          error={formDataErrors.name}
          setFormData={setFormData}
        />
        <div className="step-two-input">
          <CountryDropdown
            placeholder="Select country"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e })}
            error={formDataErrors.country}
          />
          <FormInput
            intype="text"
            inname="duns"
            value={formData.duns}
            inlabel="DUNS number (optional)"
            onChange={(e) => setFormData({ ...formData, duns: e.target.value })}
          />
        </div>
        <div className="step-two-input">
          <FormInput
            intype="tel"
            inname="number"
            value={formData.number}
            inlabel="Phone number"
            onChange={(e) =>
              setFormData({ ...formData, number: e.target.value })
            }
            error={formDataErrors.number}
          />
          <FormInput
            intype="text"
            inname="tax id"
            value={formData.taxId}
            inlabel="Tax ID"
            onChange={(e) =>
              setFormData({ ...formData, taxId: e.target.value })
            }
            error={formDataErrors.taxId}
          />
        </div>
        <FormInput
          intype="text"
          inname="website"
          value={formData.website}
          inlabel="Website (optional)"
          onChange={(e) =>
            setFormData({ ...formData, website: e.target.value })
          }
        />
        <FormInput
          intype="text"
          inname="Health & Safety Certification"
          value={formData.healthCertficate}
          inlabel="Health & Safety Certification (optional)"
          onChange={(e) =>
            setFormData({ ...formData, healthCertficate: e.target.value })
          }
        />
        <FormInput
          intype="text"
          inname="Animal Welfare Compliance"
          value={formData.animalWelfareCompliance}
          inlabel="Animal Welfare Compliance (optional)"
          onChange={(e) =>
            setFormData({
              ...formData,
              animalWelfareCompliance: e.target.value,
            })
          }
        />
        <FormInput
          intype="text"
          inname="Fire & Emergency compliance"
          value={formData.fireCompliance}
          inlabel="Fire & Emergency compliance (optional)"
          onChange={(e) =>
            setFormData({ ...formData, fireCompliance: e.target.value })
          }
        />
      </div>

      <div className="step-buttons">
        <Secondary
          href="/organizations"
          text="Back"
          style={{ width: "160px" }}
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

export default OrgStep;
