import React, { useEffect, useRef, useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import Parent from "./Sections/Parent";
import Companion from "./Sections/Companion";
import Modal from "../Modal";
import SubLabels from "../Labels/SubLabels";
import { EMPTY_STORED_COMPANION, EMPTY_STORED_PARENT } from "./type";
import { StoredCompanion, StoredParent } from "@/app/pages/Companions/types";

const Labels = [
  {
    name: "Parents details",
    key: "parents",
  },
  {
    name: "Companion information",
    key: "companion",
  },
];

type AddCompanionProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const AddCompanion = ({ showModal, setShowModal }: AddCompanionProps) => {
  const [activeLabel, setActiveLabel] = useState<string>("parents");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [parentFormData, setParentFormData] =
    useState<StoredParent>(EMPTY_STORED_PARENT);
  const [companionFormData, setCompanionFormData] = useState<StoredCompanion>(
    EMPTY_STORED_COMPANION
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeLabel]);

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
          disableClicking
        />

        <div ref={scrollRef} className="flex overflow-y-auto flex-1">
          {activeLabel === "parents" && (
            <Parent
              setActiveLabel={setActiveLabel}
              formData={parentFormData}
              setFormData={setParentFormData}
            />
          )}
          {activeLabel === "companion" && (
            <Companion
              setActiveLabel={setActiveLabel}
              formData={companionFormData}
              setFormData={setCompanionFormData}
              parentFormData={parentFormData}
              setParentFormData={setParentFormData}
              setShowModal={setShowModal}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AddCompanion;
