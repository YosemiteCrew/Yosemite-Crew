import React, { useState } from "react";
import Modal from "../Modal";
import { InventoryItem, InventoryErrors } from "@/app/pages/Inventory/types";
import { calculateBatchTotals } from "@/app/pages/Inventory/utils";
import { BusinessType } from "@/app/types/org";
import FormSection from "./FormSection";
import { InventorySectionKey } from "./InventoryConfig";
import Close from "../Icons/Close";
import Labels from "../Labels/Labels";

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

  const logValidationFailure = (
    section: InventorySectionKey,
    details: Record<string, string>
  ) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[Inventory] Validation failed for ${section}`,
        JSON.stringify(details)
      );
    }
  };

  const updateSection = (
    section: InventorySectionKey,
    patch: Record<string, any>,
    index?: number
  ) => {
    if (section === "batch") {
      setFormData((prev) => {
        const batches =
          prev.batches && prev.batches.length > 0
            ? [...prev.batches]
            : [prev.batch];
        const targetIndex = index ?? 0;
        const currentBatch = batches[targetIndex] ?? emptyInventoryItem.batch;
        batches[targetIndex] = { ...currentBatch, ...patch };
        const totals = calculateBatchTotals(batches);
        const stock = { ...prev.stock };
        if (totals.onHand !== undefined) stock.current = String(totals.onHand);
        if (totals.allocated !== undefined)
          stock.allocated = String(totals.allocated);
        if (totals.available !== undefined)
          stock.available = String(totals.available);
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

  const validateBasicInfo = (): Partial<
    Record<keyof typeof formData.basicInfo, string>
  > => {
    const basic = formData.basicInfo;
    const errors: Partial<Record<keyof typeof formData.basicInfo, string>> = {};
    if (!basic.name) errors.name = "Name is required";
    if (!basic.category) errors.category = "Category is required";
    if (!basic.subCategory) errors.subCategory = "Sub category is required";
    return errors;
  };

  const validatePricing = (): Partial<
    Record<keyof typeof formData.pricing, string>
  > => {
    const pricing = formData.pricing;
    const errors: Partial<Record<keyof typeof formData.pricing, string>> = {};
    if (!pricing.purchaseCost) {
      errors.purchaseCost = "Purchase cost is required";
    } else if (Number.isNaN(Number(pricing.purchaseCost))) {
      errors.purchaseCost = "Enter a valid number";
    }
    if (!pricing.selling) {
      errors.selling = "Selling price is required";
    } else if (Number.isNaN(Number(pricing.selling))) {
      errors.selling = "Enter a valid number";
    }
    return errors;
  };

  const validateStock = (): Partial<
    Record<keyof typeof formData.stock, string>
  > => {
    const stock = formData.stock;
    const errors: Partial<Record<keyof typeof formData.stock, string>> = {};
    if (!stock.current) {
      errors.current = "On hand quantity is required";
    } else if (Number.isNaN(Number(stock.current))) {
      errors.current = "Enter a valid number";
    }
    if (!stock.reorderLevel) {
      errors.reorderLevel = "Reorder level is required";
    } else if (Number.isNaN(Number(stock.reorderLevel))) {
      errors.reorderLevel = "Enter a valid number";
    }
    return errors;
  };

  const validateSection = (section: InventorySectionKey): boolean => {
    const nextErrors: InventoryErrors = { ...errors };
    const updateStatus = (valid: boolean) => {
      setSectionStatus((prev) => ({
        ...prev,
        [section]: valid ? "valid" : "error",
      }));
    };

    if (section === "basicInfo") {
      const sectionErrors = validateBasicInfo();
      if (Object.keys(sectionErrors).length > 0) {
        nextErrors.basicInfo = sectionErrors;
        setErrors(nextErrors);
        logValidationFailure(section, sectionErrors);
        updateStatus(false);
        return false;
      }
      delete nextErrors.basicInfo;
      setErrors(nextErrors);
      updateStatus(true);
      return true;
    }

    if (section === "classification") {
      delete nextErrors.classification;
      setErrors(nextErrors);
      updateStatus(true);
      return true;
    }

    if (section === "pricing") {
      const sectionErrors = validatePricing();
      if (Object.keys(sectionErrors).length > 0) {
        nextErrors.pricing = sectionErrors;
        setErrors(nextErrors);
        logValidationFailure(section, sectionErrors);
        updateStatus(false);
        return false;
      }
      delete nextErrors.pricing;
      setErrors(nextErrors);
      updateStatus(true);
      return true;
    }

    if (section === "stock") {
      const sectionErrors = validateStock();
      if (Object.keys(sectionErrors).length > 0) {
        nextErrors.stock = sectionErrors;
        setErrors(nextErrors);
        logValidationFailure(section, sectionErrors);
        updateStatus(false);
        return false;
      }
      delete nextErrors.stock;
      setErrors(nextErrors);
      updateStatus(true);
      return true;
    }

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
      if (firstInvalid) {
        console.error(
          `[Inventory] Validation halted at section ${firstInvalid.key}`
        );
        setActiveLabel(firstInvalid.key);
      }
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
    if (!currentValid) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[Inventory] Validation failed at step ${activeLabel}`);
      }
      return;
    }
    const currentIndex = labels.findIndex((l) => l.key === activeLabel);
    const nextLabel = labels[currentIndex + 1];
    if (nextLabel) {
      setActiveLabel(nextLabel.key);
      return;
    }
    await handleSaveAll();
  };

  const isLastSection = activeLabel === labels.at(-1)?.key;
  let ctaLabel: string;
  if (isLastSection) {
    ctaLabel = isSaving ? "Saving..." : "Save";
  } else {
    ctaLabel = "Next";
  }

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Add Inventory</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <Labels
          labels={labels}
          activeLabel={activeLabel}
          setActiveLabel={goToStep}
          statuses={sectionStatus}
        />

        <div className="flex overflow-y-auto flex-1 scrollbar-hidden">
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
                const batches =
                  prev.batches && prev.batches.length > 0
                    ? [...prev.batches]
                    : [prev.batch];
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
                if (totals.onHand !== undefined)
                  stock.current = String(totals.onHand);
                if (totals.allocated !== undefined)
                  stock.allocated = String(totals.allocated);
                if (totals.available !== undefined)
                  stock.available = String(totals.available);
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
                const batches =
                  prev.batches && prev.batches.length > 0
                    ? [...prev.batches]
                    : [prev.batch];
                const next = batches.filter((_, i) => i !== index);
                const totals = calculateBatchTotals(next);
                const stock = { ...prev.stock };
                if (totals.onHand !== undefined)
                  stock.current = String(totals.onHand);
                if (totals.allocated !== undefined)
                  stock.allocated = String(totals.allocated);
                if (totals.available !== undefined)
                  stock.available = String(totals.available);
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
