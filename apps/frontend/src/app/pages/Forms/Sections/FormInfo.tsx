import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Modal from "@/app/components/Modal";
import {
  FormsCategoryOptions,
  FormsProps,
  FormsUsageOptions,
} from "@/app/types/forms";
import React from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { flatServices } from "../../Organization/demo";

type FormInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeForm: FormsProps;
};

const DetailsFields = [
  { label: "Form name", key: "name", type: "text" },
  { label: "Description", key: "descrition", type: "text" },
  {
    label: "Category",
    key: "category",
    type: "dropdown",
    options: FormsCategoryOptions,
  },
];

const UsageFields = [
  {
    label: "Visibility type",
    key: "usage",
    type: "dropdown",
    options: FormsUsageOptions,
  },
  {
    label: "Service",
    key: "services",
    type: "multiSelect",
    options: flatServices,
  },
  {
    label: "Species",
    key: "species",
    type: "multiSelect",
    options: ["Dog", "Cat", "Horse"],
  },
];

const FormInfo = ({ showModal, setShowModal, activeForm }: FormInfoProps) => {
  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            View form
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-6 w-full flex-1 justify-between">
          <div className="flex flex-col gap-6">
            <EditableAccordion
              title="Form details"
              fields={DetailsFields}
              data={activeForm}
              defaultOpen={true}
            />
            <EditableAccordion
              title="Usage & visibility"
              fields={UsageFields}
              data={activeForm}
              defaultOpen={true}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FormInfo;
