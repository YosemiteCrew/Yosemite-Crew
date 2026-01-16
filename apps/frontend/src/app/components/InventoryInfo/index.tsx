import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { BatchValues, InventoryItem } from "@/app/pages/Inventory/types";
import { BusinessType } from "@/app/types/org";
import { formatDisplayDate, toStringSafe } from "@/app/pages/Inventory/utils";
import {
  ConfigItem,
  InventoryFormConfig,
  InventorySectionKey,
} from "@/app/components/AddInventory/InventoryConfig";
import Accordion from "../Accordion/Accordion";
import { Primary, Secondary } from "../Buttons";
import Datepicker from "../Inputs/Datepicker";
import LabelDropdown from "../Inputs/Dropdown/LabelDropdown";
import FormInput from "../Inputs/FormInput/FormInput";
import SubLabels from "../Labels/SubLabels";
import Modal from "../Modal";
import InfoSection from "./InfoSection";
import Close from "../Icons/Close";

const emptyBatch: BatchValues = {
  batch: "",
  manufactureDate: "",
  expiryDate: "",
  serial: "",
  tracking: "",
  litterId: "",
  nextRefillDate: "",
  quantity: "",
  allocated: "",
};

type BatchEditorProps = {
  businessType: BusinessType;
  inventory: InventoryItem;
  disableEditing?: boolean;
  onSave: (values: { newBatches: BatchValues[] }) => Promise<void>;
  onEditingChange?: (editing: boolean) => void;
  onRegisterActions?: (
    actions: {
      save: () => Promise<void>;
      cancel: () => void;
      startEditing?: () => void;
      isEditing?: () => boolean;
    } | null
  ) => void;
};

