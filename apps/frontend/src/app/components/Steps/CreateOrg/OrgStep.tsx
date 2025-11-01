import React, { useState } from "react";
import { IoCamera } from "react-icons/io5";
import { FiMinusCircle } from "react-icons/fi";
import classNames from "classnames";
import FormInput from "../../Inputs/FormInput/FormInput";
import CountryDropdown from "../../Inputs/CountryDropdown/CountryDropdown";
import { Primary, Secondary } from "../../Buttons";

import "./Step.css";
import OrgSearch from "../../Inputs/OrgSearch/OrgSearch";

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
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState(businessTypes[0].key);
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    country?: string;
    number?: string;
    taxId?: string;
  }>({});

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setPreview(null);
  };

  const handleNext = () => {
    console.log(image);
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

    nextStep();
  };

  return (
    <div className="step-container">
      <div className="step-title">Organisation</div>

      <div className="step-logo-container">
        <div className="step-logo-upload">
          {preview ? (
            <>
              <img
                src={preview}
                alt="Logo Preview"
                style={{
                  width: 100,
                  height: 100,
                  objectFit: "cover",
                  borderRadius: "50%",
                }}
                className="step-logo-preview"
              />
              <button className="remove-icon" onClick={handleRemoveImage}>
                <FiMinusCircle color="#247AED" size={16} />
              </button>
            </>
          ) : (
            <>
              <input
                type="file"
                id="logo-upload"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />
              <label htmlFor="logo-upload" style={{ cursor: "pointer" }}>
                <IoCamera color="#247AED" size={40} />
              </label>
            </>
          )}
        </div>
        <div className="step-logo-title">Add logo (optional)</div>
      </div>

      <div className="step-type">
        <div className="step-type-title">Select your organisation type</div>
        <div className="step-type-options">
          {businessTypes.map((type) => (
            <button
              key={type.name}
              className={classNames("step-type-option", {
                activetype: selectedType === type.key,
              })}
              onClick={() => setSelectedType(type.key)}
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
        <OrgSearch
          intype="text"
          inname="name"
          value={formData.name}
          inlabel="Organisation name"
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
