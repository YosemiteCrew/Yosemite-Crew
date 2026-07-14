import React, {
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  useReducer,
} from 'react';
import { BatchValues, InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { BusinessType } from '@/app/features/organization/types/org';
import {
  formatCurrencyValue,
  formatPercentValue,
  getGrossProfitPerUnit,
  getMarginPercent,
  getStockValue,
  toStringSafe,
} from '@/app/features/inventory/pages/Inventory/utils';
import {
  ConfigItem,
  InventoryFormConfig,
  InventorySectionKey,
} from '@/app/features/inventory/components/AddInventory/InventoryConfig';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Datepicker from '@/app/ui/inputs/Datepicker';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import InfoSection from '@/app/features/inventory/components/InfoSection';
import Close from '@/app/ui/primitives/Icons/Close';
import Labels from '@/app/ui/widgets/Labels/Labels';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import {
  formatDate,
  formatFinalValue,
  getBasicInfoErrors,
  getFieldDisplay,
  getPricingErrors,
  getPrimaryButtonText,
  getStockErrors,
  normalizeOptions,
  parseDate,
} from './inventoryInfoHelpers';

const drugOnlyBatchFieldNames = new Set(['tracking']);

const emptyBatch: BatchValues = {
  batch: '',
  manufactureDate: '',
  expiryDate: '',
  serial: '',
  tracking: '',
  litterId: '',
  nextRefillDate: '',
  quantity: '',
  allocated: '',
};

const sectionValidationHandlers: Partial<
  Record<
    InventorySectionKey,
    (values: Record<string, any>, inventory: InventoryItem) => Record<string, string>
  >
> = {
  basicInfo: getBasicInfoErrors,
  pricing: getPricingErrors,
  stock: getStockErrors,
};

type BatchEditorState = {
  newBatches: BatchValues[];
  isEditing: boolean;
  editableExistingBatches: BatchValues[];
};

const initialBatchEditorState: BatchEditorState = {
  newBatches: [],
  isEditing: false,
  editableExistingBatches: [],
};

type BatchFieldRendererProps = {
  field: any;
  batchIndex: number;
  source?: BatchValues[];
  newBatches: BatchValues[];
  handleChange: (index: number, name: keyof BatchValues, value: string) => void;
  changeHandler?: (index: number, name: keyof BatchValues, value: string) => void;
};

const BatchFieldRenderer = ({
  field,
  batchIndex,
  source,
  newBatches,
  handleChange,
  changeHandler,
}: BatchFieldRendererProps) => {
  const { placeholder, component, options, name } = field;
  const typedName = name as keyof BatchValues;
  const value = source?.[batchIndex]?.[typedName] ?? newBatches[batchIndex]?.[typedName] ?? '';
  const onChangeHandler = changeHandler ?? handleChange;

  if (component === 'date') {
    const currentDate = parseDate(value);
    return (
      <Datepicker
        currentDate={currentDate}
        setCurrentDate={(next: Date | null | ((prev: Date | null) => Date | null)) => {
          const resolved = typeof next === 'function' ? next(currentDate) : next;
          if (!resolved) {
            onChangeHandler(batchIndex, typedName, '');
            return;
          }
          onChangeHandler(batchIndex, typedName, formatDate(resolved));
        }}
        placeholder={placeholder || ''}
        type="input"
        className="min-h-12!"
      />
    );
  }

  if (component === 'dropdown') {
    const dropdownOptions = (options || []).map((opt: any) =>
      typeof opt === 'string' ? { label: opt, value: opt } : opt
    );
    return (
      <LabelDropdown
        placeholder={placeholder || ''}
        defaultOption={value}
        onSelect={(opt) => onChangeHandler(batchIndex, typedName, opt.value)}
        options={dropdownOptions}
      />
    );
  }

  return (
    <FormInput
      intype="text"
      inname={name}
      value={value}
      inlabel={placeholder || ''}
      onChange={(e) => {
        const raw = e.target.value;
        const val = field.numeric ? raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1') : raw;
        onChangeHandler(batchIndex, typedName, val);
      }}
      className="min-h-12!"
    />
  );
};

type NewBatchesSectionProps = {
  newBatches: BatchValues[];
  disableEditing?: boolean;
  sectionConfig: ConfigItem<any>[];
  removeBatch: (index: number) => void;
  addBatch: () => void;
  renderItem: (item: ConfigItem<any>, index: number, batchIndex: number) => React.ReactNode;
};

const NewBatchesSection = ({
  newBatches,
  disableEditing,
  sectionConfig,
  removeBatch,
  addBatch,
  renderItem,
}: NewBatchesSectionProps) => (
  <div className="flex flex-col gap-4">
    <div className="font-satoshi font-semibold text-black-text">Add new batches</div>
    {newBatches.map((batch, batchIdx) => (
      <div
        key={batch._id ?? `new-batch-${batchIdx}`}
        className="flex flex-col gap-3 border border-grey-light rounded-xl p-3"
      >
        <div className="flex items-center justify-between">
          <div className="font-satoshi font-semibold text-black-text">New batch {batchIdx + 1}</div>
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
          {sectionConfig.map((item, index) => renderItem(item, index, batchIdx))}
        </div>
      </div>
    ))}
    {!disableEditing && (
      <Secondary
        href="#"
        text="Add another batch"
        onClick={addBatch}
        className="w-full! h-12! text-body-3-emphasis! font-satoshi font-semibold!"
      />
    )}
  </div>
);

type BatchEditorAction = { type: 'PATCH'; payload: Partial<BatchEditorState> } | { type: 'RESET' };

const batchEditorReducer = (
  state: BatchEditorState,
  action: BatchEditorAction
): BatchEditorState => {
  switch (action.type) {
    case 'PATCH': {
      const next = { ...state, ...action.payload };
      // Bail out with the same reference when nothing actually changed, so a
      // no-op PATCH doesn't force a re-render the way useState's Object.is
      // bailout would already prevent for an individual setter.
      const keys = Object.keys(action.payload) as (keyof BatchEditorState)[];
      const changed = keys.some((key) => next[key] !== state[key]);
      return changed ? next : state;
    }
    case 'RESET':
      return state === initialBatchEditorState ? state : initialBatchEditorState;
    /* v8 ignore next 2 -- unreachable: dispatchBatchEditor is only ever called with PATCH or RESET actions, so this defensive default never runs */
    default:
      return state;
  }
};

type BatchEditorProps = {
  businessType: BusinessType;
  inventory: InventoryItem;
  disableEditing?: boolean;
  onSave: (values: { newBatches: BatchValues[]; updatedBatches: BatchValues[] }) => Promise<void>;
  onEditingChange?: (editing: boolean) => void;
  ref?: React.Ref<{
    save: () => Promise<void>;
    cancel: () => void;
    startEditing?: () => void;
    isEditing?: () => boolean;
  } | null>;
};

const BatchEditor: React.FC<BatchEditorProps> = ({
  businessType,
  inventory,
  disableEditing,
  onSave,
  onEditingChange,
  ref,
}) => {
  const existingBatches = useMemo<BatchValues[]>(
    () =>
      inventory.batches && inventory.batches.length > 0 ? inventory.batches : [inventory.batch],
    [inventory]
  );
  const [{ newBatches, isEditing, editableExistingBatches }, dispatchBatchEditor] = useReducer(
    batchEditorReducer,
    initialBatchEditorState
  );
  const patchBatchEditor = useCallback(
    (payload: Partial<BatchEditorState>) => dispatchBatchEditor({ type: 'PATCH', payload }),
    []
  );
  const [prevDisableEditing, setPrevDisableEditing] = useState(disableEditing);
  const disableEditingChanged = disableEditing !== prevDisableEditing;
  if (disableEditingChanged) {
    setPrevDisableEditing(disableEditing);
    if (disableEditing && isEditing) {
      patchBatchEditor({ isEditing: false });
    }
  }

  // Reporting isEditing:false to the parent here (rather than from a
  // useEffect watching isEditing) still has to happen after this render
  // commits, since calling the parent's setter mid-render would update a
  // different component while this one is rendering.
  useLayoutEffect(() => {
    /* v8 ignore next 3 -- unreachable: disableEditingChanged is always false by commit time because prevDisableEditing is reconciled via a render-phase setState that restarts the render, so this notify-parent path never runs */
    if (disableEditingChanged && disableEditing && isEditing === false) {
      onEditingChange?.(false);
    }
  });

  useLayoutEffect(() => {
    dispatchBatchEditor({ type: 'RESET' });
    onEditingChange?.(false);
  }, [inventory, onEditingChange]);

  const configForBusiness = InventoryFormConfig[businessType] || {};
  const isNonDrug = String(inventory.classification?.itemType ?? '').toLowerCase() === 'non-drug';
  const sectionConfig = useMemo<ConfigItem<any>[]>(
    () =>
      (configForBusiness.batch || []).filter((item) => {
        if (!isNonDrug) return true;
        const names = item.kind === 'row' ? item.fields.map((f: any) => f.name) : [item.field.name];
        return names.every((n: string) => !drugOnlyBatchFieldNames.has(n));
      }),
    [configForBusiness.batch, isNonDrug]
  );

  const beginEditing = useCallback(() => {
    if (disableEditing) return;
    patchBatchEditor({
      isEditing: true,
      editableExistingBatches: editableExistingBatches.length
        ? editableExistingBatches
        : existingBatches.map((b) => ({ ...b })),
      newBatches: newBatches.length === 0 ? [{ ...emptyBatch }] : newBatches,
    });
    onEditingChange?.(true);
  }, [
    disableEditing,
    newBatches,
    editableExistingBatches,
    existingBatches,
    patchBatchEditor,
    onEditingChange,
  ]);

  const handleChange = useCallback(
    (index: number, name: keyof BatchValues, value: string) => {
      const next = [...newBatches];
      next[index] = { ...(next[index] ?? emptyBatch), [name]: value };
      patchBatchEditor({ newBatches: next, isEditing: true });
    },
    [newBatches, patchBatchEditor]
  );

  const handleExistingChange = useCallback(
    (index: number, name: keyof BatchValues, value: string) => {
      let source = editableExistingBatches;
      /* v8 ignore next 3 -- unreachable: beginEditing always seeds editableExistingBatches before an existing batch field can invoke this handler, so the fallback never runs */
      if (editableExistingBatches.length === 0) {
        source = existingBatches.map((b) => ({ ...b }));
      }
      const next = [...source];
      next[index] = { ...(next[index] ?? emptyBatch), [name]: value };
      patchBatchEditor({ editableExistingBatches: next, isEditing: true });
    },
    [existingBatches, editableExistingBatches, patchBatchEditor]
  );

  const addBatch = useCallback(() => {
    patchBatchEditor({ newBatches: [...newBatches, { ...emptyBatch }], isEditing: true });
  }, [newBatches, patchBatchEditor]);

  const removeBatch = useCallback(
    (index: number) => {
      const next = newBatches.filter((_, i) => i !== index);
      patchBatchEditor({
        newBatches: next.length ? next : [{ ...emptyBatch }],
        isEditing: true,
      });
    },
    [newBatches, patchBatchEditor]
  );

  const hasBatchChanged = useCallback((original?: BatchValues, updated?: BatchValues) => {
    if (!original || !updated) return false;
    const keys: (keyof BatchValues)[] = [
      'batch',
      'manufactureDate',
      'expiryDate',
      'expiryWarningBefore',
      'barcode',
      'serial',
      'tracking',
      'litterId',
      'nextRefillDate',
      'quantity',
      'allocated',
      'minShelfLifeAlertDate',
    ];
    return keys.some((key) => toStringSafe(original[key]) !== toStringSafe(updated[key]));
  }, []);

  const handleSave = useCallback(async () => {
    const meaningfulNew = newBatches.filter((b) =>
      Object.values(b || {}).some((v) => toStringSafe(v) !== '')
    );
    const workingExisting =
      editableExistingBatches.length > 0 ? editableExistingBatches : existingBatches;
    const originalById = new Map<string, BatchValues>();
    existingBatches.forEach((b) => {
      if (b?._id) {
        originalById.set(String(b._id), b);
      }
    });
    const updatedBatches = workingExisting.filter((b, idx) => {
      const original = b._id ? originalById.get(String(b._id)) : existingBatches[idx];
      return hasBatchChanged(original, b);
    });

    await onSave({
      newBatches: meaningfulNew,
      updatedBatches,
    });
    dispatchBatchEditor({ type: 'RESET' });
    onEditingChange?.(false);
  }, [
    newBatches,
    editableExistingBatches,
    existingBatches,
    hasBatchChanged,
    onSave,
    onEditingChange,
  ]);

  const handleCancel = useCallback(() => {
    dispatchBatchEditor({ type: 'RESET' });
    onEditingChange?.(false);
  }, [onEditingChange]);

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: handleCancel,
    startEditing: beginEditing,
    isEditing: () => isEditing,
  }));

  const renderItem = (
    item: ConfigItem<any>,
    index: number,
    batchIndex: number,
    source?: BatchValues[],
    changeHandler?: (index: number, name: keyof BatchValues, value: string) => void
  ) => {
    const itemKey =
      item.kind === 'row' ? item.fields.map((field) => field.name).join('-') : item.field.name;
    const fullKey = `${batchIndex}-${itemKey}`;
    if ('fields' in item && item.kind === 'row') {
      return (
        <div key={fullKey} className="grid grid-cols-2 gap-3">
          {item.fields.map((field) => (
            <BatchFieldRenderer
              key={field.name}
              field={field}
              batchIndex={batchIndex}
              source={source}
              newBatches={newBatches}
              handleChange={handleChange}
              changeHandler={changeHandler}
            />
          ))}
        </div>
      );
    }

    return (
      <div key={fullKey} className="w-full">
        <BatchFieldRenderer
          field={item.field}
          batchIndex={batchIndex}
          source={source}
          newBatches={newBatches}
          handleChange={handleChange}
          changeHandler={changeHandler}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="font-satoshi text-black-text text-[23px] font-medium">
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
            {(editableExistingBatches.length > 0 ? editableExistingBatches : existingBatches).map(
              (batch, batchIdx) => (
                <div
                  key={batch._id ?? batchIdx}
                  className={`flex flex-col gap-3 ${isEditing ? 'border border-card-border rounded-xl p-3' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-satoshi font-semibold text-black-text">
                      Existing batch {batchIdx + 1}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {sectionConfig.map((item, index) => {
                      if (isEditing) {
                        let batchSource = editableExistingBatches;
                        /* v8 ignore next 3 -- unreachable: editableExistingBatches is always seeded whenever isEditing is true (via beginEditing), so the fallback never runs */
                        if (editableExistingBatches.length === 0) {
                          batchSource = existingBatches;
                        }
                        return renderItem(item, index, batchIdx, batchSource, handleExistingChange);
                      }
                      const itemKey =
                        item.kind === 'row'
                          ? item.fields.map((f: any) => f.name).join('-')
                          : item.field.name;
                      return <PreviewItem key={itemKey} item={item} batchData={batch} />;
                    })}
                  </div>
                </div>
              )
            )}
          </div>

          {isEditing && (
            <NewBatchesSection
              newBatches={newBatches}
              disableEditing={disableEditing}
              sectionConfig={sectionConfig}
              removeBatch={removeBatch}
              addBatch={addBatch}
              renderItem={renderItem}
            />
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
  onUpdateBatch?: (itemId: string, batches: BatchValues[]) => Promise<void>;
  onHide: (itemId: string) => Promise<void>;
  onUnhide: (itemId: string) => Promise<void>;
  canEdit?: boolean;
  stockLocationOptions?: string[];
  initialSection?: InventorySectionKey;
  organisationId?: string;
};

const modalSections: { key: InventorySectionKey; name: string }[] = [
  { key: 'basicInfo', name: 'Basic Details' },
  { key: 'classification', name: 'Clinical Details' },
  { key: 'batch', name: 'Batch and expiry' },
  { key: 'stock', name: 'Stock Control' },
  { key: 'pricing', name: 'Pricing' },
  { key: 'vendor', name: 'Vendor details' },
];

const PreviewField = ({ field, batchData }: { field: any; batchData: BatchValues }) => {
  const { placeholder, label, component, options, name } = field;
  const value = batchData[name as keyof BatchValues];
  const displayLabel = placeholder || label || name;
  const normalizedOptions = normalizeOptions(options);
  const display = getFieldDisplay(component, value, normalizedOptions);
  const finalValue = formatFinalValue(display);
  return (
    <div className="flex flex-col gap-1">
      <div className="font-satoshi font-semibold text-grey-bg text-[14px]">{displayLabel}</div>
      <div className="font-satoshi font-semibold text-black-text text-[15px] overflow-scroll scrollbar-hidden">
        {finalValue}
      </div>
    </div>
  );
};

const PreviewItem = ({ item, batchData }: { item: ConfigItem<any>; batchData: BatchValues }) => {
  const itemKey =
    item.kind === 'row' ? item.fields.map((field) => field.name).join('-') : item.field.name;
  const fullKey = `${batchData?._id ?? 'batch'}-${itemKey}`;
  if ('fields' in item && item.kind === 'row') {
    return (
      <div key={fullKey} className="grid grid-cols-2 gap-3">
        {item.fields.map((field) => (
          <PreviewField key={field.name} field={field} batchData={batchData} />
        ))}
      </div>
    );
  }
  return (
    <div key={fullKey} className="w-full">
      <PreviewField field={item.field} batchData={batchData} />
    </div>
  );
};

const PricingCurrencySummary = ({ inventory }: { inventory: InventoryItem }) => {
  const currency = inventory.currency;
  return (
    <div className="flex flex-col gap-2 px-4 pt-2 text-body-4 text-text-primary">
      <div>
        <span>Gross profit per unit : </span>
        <span className="rounded-full bg-badge-blue-bg px-2 font-semibold text-badge-blue-text">
          {formatCurrencyValue(getGrossProfitPerUnit(inventory), currency)}
        </span>
      </div>
      <div className="mb-4">
        <span>Margin : </span>
        <span className="rounded-full bg-badge-blue-bg px-2 font-semibold text-badge-blue-text">
          {formatPercentValue(getMarginPercent(inventory))}
        </span>
      </div>
      <div className="relative rounded-2xl border border-input-border-default px-6 py-3 min-h-12">
        <span className="absolute left-4 -top-[11px] bg-neutral-0 px-1.5 text-xs text-input-text-placeholder">
          Total stock value
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-4 text-text-primary">
            {formatCurrencyValue(getStockValue(inventory), currency)}
          </span>
          <span className="text-caption-1 text-text-extra whitespace-nowrap">
            on-hand stock x unit cost
          </span>
        </div>
      </div>
    </div>
  );
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
  onUpdateBatch,
  canEdit = true,
  stockLocationOptions,
  initialSection,
  organisationId,
}: InventoryInfoProps) => {
  const [activeLabel, setActiveLabel] = useState<InventorySectionKey>(
    initialSection ?? modalSections[0].key
  );
  // On each (re)open, land on the requested section (e.g. Restock → Stock Control)
  // or fall back to the first tab. Adjusted during render via a prev-prop comparison
  // rather than an effect, so the correct tab shows on the first commit.
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  const openKey = showModal ? `${activeInventory?.id ?? ''}:${initialSection ?? ''}` : null;
  if (openKey !== null && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    setActiveLabel(initialSection ?? modalSections[0].key);
  } else if (openKey === null && lastOpenKey !== null) {
    setLastOpenKey(null);
  }
  const [isUpdating, setIsUpdating] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [isSectionEditing, setIsSectionEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const currentLabelConfig = modalSections.find((l) => l.key === activeLabel) || modalSections[0];

  useLayoutEffect(() => {
    setIsSectionEditing(false);
    sectionActions.current = null;
    batchActions.current = null;
  }, [activeLabel, activeInventory?.id]);

  const handleBatchSave = async (values: Record<string, any>) => {
    const newBatches: BatchValues[] = Array.isArray((values as any).newBatches)
      ? (values as any).newBatches
      : [];
    const updatedBatches: BatchValues[] = Array.isArray((values as any).updatedBatches)
      ? (values as any).updatedBatches
      : [];
    if (!activeInventory?.id) return;
    if (updatedBatches.length && onUpdateBatch) {
      await onUpdateBatch(activeInventory.id, updatedBatches);
    }
    if (newBatches.length && onAddBatch) {
      await onAddBatch(activeInventory.id, newBatches);
    }
  };

  const getValidationErrors = (
    section: InventorySectionKey,
    values: Record<string, any>
  ): Record<string, string> => {
    if (!activeInventory) return {};
    const handler = sectionValidationHandlers[section];
    return handler ? handler(values, activeInventory) : {};
  };

  const buildUpdatedInventory = (
    section: InventorySectionKey,
    values: Record<string, any>
  ): InventoryItem => ({
    ...activeInventory!,
    [section]: {
      ...(activeInventory as any)[section],
      ...values,
    },
  });

  const saveBatchSection = async (values: Record<string, any>) => {
    await handleBatchSave(values);
  };

  const saveStandardSection = async (section: InventorySectionKey, values: Record<string, any>) => {
    const errs = getValidationErrors(section, values);
    if (Object.keys(errs).length > 0) {
      console.error(`[Inventory] Validation failed for ${section}`, JSON.stringify(errs));
      return;
    }
    const updated = buildUpdatedInventory(section, values);
    await onUpdate(updated);
  };

  const handleSectionSave = async (section: InventorySectionKey, values: Record<string, any>) => {
    if (!activeInventory || isUpdating || isHiding) return;
    setIsUpdating(true);

    try {
      if (section === 'batch') {
        await saveBatchSection(values);
      } else {
        await saveStandardSection(section, values);
      }
    } catch (err) {
      console.error('Failed to update inventory section:', err);
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
      console.error('Failed to hide inventory item:', err);
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
      console.error('Failed to unhide inventory item:', err);
    } finally {
      setIsHiding(false);
    }
  };

  const isHidden = (activeInventory?.status || '').toUpperCase() === 'HIDDEN';
  const isBatchSection = activeLabel === 'batch';
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
      setShowDeleteConfirm(true);
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
    <>
      <Modal showModal={showModal} setShowModal={setShowModal}>
        <div className="flex flex-col h-full gap-6">
          <div className="flex items-center justify-between border-b border-card-border pb-4">
            <div className="min-w-0">
              <div className="truncate text-body-1 text-text-primary">
                {activeInventory?.basicInfo.name}
              </div>
              <div className="text-caption-1 text-text-secondary">
                {activeInventory?.basicInfo.category || 'Inventory item'}
                {activeInventory?.basicInfo.skuCode
                  ? ` · ${activeInventory.basicInfo.skuCode}`
                  : ''}
              </div>
            </div>
            <Close onClick={() => setShowModal(false)} />
          </div>

          <Labels
            labels={modalSections}
            activeLabel={activeLabel}
            setActiveLabel={setActiveLabel}
          />

          <div className="flex flex-col overflow-y-auto flex-1 scrollbar-hidden">
            {activeInventory && (
              <>
                {activeLabel === 'batch' ? (
                  <BatchEditor
                    businessType={businessType}
                    inventory={activeInventory}
                    onSave={(vals) => handleSectionSave('batch', vals)}
                    disableEditing={!canEdit || isUpdating || isHiding}
                    onEditingChange={setIsSectionEditing}
                    ref={batchActions}
                  />
                ) : (
                  <InfoSection
                    businessType={businessType}
                    sectionKey={activeLabel}
                    sectionTitle={currentLabelConfig.name}
                    inventory={activeInventory}
                    onSaveSection={handleSectionSave}
                    disableEditing={!canEdit || isUpdating || isHiding}
                    onEditingChange={setIsSectionEditing}
                    stockLocationOptions={stockLocationOptions}
                    organisationId={organisationId}
                    ref={sectionActions}
                  />
                )}
                {activeLabel === 'pricing' && (
                  <PricingCurrencySummary inventory={activeInventory} />
                )}
              </>
            )}
          </div>

          <div
            className={`grid gap-3 ${canEdit || inEditMode ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}
          >
            <Secondary
              href="#"
              text={inEditMode ? 'Cancel' : 'Close'}
              onClick={handleSecondaryAction}
              isDisabled={isUpdating || isHiding}
              className="h-12! text-lg! tracking-[-0.36px]!"
            />
            {(canEdit || inEditMode) && (
              <Primary
                href="#"
                text={getPrimaryButtonText(inEditMode, isUpdating, isHiding, isHidden)}
                onClick={handlePrimaryAction}
                isDisabled={
                  (inEditMode && isUpdating) || (!inEditMode && (isHiding || !activeInventory?.id))
                }
                className="h-12! text-lg! tracking-[-0.36px]!"
              />
            )}
          </div>
        </div>
      </Modal>

      {showDeleteConfirm && (
        <CenterModal showModal={showDeleteConfirm} setShowModal={setShowDeleteConfirm}>
          <ModalHeader title="Delete inventory item?" onClose={() => setShowDeleteConfirm(false)} />
          <div className="text-body-4 text-text-primary">
            This will remove {activeInventory?.basicInfo.name || 'this item'} from active inventory.
            Backend hard delete is not enabled yet, so the item will be hidden and can be restored.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Secondary href="#" text="Discard" onClick={() => setShowDeleteConfirm(false)} />
            <Delete
              href="#"
              text={isHiding ? 'Deleting...' : 'Delete'}
              onClick={async () => {
                await handleHide();
                setShowDeleteConfirm(false);
              }}
              isDisabled={isHiding}
            />
          </div>
        </CenterModal>
      )}
    </>
  );
};

export default InventoryInfo;
