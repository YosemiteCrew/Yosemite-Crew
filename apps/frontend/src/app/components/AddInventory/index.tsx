import React, { useState } from "react";
import Modal from "../Modal";
import { IoIosCloseCircleOutline } from "react-icons/io";
import SubLabels from "../Labels/SubLabels";
import {
  InventoryItem,
  InventoryErrors,
} from "@/app/pages/Inventory/types";
import { BusinessType } from "@/app/types/org";
import FormSection from "./FormSection";

const labels: { key: keyof InventoryItem; name: string }[] = [
  { key: "basicInfo", name: "Basic Information" },
  { key: "classification", name: "Classification attribute" },
  { key: "pricing", name: "Pricing" },
  { key: "vendor", name: "Vendor details" },
  { key: "stock", name: "Stock and quantity details" },
  { key: "batch", name: "Batch / Lot details" },
];

const emptyInventoryItem: InventoryItem = {
  basicInfo: {
    name: "",
    category: "",
    subCategory: "",
    department: "",
    description: "",
    status: "Low stock",

    // Hospital
    itemType: undefined,
    prescriptionRequired: undefined,
    regulationType: undefined,
    storageCondition: undefined,

    // Groomer
    productUsage: undefined,
    intendedUsage: undefined,
    coatType: undefined,
    fragranceType: undefined,
    allergenFree: undefined,
    petSize: undefined,

    // Breeder
    animalStage: undefined,

    // Boarder
    skuCode: undefined,
  },
  classification: {
    form: "",
    unitofMeasure: "",
    species: "",
    administration: "",
    therapeuticClass: undefined,
    strength: undefined,
    dosageForm: undefined,
    withdrawlPeriod: undefined,
    dispenseUnit: undefined,
    packSize: undefined,
    usagePerService: undefined,
    breedingUse: undefined,
    temperatureCondition: undefined,
    usageType: undefined,
    litterGroup: undefined,
    shelfLife: undefined,
    heatCycle: undefined,
    intakeType: undefined,
    frequency: undefined,
    productUse: undefined,
    safetyClassification: undefined,
    brand: undefined,
  },
  pricing: {
    purchaseCost: "",
    selling: "",
    maxDiscount: "",
    tax: "",
  },
  vendor: {
    supplierName: "",
    brand: "",
    vendor: "",
    license: "",
    paymentTerms: "",
    leadTime: undefined,
  },
  stock: {
    current: "",
    allocated: "",
    available: "",
    reorderLevel: "",
    reorderQuantity: "",
    stockLocation: "",
    stockType: undefined,
    minStockAlert: undefined,
  },
  batch: {
    batch: "",
    manufactureDate: "",
    expiryDate: "",
    serial: undefined,
    tracking: undefined,
    litterId: undefined,
    nextRefillDate: undefined,
  },
};

type AddInventoryProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  businessType: BusinessType
};

const AddInventory = ({ showModal, setShowModal, businessType }: AddInventoryProps) => {
  const [activeLabel, setActiveLabel] = useState<keyof InventoryItem>(
    labels[0].key
  );
  const [formData, setFormData] = useState<InventoryItem>(emptyInventoryItem);
  const [errors, setErrors] = useState<InventoryErrors>({});

  const updateSection = (
    section: keyof InventoryItem,
    patch: Record<string, any>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...patch },
    }));
  };

  const validate = (): boolean => {
    const nextErrors: InventoryErrors = {};
    const basic = formData.basicInfo;
    const be: InventoryErrors["basicInfo"] = {};
    if (!basic.name) be.name = "Name is required";
    if (!basic.category) be.category = "Category is required";
    if (Object.keys(be).length > 0) nextErrors.basicInfo = be;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveAll = () => {
    if (!validate()) return;
    console.log("Submitting inventory:", formData);
    // Submit to API here
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
            Add Inventory
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
          <FormSection
            businessType={businessType}
            sectionKey={activeLabel}
            sectionTitle={
              labels.find((l) => l.key === activeLabel)?.name || "Section"
            }
            formData={formData}
            errors={errors}
            onFieldChange={(section, name, value) =>
              updateSection(section, { [name]: value })
            }
            onSave={handleSaveAll}
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddInventory;
