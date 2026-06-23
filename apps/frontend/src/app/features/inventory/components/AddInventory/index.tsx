import React, { useState } from 'react';
import Modal from '@/app/ui/overlays/Modal';
import { InventoryItem, InventoryErrors } from '@/app/features/inventory/pages/Inventory/types';
import { calculateBatchTotals } from '@/app/features/inventory/pages/Inventory/utils';
import { BusinessType } from '@/app/features/organization/types/org';
import FormSection from '@/app/features/inventory/components/AddInventory/FormSection';
import { InventorySectionKey } from '@/app/features/inventory/components/AddInventory/InventoryConfig';
import Close from '@/app/ui/primitives/Icons/Close';
import Labels from '@/app/ui/widgets/Labels/Labels';

const labels: { key: InventorySectionKey; name: string }[] = [
  { key: 'basicInfo', name: 'Basic Details' },
  { key: 'classification', name: 'Clinical Details' },
  { key: 'stock', name: 'Stock Control' },
  { key: 'batch', name: 'Batch and expiry' },
  { key: 'pricing', name: 'Pricing' },
  { key: 'vendor', name: 'Vendor details' },
];

const emptyInventoryItem: InventoryItem = {
  basicInfo: {
    name: '',
    category: '',
    subCategory: '',
    department: '',
    description: '',
    status: 'Active',
    brand: '',
    imageUrl: '',
    visibleInInventory: true,

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
    form: '',
    unitofMeasure: '',
    species: [],
    administration: '',
    itemType: 'Drug',
    drugSchedule: '',
    storageCondition: '',
    controlledSubstance: 'false',
    prescriptionRequired: 'false',
    reportableToGovernment: 'false',
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
    purchaseCost: '',
    selling: '',
    maxDiscount: '',
    tax: '',
  },
  vendor: {
    supplierName: '',
    brand: '',
    vendor: '',
    license: '',
    paymentTerms: '',
    leadTime: undefined,
  },
  stock: {
    current: '',
    allocated: '',
    available: '',
    maxStock: '',
    reorderLevel: '',
    reorderQuantity: '',
    stockLocation: '',
    abcClass: '',
    withdrawlPeriod: '',
    stockType: undefined,
    minStockAlert: undefined,
  },
  batch: {
    batch: '',
    manufactureDate: '',
    expiryDate: '',
    expiryWarningBefore: '',
    barcode: '',
    serial: undefined,
    tracking: undefined,
    litterId: undefined,
    nextRefillDate: undefined,
    quantity: '',
    allocated: '',
  },
  batches: [],
};

