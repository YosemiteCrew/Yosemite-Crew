import SubLabels from "@/app/components/Labels/SubLabels";
import Modal from "@/app/components/Modal";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import Details from "./Details";
import Build from "./Build";
import Review from "./Review";

const Labels = [
  {
    name: "Form details",
    key: "form-details",
  },
  {
    name: "Build form",
    key: "build-form",
  },
  {
    name: "Review",
    key: "review",
  },
];

type AddFormProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const AddForm = ({ showModal, setShowModal }: AddFormProps) => {
  const [activeLabel, setActiveLabel] = useState("form-details");

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
            Add form
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <SubLabels
          labels={Labels}
          activeLabel={activeLabel}
          setActiveLabel={setActiveLabel}
        />

        <div className="flex overflow-y-auto flex-1">
          {activeLabel === "form-details" && <Details />}
          {activeLabel === "build-form" && <Build />}
          {activeLabel === "review" && <Review />}
        </div>
      </div>
    </Modal>
  );
};

export default AddForm;
