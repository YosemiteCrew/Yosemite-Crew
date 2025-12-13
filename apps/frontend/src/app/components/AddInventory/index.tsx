import React, { useState } from "react";
import Modal from "../Modal";
import { IoIosCloseCircleOutline } from "react-icons/io";
import SubLabels from "../Labels/SubLabels";
import {
  InventoryItem,
  InventoryErrors,
} from "@/app/pages/Inventory/types";
import { calculateBatchTotals } from "@/app/pages/Inventory/utils";
import { BusinessType } from "@/app/types/org";
import FormSection from "./FormSection";
import { InventorySectionKey } from "./InventoryConfig";

const labels: { key: InventorySectionKey; name: string }[] = [
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
    status: "Active",

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
    species: [],
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
    quantity: "",
    allocated: "",
  },
  batches: [],
};

type AddInventoryProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  businessType: BusinessType;
  onSubmit: (data: InventoryItem) => Promise<void>;
};

const AddInventory = ({
  showModal,
  setShowModal,
  businessType,
  onSubmit,
}: AddInventoryProps) => {
  const [activeLabel, setActiveLabel] = useState<InventorySectionKey>(
    labels[0].key
  );
  const [formData, setFormData] = useState<InventoryItem>(emptyInventoryItem);
  const [errors, setErrors] = useState<InventoryErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [sectionStatus, setSectionStatus] = useState<
    Partial<Record<InventorySectionKey, "valid" | "error">>
  >({});

  const updateSection = (
    section: InventorySectionKey,
    patch: Record<string, any>,
    index?: number
  ) => {
    if (section === "batch") {
      setFormData((prev) => {
        const batches = prev.batches && prev.batches.length > 0 ? [...prev.batches] : [prev.batch];
        const targetIndex = index ?? 0;
        batches[targetIndex] = { ...(batches[targetIndex] ?? {}), ...patch };
        const totals = calculateBatchTotals(batches);
        const stock = { ...prev.stock };
        if (totals.onHand !== undefined) stock.current = String(totals.onHand);
        if (totals.allocated !== undefined) stock.allocated = String(totals.allocated);
        if (totals.available !== undefined) stock.available = String(totals.available);
        return {
          ...prev,
          batch: batches[0],
          batches,
          stock,
        };
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...patch },
    }));
  };

  const validateSection = (section: InventorySectionKey): boolean => {
    const nextErrors: InventoryErrors = { ...errors };
    const updateStatus = (valid: boolean) => {
      setSectionStatus((prev) => ({ ...prev, [section]: valid ? "valid" : "error" }));
    };

    if (section === "basicInfo") {
      const basic = formData.basicInfo;
      const be: InventoryErrors["basicInfo"] = {};
      if (!basic.name) be.name = "Name is required";
      if (!basic.category) be.category = "Category is required";
      if (!basic.subCategory) be.subCategory = "Sub category is required";
      if (Object.keys(be).length > 0) {
        nextErrors.basicInfo = be;
        setErrors(nextErrors);
        updateStatus(false);
        return false;
      }
      delete nextErrors.basicInfo;
      setErrors(nextErrors);
      updateStatus(true);
      return true;
    }

    if (section === "classification") {
      const classification = formData.classification;
      const ce: InventoryErrors["classification"] = {};
      if (
        !classification.species ||
        (Array.isArray(classification.species)
          ? classification.species.length === 0
          : classification.species === "")
      ) {
        ce.species = "Select at least one species";
      }
      if (Object.keys(ce).length > 0) {
        nextErrors.classification = ce;
        setErrors(nextErrors);
        updateStatus(false);
        return false;
      }
      delete nextErrors.classification;
      setErrors(nextErrors);
      updateStatus(true);
      return true;
    }

    if (section === "pricing") {
      const pricing = formData.pricing;
      const pe: InventoryErrors["pricing"] = {};
      if (!pricing.purchaseCost) pe.purchaseCost = "Purchase cost is required";
      else if (Number.isNaN(Number(pricing.purchaseCost))) {
        pe.purchaseCost = "Enter a valid number";
      }
      if (!pricing.selling) pe.selling = "Selling price is required";
      else if (Number.isNaN(Number(pricing.selling))) {
        pe.selling = "Enter a valid number";
      }
      if (Object.keys(pe).length > 0) {
        nextErrors.pricing = pe;
        setErrors(nextErrors);
        updateStatus(false);
        return false;
      }
      delete nextErrors.pricing;
      setErrors(nextErrors);
      updateStatus(true);
      return true;
    }

    if (section === "stock") {
      const stock = formData.stock;
      const se: InventoryErrors["stock"] = {};
      if (!stock.current) se.current = "On hand quantity is required";
      else if (Number.isNaN(Number(stock.current))) {
        se.current = "Enter a valid number";
      }
      if (!stock.reorderLevel) se.reorderLevel = "Reorder level is required";
      else if (Number.isNaN(Number(stock.reorderLevel))) {
        se.reorderLevel = "Enter a valid number";
      }
      if (Object.keys(se).length > 0) {
        nextErrors.stock = se;
        setErrors(nextErrors);
        updateStatus(false);
        return false;
      }
      delete nextErrors.stock;
      setErrors(nextErrors);
      updateStatus(true);
      return true;
    }

    // Optional sections
    setErrors(nextErrors);
    updateStatus(true);
    return true;
  };

  const validateAll = (): boolean => {
    const allValid = labels.every((label) => validateSection(label.key));
    if (!allValid) {
      const firstInvalid = labels.find(
        (l) => sectionStatus[l.key] === "error" || !validateSection(l.key)
      );
      if (firstInvalid) setActiveLabel(firstInvalid.key);
    }
    return allValid;
  };

  const resetForm = () => {
    setFormData({
      ...emptyInventoryItem,
      batches: [emptyInventoryItem.batch],
    });
    setErrors({});
    setActiveLabel(labels[0].key);
    setSectionStatus({});
  };

  const handleSaveAll = async () => {
    if (isSaving) return;
    if (!validateAll()) return;
    setIsSaving(true);
    try {
      await onSubmit(formData);
      resetForm();
      setShowModal(false);
    } catch (err) {
      console.error("Failed to submit inventory:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const goToStep = (target: InventorySectionKey) => {
    const currentIndex = labels.findIndex((l) => l.key === activeLabel);
    const targetIndex = labels.findIndex((l) => l.key === target);
    if (targetIndex > currentIndex) {
      const valid = validateSection(activeLabel);
      if (!valid) return;
    }
    setActiveLabel(target);
  };

  const handleNext = async () => {
    const currentValid = validateSection(activeLabel);
    if (!currentValid) return;
    const currentIndex = labels.findIndex((l) => l.key === activeLabel);
    const nextLabel = labels[currentIndex + 1];
    if (nextLabel) {
      setActiveLabel(nextLabel.key);
      return;
    }
    await handleSaveAll();
  };

  const ctaLabel =
    activeLabel === labels[labels.length - 1].key
      ? isSaving
        ? "Saving..."
        : "Save"
      : "Next";

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
          setActiveLabel={goToStep}
          statuses={sectionStatus}
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
            onFieldChange={(section, name, value, index) =>
              updateSection(section, { [name]: value }, index)
            }
            onSave={handleNext}
            saveLabel={ctaLabel}
            disableSave={isSaving}
            onClear={resetForm}
            onAddBatch={() =>
              setFormData((prev) => {
                const batches = prev.batches && prev.batches.length > 0 ? [...prev.batches] : [prev.batch];
                const nextBatches = [
                  ...batches,
                  {
                    batch: "",
                    manufactureDate: "",
                    expiryDate: "",
                    serial: undefined,
                    tracking: undefined,
                    litterId: undefined,
                    nextRefillDate: undefined,
                    quantity: "",
                    allocated: "",
                  },
                ];
                const totals = calculateBatchTotals(nextBatches);
                const stock = { ...prev.stock };
                if (totals.onHand !== undefined) stock.current = String(totals.onHand);
                if (totals.allocated !== undefined) stock.allocated = String(totals.allocated);
                if (totals.available !== undefined) stock.available = String(totals.available);
                return {
                  ...prev,
                  batches: nextBatches,
                  batch: nextBatches[0] ?? emptyInventoryItem.batch,
                  stock,
                };
              })
            }
            onRemoveBatch={(index) =>
              setFormData((prev) => {
                const batches = prev.batches && prev.batches.length > 0 ? [...prev.batches] : [prev.batch];
                const next = batches.filter((_, i) => i !== index);
                const totals = calculateBatchTotals(next);
                const stock = { ...prev.stock };
                if (totals.onHand !== undefined) stock.current = String(totals.onHand);
                if (totals.allocated !== undefined) stock.allocated = String(totals.allocated);
                if (totals.available !== undefined) stock.available = String(totals.available);
                return {
                  ...prev,
                  batch: next[0] ?? emptyInventoryItem.batch,
                  batches: next.length ? next : [emptyInventoryItem.batch],
                  stock,
                };
              })
            }
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddInventory;
