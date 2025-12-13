import React, { useEffect, useMemo, useState } from "react";
import { BatchValues, InventoryItem } from "@/app/pages/Inventory/types";
import { BusinessType } from "@/app/types/org";
import { IoIosCloseCircleOutline } from "react-icons/io";
import Modal from "../Modal";
import SubLabels from "../Labels/SubLabels";
import InfoSection from "./InfoSection";
import { Primary, Secondary } from "../Buttons";
import { InventorySectionKey } from "@/app/components/AddInventory/InventoryConfig";
import FormInput from "../Inputs/FormInput/FormInput";
import Datepicker from "../Inputs/Datepicker";
import Dropdown from "../Inputs/Dropdown/Dropdown";
import Accordion from "../Accordion/Accordion";
import { ConfigItem, InventoryFormConfig } from "../AddInventory/InventoryConfig";
import { useRef } from "react";
import { calculateBatchTotals, toStringSafe, formatDisplayDate } from "@/app/pages/Inventory/utils";

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
    actions:
      | {
          save: () => Promise<void>;
          cancel: () => void;
        }
      | null
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

  const beginEditing = () => {
    if (disableEditing) return;
    setIsEditing(true);
    if (newBatches.length === 0) {
      setNewBatches([{ ...emptyBatch }]);
    }
  };

  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  const handleChange = (index: number, name: string, value: string) => {
    setNewBatches((prev) => {
      const next = [...prev];
      next[index] = { ...(next[index] ?? emptyBatch), [name]: value };
      return next;
    });
    if (!isEditing) setIsEditing(true);
  };

  const addBatch = () => {
    setNewBatches((prev) => [...prev, { ...emptyBatch }]);
    if (!isEditing) setIsEditing(true);
  };

  const removeBatch = (index: number) => {
    setNewBatches((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ ...emptyBatch }];
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    const meaningfulNew = newBatches.filter((b) =>
      Object.values(b || {}).some((v) => toStringSafe(v) !== "")
    );
    await onSave({
      newBatches: meaningfulNew,
    });
    setIsEditing(false);
    setNewBatches([]);
  };

  const handleCancel = () => {
    setNewBatches([]);
    setIsEditing(false);
  };

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
  }, [onRegisterActions, handleSave, handleCancel, beginEditing, inventory, isEditing]);

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

  const renderField = (
    field: any,
    batchIndex: number,
    key?: React.Key
  ) => {
    const { placeholder, component, options, name } = field;
    const value = newBatches[batchIndex]?.[name] ?? "";

    if (component === "date") {
      const currentDate = parseDate(value);
      return (
        <Datepicker
          key={key ?? name}
          currentDate={currentDate}
          setCurrentDate={(next) => {
            const resolved =
              typeof next === "function"
                ? (next as (prev: Date | null) => Date | null)(currentDate)
                : next;
            if (!resolved) {
              handleChange(batchIndex, name, "");
              return;
            }
            handleChange(batchIndex, name, formatDate(resolved));
          }}
          placeholder={placeholder || ""}
          type="input"
          className="min-h-12!"
        />
      );
    }

    if (component === "dropdown") {
      return (
        <Dropdown
          key={key ?? name}
          placeholder={placeholder || ""}
          value={value}
          onChange={(v) => handleChange(batchIndex, name, v)}
          className="min-h-12!"
          dropdownClassName="top-[55px]! !h-fit"
          options={options || []}
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
        onChange={(e) => handleChange(batchIndex, name, e.target.value)}
        className="min-h-12!"
      />
    );
  };

  const renderPreviewField = (
    field: any,
    batchData: BatchValues,
    key?: React.Key
  ) => {
    const { placeholder, label, component, options, name } = field;
    const value = (batchData as any)?.[name] as any;
    const displayLabel = placeholder || label || name;
    const normalizedOptions = normalizeOptions(options);

    let display: string | string[] = value;
    if (component === "multiSelect") {
      if (Array.isArray(value)) {
        display = value;
      } else if (typeof value === "string" && value.trim() !== "") {
        display = value.split(",").map((v: string) => v.trim());
      }
    } else if (component === "dropdown") {
      display =
        value !== undefined && value !== ""
          ? resolveLabel(normalizedOptions, value)
          : "—";
    } else if (component === "date") {
      display = formatDateValue(value);
    }

    const finalValue = Array.isArray(display)
      ? display.length
        ? display.join(", ")
        : "—"
      : display !== undefined && display !== ""
        ? String(display)
        : "—";

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
                className="flex flex-col gap-3 border border-grey-light rounded-xl p-3"
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
              {newBatches.map((_, batchIdx) => (
                <div
                  key={`new-${batchIdx}`}
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
    try {
      let updated: InventoryItem;
      if (section === "batch") {
        const newBatches: BatchValues[] =
          (values as any).newBatches && Array.isArray((values as any).newBatches)
            ? (values as any).newBatches
            : [];
        if (newBatches.length === 0) {
          setIsUpdating(false);
          return;
        }
        if (activeInventory.id && onAddBatch) {
          await onAddBatch(activeInventory.id, newBatches);
        }
        setIsUpdating(false);
        return;
      } else {
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
          {activeInventory ? activeLabel === "batch" ? (
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
          ) : null}
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
            text={
              inEditMode
                ? isUpdating
                  ? "Saving..."
                  : "Save"
                : isHiding
                  ? isHidden
                    ? "Unhiding..."
                    : "Hiding..."
                  : isHidden
                    ? "Unhide item"
                    : "Hide item"
            }
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