const BatchEditor: React.FC<BatchEditorProps> = ({
  businessType,
  inventory,
  disableEditing,
  onSave,
  onEditingChange,
  onRegisterActions,
}) => {
  const existingBatches = useMemo<BatchValues[]>(
    () =>
      inventory.batches && inventory.batches.length > 0
        ? inventory.batches
        : [inventory.batch],
    [inventory]
  );
  const [newBatches, setNewBatches] = useState<BatchValues[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setNewBatches([]);
    setIsEditing(false);
    onEditingChange?.(false);
  }, [inventory, onEditingChange]);

  const configForBusiness = InventoryFormConfig[businessType] || {};
  const sectionConfig = useMemo<ConfigItem<any>[]>(
    () => configForBusiness.batch || [],
    [configForBusiness.batch]
  );

  const parseDate = (value?: string): Date | null => {
    if (!value) return null;
    if (value.includes("/")) {
      const [dd, mm, yyyy] = value.split("/");
      const parsed = new Date(`${yyyy}-${mm}-${dd}`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  const beginEditing = useCallback(() => {
    if (disableEditing) return;
    setIsEditing(true);
    if (newBatches.length === 0) {
      setNewBatches([{ ...emptyBatch }]);
    }
  }, [disableEditing, newBatches.length]);

  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  const handleChange = useCallback(
    (index: number, name: keyof BatchValues, value: string) => {
      setNewBatches((prev) => {
        const next = [...prev];
        next[index] = { ...(next[index] ?? emptyBatch), [name]: value };
        return next;
      });
      if (!isEditing) setIsEditing(true);
    },
    [isEditing]
  );

  const addBatch = useCallback(() => {
    setNewBatches((prev) => [...prev, { ...emptyBatch }]);
    if (!isEditing) setIsEditing(true);
  }, [isEditing]);

  const removeBatch = useCallback((index: number) => {
    setNewBatches((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ ...emptyBatch }];
    });
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(async () => {
    const meaningfulNew = newBatches.filter((b) =>
      Object.values(b || {}).some((v) => toStringSafe(v) !== "")
    );
    await onSave({
      newBatches: meaningfulNew,
    });
    setIsEditing(false);
    setNewBatches([]);
  }, [newBatches, onSave]);

  const handleCancel = useCallback(() => {
    setNewBatches([]);
    setIsEditing(false);
  }, []);

  useEffect(() => {
    if (disableEditing && isEditing) {
      setIsEditing(false);
    }
  }, [disableEditing, isEditing]);

  useEffect(() => {
    onRegisterActions?.({
      save: handleSave,
      cancel: handleCancel,
      startEditing: beginEditing,
      isEditing: () => isEditing,
    });
    return () => onRegisterActions?.(null);
  }, [
    onRegisterActions,
    handleSave,
    handleCancel,
    beginEditing,
    inventory,
    isEditing,
  ]);

  const normalizeOptions = (
    options?: Array<string | { label: string; value: string }>
  ) =>
    options?.map((option: any) =>
      typeof option === "string" ? { label: option, value: option } : option
    ) ?? [];

  const resolveLabel = (
    options: Array<{ label: string; value: string }>,
    value: string
  ) => options.find((o) => o.value === value)?.label ?? value;

  const formatDateValue = (value?: string) => {
    return formatDisplayDate(value) || "—";
  };

  const renderField = (field: any, batchIndex: number, key?: React.Key) => {
    const { placeholder, component, options, name } = field;
    const typedName = name as keyof BatchValues;
    const value = newBatches[batchIndex]?.[typedName] ?? "";

    if (component === "date") {
      const currentDate = parseDate(value);
      return (
        <Datepicker
          key={key ?? name}
          currentDate={currentDate}
          setCurrentDate={(
            next: Date | null | ((prev: Date | null) => Date | null)
          ) => {
            const resolved =
              typeof next === "function"
                ? (next as (prev: Date | null) => Date | null)(currentDate)
                : next;
            if (!resolved) {
              handleChange(batchIndex, typedName, "");
              return;
            }
            handleChange(batchIndex, typedName, formatDate(resolved));
          }}
          placeholder={placeholder || ""}
          type="input"
          className="min-h-12!"
        />
      );
    }

    if (component === "dropdown") {
      const dropdownOptions = (options || []).map((opt: any) =>
        typeof opt === "string" ? { label: opt, value: opt } : opt
      );
      return (
        <LabelDropdown
          key={key ?? name}
          placeholder={placeholder || ""}
          defaultOption={value}
          onSelect={(opt) => handleChange(batchIndex, typedName, opt.value)}
          options={dropdownOptions}
        />
      );
    }

    return (
      <FormInput
        key={key ?? name}
        intype="text"
        inname={name}
        value={value}
        inlabel={placeholder || ""}
        onChange={(e) => handleChange(batchIndex, typedName, e.target.value)}
        className="min-h-12!"
      />
    );
  };

  const getFieldDisplay = (
    component: string,
    value: any,
    normalizedOptions: any[]
  ): string | string[] => {
    if (component === "multiSelect") {
      if (Array.isArray(value)) return value;
      if (typeof value === "string" && value.trim() !== "") {
        return value.split(",").map((v: string) => v.trim());
      }
      return [];
    }

    if (component === "dropdown") {
      if (value !== undefined && value !== "") {
        return resolveLabel(normalizedOptions, String(value));
      }
      return "—";
    }

    if (component === "date") {
      return formatDateValue(String(value ?? ""));
    }

    return String(value ?? "");
  };

  const formatFinalValue = (display: string | string[]): string => {
    if (Array.isArray(display)) {
      return display.length > 0 ? display.join(", ") : "—";
    }
    if (display !== undefined && display !== "") {
      return String(display);
    }
    return "—";
  };

  const renderPreviewField = (
    field: any,
    batchData: BatchValues,
    key?: React.Key
  ) => {
    const { placeholder, label, component, options, name } = field;
    const value = batchData[name as keyof BatchValues];
    const displayLabel = placeholder || label || name;
    const normalizedOptions = normalizeOptions(options);

    const display = getFieldDisplay(component, value, normalizedOptions);
    const finalValue = formatFinalValue(display);

    return (
      <div key={key ?? name} className="flex flex-col gap-1">
        <div className="font-satoshi font-semibold text-grey-bg text-[14px]">
          {displayLabel}
        </div>
        <div className="font-satoshi font-semibold text-black-text text-[15px] overflow-scroll scrollbar-hidden">
          {finalValue}
        </div>
      </div>
    );
  };

  const renderItem = (
    item: ConfigItem<any>,
    index: number,
    batchIndex: number
  ) => {
    if ("fields" in item && item.kind === "row") {
      return (
        <div key={index} className="grid grid-cols-2 gap-3">
          {item.fields.map((field, i) =>
            renderField(field, batchIndex, `${index}-${i}`)
          )}
        </div>
      );
    }

    return (
      <div key={index} className="w-full">
        {renderField(item.field, batchIndex, index)}
      </div>
    );
  };

  const renderPreviewItem = (
    item: ConfigItem<any>,
    index: number,
    batchData: BatchValues
  ) => {
    if ("fields" in item && item.kind === "row") {
      return (
        <div key={index} className="grid grid-cols-2 gap-3">
          {item.fields.map((field, i) =>
            renderPreviewField(field, batchData, `${index}-${i}`)
          )}
        </div>
      );
    }

    return (
      <div key={index} className="w-full">
        {renderPreviewField(item.field, batchData, index)}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="font-grotesk text-black-text text-[23px] font-medium">
        Batch / Lot details
      </div>
      <Accordion
        title="Batch / Lot details"
        defaultOpen
        isEditing={isEditing}
        showEditIcon={!disableEditing}
        onEditClick={beginEditing}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            {existingBatches.map((batch, batchIdx) => (
              <div
                key={batch._id ?? batchIdx}
                className={`flex flex-col gap-3 ${isEditing ? "border border-grey-light rounded-xl p-3" : ""}`}
              >
                <div className="font-satoshi font-semibold text-black-text">
                  Existing batch {batchIdx + 1}
                </div>
                <div className="flex flex-col gap-3">
                  {sectionConfig.map((item, index) =>
                    renderPreviewItem(item, index, batch)
                  )}
                </div>
              </div>
            ))}
          </div>

          {isEditing && (
            <div className="flex flex-col gap-4">
              <div className="font-satoshi font-semibold text-black-text">
                Add new batches
              </div>
              {newBatches.map((batch, batchIdx) => (
                <div
                  key={batch._id ?? `new-batch-${batchIdx}`}
                  className="flex flex-col gap-3 border border-grey-light rounded-xl p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-satoshi font-semibold text-black-text">
                      New batch {batchIdx + 1}
                    </div>
                    {newBatches.length > 1 && !disableEditing && (
                      <button
                        type="button"
                        className="text-red-500 text-sm font-semibold"
                        onClick={() => removeBatch(batchIdx)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    {sectionConfig.map((item, index) =>
                      renderItem(item, index, batchIdx)
                    )}
                  </div>
                </div>
              ))}
              {!disableEditing && (
                <button
                  type="button"
                  onClick={addBatch}
                  className="w-full h-12 rounded-xl border border-dashed border-grey-light text-black-text font-satoshi font-semibold hover:bg-grey-bg"
                >
                  Add another batch
                </button>
              )}
            </div>
          )}
        </div>
      </Accordion>
    </div>
  );
};

type InventoryInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeInventory: InventoryItem | null;
  businessType: BusinessType;
  onUpdate: (item: InventoryItem) => Promise<void>;
  onAddBatch?: (itemId: string, batches: BatchValues[]) => Promise<void>;
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

const getPrimaryButtonText = (
  inEditMode: boolean,
  isUpdating: boolean,
  isHiding: boolean,
  isHidden: boolean
): string => {
  if (inEditMode) {
    return isUpdating ? "Saving..." : "Save";
  }
  if (isHiding) {
    return isHidden ? "Unhiding..." : "Hiding...";
  }
  return isHidden ? "Unhide item" : "Hide item";
};

const InventoryInfo = ({
  showModal,
  setShowModal,
  activeInventory,
  businessType,
  onUpdate,
  onHide,
  onUnhide,
  onAddBatch,
}: InventoryInfoProps) => {
  const [activeLabel, setActiveLabel] = useState<InventorySectionKey>(
    modalSections[0].key
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [isSectionEditing, setIsSectionEditing] = useState(false);
  const sectionActions = useRef<{
    save: () => Promise<void>;
    cancel: () => void;
    startEditing: () => void;
    isEditing: () => boolean;
  } | null>(null);
  const batchActions = useRef<{
    save: () => Promise<void>;
    cancel: () => void;
    startEditing?: () => void;
    isEditing?: () => boolean;
  } | null>(null);
  const currentLabelConfig =
    modalSections.find((l) => l.key === activeLabel) || modalSections[0];

  useEffect(() => {
    setIsSectionEditing(false);
    sectionActions.current = null;
    batchActions.current = null;
  }, [activeLabel, activeInventory?.id]);

  const handleSectionSave = async (
    section: InventorySectionKey,
    values: Record<string, any>
  ) => {
    if (!activeInventory || isUpdating || isHiding) return;
    setIsUpdating(true);
    const logValidation = (msg: string, details?: Record<string, any>) => {
      console.error(
        `[Inventory] ${msg}`,
        details ? JSON.stringify(details) : ""
      );
    };

    const validateBasicInfo = (): Record<string, string> => {
      const errs: Record<string, string> = {};
      if (!values.name && !activeInventory.basicInfo.name) {
        errs.name = "Name is required";
      }
      if (!values.category && !activeInventory.basicInfo.category) {
        errs.category = "Category is required";
      }
      if (!values.subCategory && !activeInventory.basicInfo.subCategory) {
        errs.subCategory = "Sub category is required";
      }
      return errs;
    };

    const validatePricing = (): Record<string, string> => {
      const errs: Record<string, string> = {};
      const purchase =
        values.purchaseCost ?? activeInventory.pricing.purchaseCost;
      const selling = values.selling ?? activeInventory.pricing.selling;
      if (purchase === "" || purchase === undefined) {
        errs.purchaseCost = "Purchase cost is required";
      } else if (Number.isNaN(Number(purchase))) {
        errs.purchaseCost = "Enter a valid number";
      }
      if (selling === "" || selling === undefined) {
        errs.selling = "Selling price is required";
      } else if (Number.isNaN(Number(selling))) {
        errs.selling = "Enter a valid number";
      }
      return errs;
    };

    const validateStock = (): Record<string, string> => {
      const errs: Record<string, string> = {};
      const current = values.current ?? activeInventory.stock.current;
      const reorder = values.reorderLevel ?? activeInventory.stock.reorderLevel;
      if (current === "" || current === undefined) {
        errs.current = "On hand quantity is required";
      } else if (Number.isNaN(Number(current))) {
        errs.current = "Enter a valid number";
      }
      if (reorder === "" || reorder === undefined) {
        errs.reorderLevel = "Reorder level is required";
      } else if (Number.isNaN(Number(reorder))) {
        errs.reorderLevel = "Enter a valid number";
      }
      return errs;
    };

    try {
      let updated: InventoryItem;
      if (section === "batch") {
        const newBatches: BatchValues[] =
          (values as any).newBatches &&
          Array.isArray((values as any).newBatches)
            ? (values as any).newBatches
            : [];
        if (newBatches.length === 0) {
          logValidation(
            "Batch validation failed: at least one batch required when saving batch section"
          );
          setIsUpdating(false);
          return;
        }
        if (activeInventory.id && onAddBatch) {
          await onAddBatch(activeInventory.id, newBatches);
        }
        setIsUpdating(false);
        return;
      } else {
        const sectionErrors: Record<
          InventorySectionKey,
          Record<string, string>
        > = {
          basicInfo: validateBasicInfo(),
          classification: {},
          pricing: validatePricing(),
          vendor: {},
          stock: validateStock(),
          batch: {},
        };
        const errs = sectionErrors[section];
        if (errs && Object.keys(errs).length > 0) {
          logValidation(`Validation failed for ${section}`, errs);
          setIsUpdating(false);
          return;
        }
        updated = {
          ...activeInventory,
          [section]: {
            ...(activeInventory as any)[section],
            ...values,
          },
        };
      }
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
  const isBatchSection = activeLabel === "batch";
  const inEditMode = isSectionEditing;

  const handlePrimaryAction = async () => {
    if (inEditMode) {
      if (isBatchSection) {
        await batchActions.current?.save?.();
      } else {
        await sectionActions.current?.save?.();
      }
      setIsSectionEditing(false);
      return;
    }
    if (isHidden) {
      await handleUnhide();
    } else {
      await handleHide();
    }
  };

  const handleSecondaryAction = async () => {
    if (inEditMode) {
      if (isBatchSection) {
        batchActions.current?.cancel?.();
      } else {
        sectionActions.current?.cancel?.();
      }
      setIsSectionEditing(false);
      return;
    }
    setShowModal(false);
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">
              {activeInventory?.basicInfo.name}
            </div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <SubLabels
          labels={modalSections}
          activeLabel={activeLabel}
          setActiveLabel={setActiveLabel}
        />

        <div className="flex overflow-y-auto flex-1 scrollbar-hidden">
          {activeInventory && (
            <>
              {activeLabel === "batch" ? (
                <BatchEditor
                  businessType={businessType}
                  inventory={activeInventory}
                  onSave={(vals) => handleSectionSave("batch", vals)}
                  disableEditing={isUpdating || isHiding}
                  onEditingChange={setIsSectionEditing}
                  onRegisterActions={(actions) => {
                    batchActions.current = actions;
                  }}
                />
              ) : (
                <InfoSection
                  businessType={businessType}
                  sectionKey={activeLabel}
                  sectionTitle={currentLabelConfig.name}
                  inventory={activeInventory}
                  onSaveSection={handleSectionSave}
                  disableEditing={isUpdating || isHiding}
                  onEditingChange={setIsSectionEditing}
                  onRegisterActions={(actions) => {
                    sectionActions.current = actions;
                  }}
                />
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Secondary
            href="#"
            text={inEditMode ? "Cancel" : "Close"}
            onClick={handleSecondaryAction}
            isDisabled={isUpdating || isHiding}
            className="h-12! text-lg! tracking-wide!"
          />
          <Primary
            href="#"
            text={getPrimaryButtonText(
              inEditMode,
              isUpdating,
              isHiding,
              isHidden
            )}
            onClick={handlePrimaryAction}
            isDisabled={
              (inEditMode && isUpdating) ||
              (!inEditMode && (isHiding || !activeInventory?.id))
            }
            classname="h-12! text-lg! tracking-wide!"
          />
        </div>
      </div>
    </Modal>
  );
};

export default InventoryInfo;
