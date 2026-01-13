import React, { useEffect, useMemo, useState } from "react";
import FormInput from "../../Inputs/FormInput/FormInput";
import { Primary } from "../../Buttons";
import Accordion from "../../Accordion/Accordion";
import Datepicker from "../../Inputs/Datepicker";
import { StoredParent } from "@/app/pages/Companions/types";
import { getCountryCode, validatePhone } from "@/app/utils/validators";
import SearchDropdown from "../../Inputs/SearchDropdown";
import { searchParent } from "@/app/services/companionService";
import { Icon } from "@iconify/react/dist/iconify.js";
import LabelDropdown from "../../Inputs/Dropdown/LabelDropdown";
import { CountriesOptions } from "../type";

type OptionProp = {
  key: string;
  value: string;
};

type ParentProps = {
  setActiveLabel: React.Dispatch<React.SetStateAction<string>>;
  formData: StoredParent;
  setFormData: React.Dispatch<React.SetStateAction<StoredParent>>;
};

const Parent = ({ setActiveLabel, formData, setFormData }: ParentProps) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    firstName?: string;
    email?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    country?: string;
    addressLine?: string;
    city?: string;
    postalCode?: string;
    state?: string;
  }>({});
  const [currentDate, setCurrentDate] = useState<Date | null>(
    formData.birthDate ? new Date(formData.birthDate) : null
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StoredParent[]>([]);

  const options: OptionProp[] = useMemo(
    () =>
      results.map((p) => {
        const lastName = p.lastName ? ` ${p.lastName}` : "";
        return {
          key: p.id,
          value: `${p.firstName}${lastName}`,
        };
      }),
    [results]
  );

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = globalThis.setTimeout(async () => {
      try {
        const parents = await searchParent(q);
        setResults(parents);
      } catch (e) {
        console.error(e);
        setResults([]);
      }
    }, 300);
    return () => globalThis.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setFormData({
      ...formData,
      birthDate: currentDate ?? undefined,
    });
  }, [currentDate]);

  const handleNext = () => {
    const errors: {
      firstName?: string;
      email?: string;
      phoneNumber?: string;
      dateOfBirth?: string;
      country?: string;
      addressLine?: string;
      city?: string;
      postalCode?: string;
      state?: string;
    } = {};
    if (!formData.firstName) errors.firstName = "First name is required";
    if (!formData.email) errors.email = "Email is required";
    if (!formData.phoneNumber) errors.phoneNumber = "Number is required";
    if (!formData.birthDate) errors.dateOfBirth = "Date of birth is required";
    if (!formData.address.country) errors.country = "Country is required";
    if (!formData.address.addressLine)
      errors.addressLine = "Address is required";
    if (!formData.address.city) errors.city = "City is required";
    if (!formData.address.postalCode)
      errors.postalCode = "Postal code is required";
    if (!formData.address.state) errors.state = "State is required";
    const selectedCountry = getCountryCode(formData.address.country);
    if (!validatePhone(formData.phoneNumber || "")) {
      if (selectedCountry) {
        const countryCode = selectedCountry.dial_code;
        const fullMobile = countryCode + formData.phoneNumber;
        if (!validatePhone(fullMobile)) {
          errors.phoneNumber = "Valid number is required";
        }
      } else {
        errors.phoneNumber = "Valid number is required";
      }
    }

    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setActiveLabel("companion");
    setFormDataErrors({});
  };

  const handleSelect = (parentId: string) => {
    const selected = results.find((p) => p.id === parentId);
    if (!selected) return;
    setFormData(selected);
    setCurrentDate(new Date(selected.birthDate || "2025-10-23"));
    const lastName = selected.lastName ? ` ${selected.lastName}` : "";
    setQuery(`${selected.firstName}${lastName}`);
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <div className="font-grotesk text-black-text text-[23px] font-medium">
          Parents details
        </div>

        <SearchDropdown
          placeholder="Search parent"
          options={options}
          onSelect={handleSelect}
          query={query}
          setQuery={setQuery}
        />

        <Accordion
          title="Parents details"
          defaultOpen
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="name"
                value={formData.firstName}
                inlabel="Parent's name"
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                error={formDataErrors.firstName}
                className="min-h-12!"
              />
              <FormInput
                intype="text"
                inname="name"
                value={formData.lastName || ""}
                inlabel="Last name (Optional)"
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="min-h-12!"
              />
            </div>
            <FormInput
              intype="email"
              inname="email"
              value={formData.email}
              inlabel="Email"
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              error={formDataErrors.email}
              className="min-h-12!"
            />
            <FormInput
              intype="tel"
              inname="number"
              value={formData.phoneNumber || ""}
              inlabel="Phone number"
              onChange={(e) =>
                setFormData({ ...formData, phoneNumber: e.target.value })
              }
              error={formDataErrors.phoneNumber}
              className="min-h-12!"
            />
            <div className="flex flex-col gap-1">
              <Datepicker
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                type="input"
                className="min-h-12!"
                containerClassName="w-full"
                placeholder="Date of birth"
              />
              {formDataErrors.dateOfBirth && (
                <div className="Errors">
                  <Icon icon="mdi:error" width="16" height="16" />
                  {formDataErrors.dateOfBirth}
                </div>
              )}
            </div>
            <LabelDropdown
              placeholder="Choose country"
              onSelect={(option) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, country: option.key },
                })
              }
              defaultOption={formData.address.country}
              options={CountriesOptions}
            />
            <FormInput
              intype="text"
              inname="address line"
              value={formData.address.addressLine || ""}
              inlabel="Address"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, addressLine: e.target.value },
                })
              }
              error={formDataErrors.addressLine}
              className="min-h-12!"
            />
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="city"
                value={formData.address.city || ""}
                inlabel="City"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, city: e.target.value },
                  })
                }
                error={formDataErrors.city}
                className="min-h-12!"
              />
              <FormInput
                intype="text"
                inname="state"
                value={formData.address.state || ""}
                inlabel="State/Province"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, state: e.target.value },
                  })
                }
                error={formDataErrors.state}
                className="min-h-12!"
              />
            </div>
            <FormInput
              intype="text"
              inname="postal code"
              value={formData.address.postalCode || ""}
              inlabel="Postal code"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, postalCode: e.target.value },
                })
              }
              error={formDataErrors.postalCode}
              className="min-h-12!"
            />
          </div>
        </Accordion>
      </div>

      <Primary
        href="#"
        text="Next"
        onClick={handleNext}
        classname="max-h-12! text-lg! tracking-wide!"
      />
    </div>
  );
};

export default Parent;
