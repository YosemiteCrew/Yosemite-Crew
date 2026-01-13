import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { IoEye, IoDocumentTextSharp } from "react-icons/io5";
import { IoIosCloseCircleOutline } from "react-icons/io";
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
import { isHttpsImageUrl } from "@/app/utils/urls";

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
    icon: IoEye,
    iconSize: 32,
    labels: [
      { key: "companion-information", name: "Companion information" },
      { key: "parent-information", name: "Parent information" },
    ],
  },
  {
    key: "records",
    name: "Records",
    icon: IoDocumentTextSharp,
    iconSize: 32,
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
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex flex-col">
          <div className="flex justify-between">
            <IoIosCloseCircleOutline
              size={28}
              color="#302f2e"
              className="opacity-0"
            />
            <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
              <Image
                alt="pet image"
                src={
                  isHttpsImageUrl(activeCompanion?.companion.photoUrl)
                    ? activeCompanion?.companion.photoUrl
                    : "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
                }
                className="rounded-full min-w-20 max-h-20 object-cover"
                height={80}
                width={80}
              />
            </div>
            <IoIosCloseCircleOutline
              size={28}
              color="#302f2e"
              onClick={() => setShowModal(false)}
              className="cursor-pointer"
            />
          </div>
          <div className="flex justify-center font-grotesk font-medium text-[23px] text-black-text">
            {activeCompanion?.companion.name}
          </div>
          <div className="flex justify-center font-satoshi font-medium text-[14px] text-black-text">
            {activeCompanion?.companion.breed +
              " / " +
              activeCompanion?.companion.type}
          </div>
        </div>

        <Labels
          labels={labels}
          activeLabel={activeLabel}
          setActiveLabel={setActiveLabel}
          activeSubLabel={activeSubLabel}
          setActiveSubLabel={setActiveSubLabel}
        />

        <div ref={scrollRef} className="flex overflow-y-auto flex-1">
          {Content ? <Content companion={activeCompanion} /> : null}
        </div>
      </div>
    </Modal>
  );
};

export default CompanionInfo;
