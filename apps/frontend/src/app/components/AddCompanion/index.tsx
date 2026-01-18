import React, { useEffect, useRef, useState } from "react";
import Parent from "./Sections/Parent";
import Companion from "./Sections/Companion";
import Modal from "../Modal";
import { EMPTY_STORED_COMPANION, EMPTY_STORED_PARENT } from "./type";
import { StoredCompanion, StoredParent } from "@/app/pages/Companions/types";
import Close from "../Icons/Close";
import Labels from "../Labels/Labels";

const LabelOptions = [
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
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Add companion</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <Labels
          labels={LabelOptions}
          activeLabel={activeLabel}
          setActiveLabel={setActiveLabel}
          disableClicking
        />

        <div
          ref={scrollRef}
          className="flex overflow-y-auto flex-1 scrollbar-hidden"
        >
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
