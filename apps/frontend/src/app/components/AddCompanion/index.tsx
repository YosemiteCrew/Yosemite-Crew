import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import Parent from "./Forms/Parent";
import Companion from "./Forms/Companion";
import Allergies from "./Forms/Allergies";
import Modal from "../Modal";
import SubLabels from "../Labels/SubLabels";

const Labels = [
  {
    name: "Parents details",
    key: "parents",
  },
  {
    name: "Companion information",
    key: "companion",
  },
  {
    name: "Allergies / Restrictions",
    key: "allergies",
  },
];

type AddCompanionProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const AddCompanion = ({ showModal, setShowModal }: AddCompanionProps) => {
  const [activeLabel, setActiveLabel] = useState("parents");

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
            Add Companion
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
          {activeLabel === "parents" && <Parent />}
          {activeLabel === "companion" && <Companion />}
          {activeLabel === "allergies" && <Allergies />}
        </div>
      </div>
    </Modal>
  );
};

export default AddCompanion;