const logValidationFailure = (section: InventorySectionKey, details: Record<string, string>) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[Inventory] Validation failed for ${section}`, JSON.stringify(details));
  }
};

const nonDrugClassificationDefaults = {
  genericName: '',
  drugSchedule: '',
  form: '',
  administration: '',
  strength: '',
  unitofMeasure: '',
  controlledSubstance: 'false',
  prescriptionRequired: 'false',
  reportableToGovernment: 'false',
};

type AddInventoryProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  businessType: BusinessType;
  onSubmit: (data: InventoryItem) => Promise<void>;
  stockLocationOptions?: string[];
  organisationId?: string;
};

const AddInventory = ({
  showModal,
  setShowModal,
  businessType,
  onSubmit,
  stockLocationOptions,
  organisationId,
}: AddInventoryProps) => {
  const [activeLabel, setActiveLabel] = useState<InventorySectionKey>(labels[0].key);
  const [formData, setFormData] = useState<InventoryItem>(emptyInventoryItem);
  const [errors, setErrors] = useState<InventoryErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [sectionStatus, setSectionStatus] = useState<
    Partial<Record<InventorySectionKey, 'valid' | 'error'>>
  >({});

  const updateSection = (
    section: InventorySectionKey,
    patch: Record<string, any>,
    index?: number
  ) => {
    if (section === 'batch') {
      setFormData((prev) => {
        const batches = prev.batches && prev.batches.length > 0 ? [...prev.batches] : [prev.batch];
        const targetIndex = index ?? 0;
        const currentBatch = batches[targetIndex] ?? emptyInventoryItem.batch;
        batches[targetIndex] = { ...currentBatch, ...patch };
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

    if (section === 'classification') {
      setFormData((prev) => ({
        ...prev,
        classification: {
          ...prev.classification,
          ...patch,
          ...(patch.itemType === 'Non-drug' ? nonDrugClassificationDefaults : {}),
        },
      }));
      return;
    }

    if (section === 'stock') {
      setFormData((prev) => ({
        ...prev,
        stock: {
          ...prev.stock,
          ...patch,
          available: String(
            Math.max(
              0,
              Number(patch.current ?? prev.stock.current ?? 0) -
                Number(patch.allocated ?? prev.stock.allocated ?? 0)
            )
          ),
        },
      }));
      return;
    }

    setFormData((prev) => {
      const nextSection = { ...prev[section], ...patch };
      // Changing the category invalidates any previously-picked subcategory, which
      // belongs to a different category's list — clear it so the dropdown reopens
      // scoped to the new category.
      if (
        'category' in patch &&
        (prev[section] as Record<string, unknown>)?.category !== patch.category
      ) {
        (nextSection as Record<string, unknown>).subCategory = '';
      }
      return {
        ...prev,
        [section]: nextSection,
      };
    });
  };

  const validateBasicInfo = (): Partial<Record<keyof typeof formData.basicInfo, string>> => {
    const basic = formData.basicInfo;
    const errors: Partial<Record<keyof typeof formData.basicInfo, string>> = {};
    if (!basic.name.trim()) {
      errors.name = 'Item name cannot be empty';
    } else if (basic.name.trim().length > 100) {
      errors.name = 'Item name must be under 100 characters';
    }
    if (!basic.category) errors.category = 'Select Category';
    return errors;
  };

  const validatePricing = (): Partial<Record<keyof typeof formData.pricing, string>> => {
    const pricing = formData.pricing;
    const errors: Partial<Record<keyof typeof formData.pricing, string>> = {};
    if (!pricing.purchaseCost) {
      errors.purchaseCost = 'Purchase cost is required';
    } else if (Number.isNaN(Number(pricing.purchaseCost))) {
      errors.purchaseCost = 'Enter a valid number';
    }
    if (!pricing.selling) {
      errors.selling = 'Selling price is required';
    } else if (Number.isNaN(Number(pricing.selling))) {
      errors.selling = 'Enter a valid number';
    }
    return errors;
  };

  const validateStock = (): Partial<Record<keyof typeof formData.stock, string>> => {
    const stock = formData.stock;
    const errors: Partial<Record<keyof typeof formData.stock, string>> = {};
    if (!stock.current) {
      errors.current = 'On hand quantity is required';
    } else if (Number.isNaN(Number(stock.current))) {
      errors.current = 'Enter a valid number';
    }
    if (!stock.reorderLevel) {
      errors.reorderLevel = 'Reorder level is required';
    } else if (Number.isNaN(Number(stock.reorderLevel))) {
      errors.reorderLevel = 'Enter a valid number';
    }
    return errors;
  };

  const validateClassification = (): Partial<
    Record<keyof typeof formData.classification, string>
  > => {
    const classification = formData.classification;
    const nextErrors: Partial<Record<keyof typeof formData.classification, string>> = {};
    const isMedicalItem =
      businessType === 'HOSPITAL' &&
      String(classification.itemType ?? '').toLowerCase() !== 'non-drug';

    if (isMedicalItem && !String(classification.genericName ?? '').trim()) {
      nextErrors.genericName = 'Generic name is required';
    }

    return nextErrors;
  };

  const validateSection = (section: InventorySectionKey): boolean => {
    const nextErrors: InventoryErrors = { ...errors };
    const updateStatus = (valid: boolean) => {
      setSectionStatus((prev) => ({
        ...prev,
        [section]: valid ? 'valid' : 'error',
      }));
    };

    if (section === 'basicInfo') {
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

    if (section === 'classification') {
      const sectionErrors = validateClassification();
      if (Object.keys(sectionErrors).length > 0) {
        nextErrors.classification = sectionErrors;
        setErrors(nextErrors);
        logValidationFailure(section, sectionErrors as Record<string, string>);
        updateStatus(false);
        return false;
      }
      delete nextErrors.classification;
      setErrors(nextErrors);
      updateStatus(true);
      return true;
    }

    if (section === 'pricing') {
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

    if (section === 'stock') {
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
        (l) => sectionStatus[l.key] === 'error' || !validateSection(l.key)
      );
      if (firstInvalid) {
        console.error(`[Inventory] Validation halted at section ${firstInvalid.key}`);
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
      console.error('Failed to submit inventory:', err);
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
      if (process.env.NODE_ENV === 'development') {
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
    ctaLabel = isSaving ? 'Saving...' : 'Save';
  } else {
    ctaLabel = 'Next';
  }

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex items-center justify-between border-b border-card-border pb-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="text-body-1 text-text-primary">Add item</div>
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
            sectionTitle={labels.find((l) => l.key === activeLabel)?.name || 'Section'}
            headerSlot={
              activeLabel === 'basicInfo' ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body-4-emphasis text-text-primary">
                    Visible in Inventory
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.basicInfo.visibleInInventory !== false}
                    aria-label="Visible in Inventory"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        basicInfo: {
                          ...prev.basicInfo,
                          visibleInInventory: prev.basicInfo.visibleInInventory === false,
                        },
                      }))
                    }
                    className="inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors"
                    style={{
                      backgroundColor:
                        formData.basicInfo.visibleInInventory === false
                          ? 'var(--color-neutral-300)'
                          : 'var(--color-blue-sky)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className={`block size-6 rounded-full bg-white shadow-sm transition-transform ${
                        formData.basicInfo.visibleInInventory === false
                          ? 'translate-x-0'
                          : 'translate-x-6'
                      }`}
                    />
                  </button>
                </div>
              ) : undefined
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
                  prev.batches && prev.batches.length > 0 ? [...prev.batches] : [prev.batch];
                const nextBatches = [
                  ...batches,
                  {
                    batch: '',
                    manufactureDate: '',
                    expiryDate: '',
                    serial: undefined,
                    tracking: undefined,
                    litterId: undefined,
                    nextRefillDate: undefined,
                    quantity: '',
                    allocated: '',
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
                const batches =
                  prev.batches && prev.batches.length > 0 ? [...prev.batches] : [prev.batch];
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
            stockLocationOptions={stockLocationOptions}
            organisationId={organisationId}
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddInventory;
