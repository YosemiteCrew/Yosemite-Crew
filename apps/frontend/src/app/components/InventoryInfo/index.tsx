import React, { useState } from "react";
import { InventoryItem } from "@/app/pages/Inventory/types";
import { BusinessType } from "@/app/types/org";
import { IoIosCloseCircleOutline } from "react-icons/io";
import Modal from "../Modal";
import SubLabels from "../Labels/SubLabels";
import InfoSection from "./InfoSection";

type InventoryInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeInventory: InventoryItem | null;
  businessType: BusinessType;
};

const labels: { key: keyof InventoryItem; name: string }[] = [
  { key: "basicInfo", name: "Basic Information" },
  { key: "classification", name: "Classification attribute" },
  { key: "pricing", name: "Pricing" },
  { key: "vendor", name: "Vendor details" },
  { key: "stock", name: "Stock and quantity details" },
  { key: "batch", name: "Batch / Lot details" },
];

const InventoryInfo = ({
  showModal,
  setShowModal,
  activeInventory,
  businessType,
}: InventoryInfoProps) => {
  const [activeLabel, setActiveLabel] = useState<keyof InventoryItem>(
    labels[0].key
  );
  const currentLabelConfig =
    labels.find((l) => l.key === activeLabel) || labels[0];

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
            {activeInventory?.basicInfo.name}
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <SubLabels
          labels={labels}
          activeLabel={activeLabel}
          setActiveLabel={setActiveLabel}
        />

        <div className="flex overflow-y-auto flex-1">
          {activeInventory ? (
            <InfoSection
              businessType={businessType}
              sectionKey={activeLabel}
              sectionTitle={currentLabelConfig.name}
              inventory={activeInventory}
            />
          ) : null}
        </div>
      </div>
    </Modal>
  );
};

export default InventoryInfo;
