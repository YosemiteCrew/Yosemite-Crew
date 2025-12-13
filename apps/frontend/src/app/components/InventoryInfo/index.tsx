import React, { useState } from "react";
import { InventoryItem } from "@/app/pages/Inventory/types";
import { BusinessType } from "@/app/types/org";
import { IoIosCloseCircleOutline } from "react-icons/io";
import Modal from "../Modal";
import SubLabels from "../Labels/SubLabels";
import InfoSection from "./InfoSection";
import { Primary, Secondary } from "../Buttons";
import { InventorySectionKey } from "@/app/components/AddInventory/InventoryConfig";

type InventoryInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeInventory: InventoryItem | null;
  businessType: BusinessType;
  onUpdate: (item: InventoryItem) => Promise<void>;
  onHide: (itemId: string) => Promise<void>;
  onUnhide: (itemId: string) => Promise<void>;
};

const modalSections: { key: InventorySectionKey; name: string }[] = [
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
  onUpdate,
  onHide,
  onUnhide,
}: InventoryInfoProps) => {
  const [activeLabel, setActiveLabel] = useState<InventorySectionKey>(
    modalSections[0].key
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const currentLabelConfig =
    modalSections.find((l) => l.key === activeLabel) || modalSections[0];

  const handleSectionSave = async (
    section: InventorySectionKey,
    values: Record<string, any>
  ) => {
    if (!activeInventory || isUpdating || isHiding) return;
    setIsUpdating(true);
    try {
      const updated: InventoryItem = {
        ...activeInventory,
        [section]: {
          ...(activeInventory as any)[section],
          ...values,
        },
      };
      await onUpdate(updated);
    } catch (err) {
      console.error("Failed to update inventory section:", err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleHide = async () => {
    if (!activeInventory?.id || isHiding) return;
    setIsHiding(true);
    try {
      await onHide(activeInventory.id);
      setShowModal(false);
    } catch (err) {
      console.error("Failed to hide inventory item:", err);
    } finally {
      setIsHiding(false);
    }
  };

  const handleUnhide = async () => {
    if (!activeInventory?.id || isHiding) return;
    setIsHiding(true);
    try {
      await onUnhide(activeInventory.id);
      setShowModal(false);
    } catch (err) {
      console.error("Failed to unhide inventory item:", err);
    } finally {
      setIsHiding(false);
    }
  };

  const isHidden = (activeInventory?.status || "").toUpperCase() === "HIDDEN";

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
          labels={modalSections}
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
              onSaveSection={handleSectionSave}
              disableEditing={isUpdating || isHiding}
            />
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Secondary
            href="#"
            text="Close"
            onClick={() => setShowModal(false)}
            isDisabled={isUpdating || isHiding}
            className="h-12! text-lg! tracking-wide!"
          />
          <Primary
            href="#"
            text={
              isHiding
                ? isHidden
                  ? "Unhiding..."
                  : "Hiding..."
                : isHidden
                  ? "Unhide item"
                  : "Hide item"
            }
            onClick={isHidden ? handleUnhide : handleHide}
            isDisabled={isHiding || isUpdating || !activeInventory?.id}
            classname="h-12! text-lg! tracking-wide!"
          />
        </div>
      </div>
    </Modal>
  );
};

export default InventoryInfo;
