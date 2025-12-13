import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import {
  LeadOptions,
  SupportOptions,
} from "@/app/components/CompanionInfo/Sections/AddAppointment";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";
import Modal from "@/app/components/Modal";
import { SpecialityOptions } from "@/app/pages/Organization/types";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { CompanionData, CompanionDataOptions } from "../../demo";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Slotpicker from "@/app/components/Inputs/Slotpicker";
import { getFormattedDate } from "@/app/components/Calendar/weekHelpers";

type AddAppointmentProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

type FormDataType = {
  speciality: string;
  service: string;
  concern: string;
  lead: string;
  support: string[];
  companion: string;
  specie: string;
  parent: string;
  breed: string;
  emergency: boolean;
};

const AddAppointment = ({ showModal, setShowModal }: AddAppointmentProps) => {
  const [formData, setFormData] = useState<FormDataType>({
    speciality: "",
    service: "",
    concern: "",
    lead: "",
    support: [],
    companion: "",
    specie: "",
    parent: "",
    breed: "",
    emergency: false,
  });
  const [formDataErrors] = useState<{
    speciality?: string;
    service?: string;
    lead?: string;
    companion?: string;
    specie?: string;
    parent?: string;
    breed?: string;
  }>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [query, setQuery] = useState("");

  const handleCompanionSelect = (id: string) => {
    const selected = CompanionData.find((item) => item.id === id);
    if (!selected) return;
    setFormData((prev) => ({
      ...prev,
      companion: selected.companion,
      specie: selected.specie,
      parent: selected.parent,
      breed: selected.breed,
    }));
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex items-center justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            Add appointment
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
          <div className="flex flex-col gap-6 w-full">
            <Accordion
              title="Companion details"
              defaultOpen
              showEditIcon={false}
              isEditing={true}
            >
              <div className="flex flex-col gap-3">
                <SearchDropdown
                  placeholder="Search companion or parent"
                  options={CompanionDataOptions}
                  onSelect={handleCompanionSelect}
                  query={query}
                  setQuery={setQuery}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    intype="text"
                    inname="companion"
                    value={formData.companion}
                    inlabel="Companion"
                    onChange={(e) =>
                      setFormData({ ...formData, companion: e.target.value })
                    }
                    error={formDataErrors.companion}
                    className="min-h-12!"
                  />
                  <FormInput
                    intype="text"
                    inname="parent"
                    value={formData.parent}
                    inlabel="Parent"
                    onChange={(e) =>
                      setFormData({ ...formData, parent: e.target.value })
                    }
                    error={formDataErrors.parent}
                    className="min-h-12!"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    intype="text"
                    inname="specie"
                    value={formData.specie}
                    inlabel="Species"
                    onChange={(e) =>
                      setFormData({ ...formData, specie: e.target.value })
                    }
                    error={formDataErrors.specie}
                    className="min-h-12!"
                  />
                  <FormInput
                    intype="text"
                    inname="breed"
                    value={formData.breed}
                    inlabel="Breed"
                    onChange={(e) =>
                      setFormData({ ...formData, breed: e.target.value })
                    }
                    error={formDataErrors.breed}
                    className="min-h-12!"
                  />
                </div>
              </div>
            </Accordion>
            <Accordion
              title="Appointment details"
              showEditIcon={false}
              isEditing={true}
            >
              <div className="flex flex-col gap-3">
                <Dropdown
                  placeholder="Speciality"
                  value={formData.speciality}
                  onChange={(e) => setFormData({ ...formData, speciality: e })}
                  error={formDataErrors.speciality}
                  className="min-h-12!"
                  options={SpecialityOptions}
                  dropdownClassName="h-fit!"
                />
                <Dropdown
                  placeholder="Service"
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e })}
                  error={formDataErrors.service}
                  className="min-h-12!"
                  options={SpecialityOptions}
                  dropdownClassName="h-fit!"
                />
                <FormDesc
                  intype="text"
                  inname="Describe concern"
                  value={formData.concern}
                  inlabel="Describe concern"
                  onChange={(e) =>
                    setFormData({ ...formData, concern: e.target.value })
                  }
                  className="min-h-[120px]!"
                />
              </div>
            </Accordion>
            <Accordion
              title="Select date & time"
              showEditIcon={false}
              isEditing={true}
            >
              <div className="flex flex-col gap-4">
                <Slotpicker
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  selectedTime={selectedTime}
                  setSelectedTime={setSelectedTime}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    intype="text"
                    inname="date"
                    value={getFormattedDate(selectedDate)}
                    inlabel="Date"
                    className="min-h-12!"
                  />
                  <FormInput
                    intype="text"
                    inname="time"
                    value={selectedTime}
                    inlabel="Time"
                    className="min-h-12!"
                  />
                </div>
              </div>
            </Accordion>
            <Accordion
              title="Staff details"
              showEditIcon={false}
              isEditing={true}
            >
              <div className="flex flex-col gap-3">
                <Dropdown
                  placeholder="Lead"
                  value={formData.lead}
                  onChange={(e) => setFormData({ ...formData, lead: e })}
                  error={formDataErrors.lead}
                  className="min-h-12!"
                  options={LeadOptions}
                  dropdownClassName="h-fit!"
                />
                <MultiSelectDropdown
                  placeholder="Support"
                  value={formData.support}
                  onChange={(e) => setFormData({ ...formData, support: e })}
                  error={formDataErrors.lead}
                  className="min-h-12!"
                  options={SupportOptions}
                  dropdownClassName="h-fit!"
                />
              </div>
            </Accordion>
            <Accordion
              title="Billable services"
              showEditIcon={false}
              isEditing={true}
            >
              <div className="flex flex-col gap-3"></div>
            </Accordion>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.emergency}
                onChange={() =>
                  setFormData((prev) => ({
                    ...prev,
                    emergency: !prev.emergency,
                  }))
                }
              />
              <div className="font-satoshi text-black-text text-[16px] font-semibold">
                I confirm this is an emergency.
              </div>
            </div>
          </div>
          <Primary href="#" text="Book appointment" classname="h-13!" />
        </div>
      </div>
    </Modal>
  );
};

export default AddAppointment;
