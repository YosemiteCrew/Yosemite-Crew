import React, { useState } from "react";
import FormInput from "../../Inputs/FormInput/FormInput";
import Dropdown from "../../Inputs/Dropdown/Dropdown";
import { Primary } from "../../Buttons";
import DateInput from "../../Inputs/Date/DateInput";
import Accordion from "../../Accordion/Accordion";

type ParentForm = {
  name: string;
  email: string;
  phone: string;
  dob: Date | null;
  country: string;
  address: string;
  city: string;
  postalCode: string;
  area: string;
  state: string;
  coName: string;
  coEmail: string;
  coPhone: string;
};

const Parent = () => {
  const [formData, setFormData] = useState<ParentForm>({
    name: "",
    email: "",
    phone: "",
    dob: new Date(),
    country: "",
    address: "",
    city: "",
    postalCode: "",
    area: "",
    state: "",
    coName: "",
    coEmail: "",
    coPhone: "",
  });
  const [formDataErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    dob?: string;
    country?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    area?: string;
    state?: string;
  }>({});

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <div className="font-grotesk text-black-text text-[23px] font-medium">
          Parents details
        </div>
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
                value={formData.name}
                inlabel="Parent's name"
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                error={formDataErrors.name}
                className="min-h-12!"
              />
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
            </div>
            <FormInput
              intype="tel"
              inname="number"
              value={formData.phone}
              inlabel="Phone number"
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              error={formDataErrors.phone}
              className="min-h-12!"
            />
            <DateInput
              value={formData.dob}
              onChange={(e) => setFormData({ ...formData, dob: e })}
            />
            <Dropdown
              placeholder="Choose country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e })}
              error={formDataErrors.country}
              className="min-h-12!"
              type="country"
            />
            <FormInput
              intype="text"
              inname="address line"
              value={formData.address}
              inlabel="Address"
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              error={formDataErrors.address}
              className="min-h-12!"
            />
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="area"
                value={formData.area}
                inlabel="Area"
                onChange={(e) =>
                  setFormData({ ...formData, area: e.target.value })
                }
                error={formDataErrors.area}
                className="min-h-12!"
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
                className="min-h-12!"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="city"
                value={formData.city}
                inlabel="City"
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                error={formDataErrors.city}
                className="min-h-12!"
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
                className="min-h-12!"
              />
            </div>
          </div>
        </Accordion>
        <Accordion
          title="Co-parent details (optional)"
          defaultOpen
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="Co-parent’s Name"
                value={formData.coName}
                inlabel="Co-parent’s name"
                onChange={(e) =>
                  setFormData({ ...formData, coName: e.target.value })
                }
                className="min-h-12!"
              />
              <FormInput
                intype="email"
                inname="email"
                value={formData.coEmail}
                inlabel="Email"
                onChange={(e) =>
                  setFormData({ ...formData, coEmail: e.target.value })
                }
                className="min-h-12!"
              />
            </div>
            <FormInput
              intype="tel"
              inname="number"
              value={formData.coPhone}
              inlabel="Phone number"
              onChange={(e) =>
                setFormData({ ...formData, coPhone: e.target.value })
              }
              className="min-h-12!"
            />
          </div>
        </Accordion>
      </div>

      <Primary
        href="#"
        text="Save"
        classname="max-h-12! text-lg! tracking-wide!"
      />
    </div>
  );
};

export default Parent;
