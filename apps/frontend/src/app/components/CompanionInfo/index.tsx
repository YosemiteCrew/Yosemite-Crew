import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { CompanionParent } from "../../pages/Companions/types";
import Labels from "../Labels/Labels";
import Modal from "../Modal";
import {
  Companion,
  Parent,
  Core,
  History,
  Documents,
  AddAppointment,
  AddTask,
} from "./Sections";
import { getSafeImageUrl, ImageType } from "@/app/utils/urls";
import Close from "../Icons/Close";

type CompanionInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeCompanion: CompanionParent | null;
};
type LabelKey = (typeof labels)[number]["key"];
type SubLabelKey = (typeof labels)[number]["labels"][number]["key"];

const labels = [
  {
    key: "info",
    name: "Info",
    labels: [
      { key: "companion-information", name: "Companion information" },
      { key: "parent-information", name: "Parent information" },
    ],
  },
  {
    key: "records",
    name: "Records",
    labels: [
      { key: "history", name: "History" },
      { key: "documents", name: "Documents" },
    ],
  },
];

const COMPONENT_MAP: Record<LabelKey, Record<SubLabelKey, React.FC<any>>> = {
  info: {
    "companion-information": Companion,
    "parent-information": Parent,
    "core-information": Core,
  },
  records: {
    history: History,
    documents: Documents,
  },
  actions: {
    "add-appointment": AddAppointment,
    "add-task": AddTask,
  },
};

const CompanionInfo = ({
  showModal,
  setShowModal,
  activeCompanion,
}: CompanionInfoProps) => {
  const [activeLabel, setActiveLabel] = useState<LabelKey>(labels[0].key);
  const [activeSubLabel, setActiveSubLabel] = useState<SubLabelKey>(
    labels[0].labels[0].key
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const Content = COMPONENT_MAP[activeLabel]?.[activeSubLabel];

  useEffect(() => {
    const current = labels.find((l) => l.key === activeLabel);
    if (current && current.labels.length > 0) {
      setActiveSubLabel(current.labels[0].key);
    }
  }, [activeLabel]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeLabel, activeSubLabel]);

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex justify-center items-center gap-2">
              <Image
                alt="pet image"
                src={getSafeImageUrl(
                  activeCompanion?.companion.photoUrl,
                  activeCompanion?.companion.type.toLowerCase() as ImageType
                )}
                className="rounded-full h-10 w-10 object-cover"
                height={40}
                width={40}
              />
              <div className="text-body-1 text-text-primary">
                {activeCompanion?.companion.name}
              </div>
              <div className="text-body-4 text-text-primary mt-1">
                {activeCompanion?.companion.breed}
              </div>
            </div>
            <Close onClick={() => setShowModal(false)} />
          </div>

          <Labels
            labels={labels}
            activeLabel={activeLabel}
            setActiveLabel={setActiveLabel}
            activeSubLabel={activeSubLabel}
            setActiveSubLabel={setActiveSubLabel}
          />
        </div>

        <div
          ref={scrollRef}
          className="flex overflow-y-auto flex-1 scrollbar-hidden"
        >
          {Content ? <Content companion={activeCompanion} /> : null}
        </div>
      </div>
    </Modal>
  );
};

export default CompanionInfo;
