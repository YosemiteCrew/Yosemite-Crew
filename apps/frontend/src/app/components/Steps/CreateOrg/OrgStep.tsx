import React, { useState } from "react";
import classNames from "classnames";

import FormInput from "../../Inputs/FormInput/FormInput";
import Dropdown from "../../Inputs/Dropdown/Dropdown";
import GoogleSearchDropDown from "../../Inputs/GoogleSearchDropDown/GoogleSearchDropDown";
import { Primary, Secondary } from "../../Buttons";
import LogoUploader from "../../UploadImage/LogoUploader";
import { BusinessTypes } from "@/app/types/org";
import { getCountryCode, validatePhone } from "@/app/utils/validators";
import { createOrg } from "@/app/services/orgService";
import { Organisation } from "@yosemite-crew/types";

import "./Step.css";

type OrgStepProps = {
  nextStep: () => void;
  formData: Organisation;
  setFormData: React.Dispatch<React.SetStateAction<Organisation>>;
};

const OrgStep = ({ nextStep, formData, setFormData }: OrgStepProps) => {
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
    if (!formData.address?.country) errors.country = "Country is required";
    if (!formData.phoneNo) errors.number = "Number is required";
    if (!formData.taxId) errors.taxId = "TaxID is required";
    const selectedCountry = getCountryCode(formData.address?.country);
    if (selectedCountry) {
      const countryCode = selectedCountry.dial_code;
      const fullMobile = countryCode + formData.phoneNo;
      if (!validatePhone(fullMobile)) {
        errors.number = "Valid number is required";
      }
    } else {
      errors.number = "Valid number is required";
    }
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await createOrg(formData)
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
          {BusinessTypes.map((type) => (
            <button
              key={type}
              className={classNames("step-type-option", {
                activetype: formData.type === type,
              })}
              onClick={() => setFormData({ ...formData, type: type })}
            >
              {type.charAt(0) + type.toLowerCase().slice(1)}
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
          <Dropdown
            placeholder="Select country"
            value={formData.address?.country || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                address: { ...formData.address, postalCode: e },
              })
            }
            error={formDataErrors.country}
            type="country"
            dropdownClassName="h-fit! max-h-[200px]!"
            search
          />
          <FormInput
            intype="text"
            inname="duns"
            value={formData.DUNSNumber || ""}
            inlabel="DUNS number (optional)"
            onChange={(e) =>
              setFormData({ ...formData, DUNSNumber: e.target.value })
            }
          />
        </div>

        <div className="step-two-input">
          <FormInput
            intype="tel"
            inname="number"
            value={formData.phoneNo || ""}
            inlabel="Phone number"
            onChange={(e) =>
              setFormData({ ...formData, phoneNo: e.target.value })
            }
            error={formDataErrors.number}
          />
          <FormInput
            intype="text"
            inname="tax id"
            value={formData.taxId || ""}
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
          value={formData.website || ""}
          inlabel="Website (optional)"
          onChange={(e) =>
            setFormData({ ...formData, website: e.target.value })
          }
        />
        <FormInput
          intype="text"
          inname="Health & Safety Certification"
          value={formData.healthAndSafetyCertNo || ""}
          inlabel="Health & Safety Certification (optional)"
          onChange={(e) =>
            setFormData({
              ...formData,
              healthAndSafetyCertNo: e.target.value,
            })
          }
        />
        <FormInput
          intype="text"
          inname="Animal Welfare Compliance"
          value={formData.animalWelfareComplianceCertNo || ""}
          inlabel="Animal Welfare Compliance (optional)"
          onChange={(e) =>
            setFormData({
              ...formData,
              animalWelfareComplianceCertNo: e.target.value,
            })
          }
        />
        <FormInput
          intype="text"
          inname="Fire & Emergency compliance"
          value={formData.fireAndEmergencyCertNo || ""}
          inlabel="Fire & Emergency compliance (optional)"
          onChange={(e) =>
            setFormData({
              ...formData,
              fireAndEmergencyCertNo: e.target.value,
            })
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
