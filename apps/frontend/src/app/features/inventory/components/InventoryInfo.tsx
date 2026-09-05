import React, { useState } from 'react';
import { BatchValues, InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { BusinessType } from '@/app/features/organization/types/org';
import {
  formatCurrencyValue,
  formatPercentValue,
  getGrossProfitPerUnit,
  getMarginPercent,
  getStockValue,
} from '@/app/features/inventory/pages/Inventory/utils';
import {
  ConfigItem,
  InventorySectionKey,
} from '@/app/features/inventory/components/AddInventory/InventoryConfig';
import { useBatchEditor } from '@/app/features/inventory/components/useBatchEditor';
import { useInventoryInfoActions } from '@/app/features/inventory/components/useInventoryInfoActions';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Datepicker from '@/app/ui/inputs/Datepicker';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import InfoSection from '@/app/features/inventory/components/InfoSection';
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
    <div className="text-[13px] font-bold text-[var(--ink)]">Add new batches</div>
    {newBatches.map((batch, batchIdx) => (
      <div
        key={batch._id ?? `new-batch-${batchIdx}`}
        className="flex flex-col gap-3 border border-grey-light rounded-xl p-3"
      >
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-bold text-[var(--ink)]">New batch {batchIdx + 1}</div>
          {newBatches.length > 1 && !disableEditing && (
            <button
              type="button"
              className="text-caption-1 text-[var(--danger-text)]"
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
  /* The editor's state machine, handlers and imperative handle live in a hook,
     so this component is the markup plus what the markup reads. It was 327
     lines, about 240 of them logic. */
  const {
    existingBatches,
    newBatches,
    isEditing,
    editableExistingBatches,
    sectionConfig,
    handleChange,
    handleExistingChange,
    addBatch,
    removeBatch,
    beginEditing,
  } = useBatchEditor({ businessType, inventory, disableEditing, onSave, onEditingChange, ref });

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
      <div className="text-[14px] font-bold tracking-[-0.01em] text-[var(--ink)]">
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
                    <div className="text-[13px] font-bold text-[var(--ink)]">
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
      <div className="text-caption-1 text-text-secondary">{displayLabel}</div>
      <div className="text-body-4-emphasis text-text-primary overflow-scroll scrollbar-hidden">
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

const toBatchList = (value: unknown): BatchValues[] => {
  /* v8 ignore next 3 -- unreachable: BatchEditor is the only caller of the batch save path and always passes both lists as arrays */
  if (!Array.isArray(value)) {
    return [];
  }
  return value as BatchValues[];
};

const PricingCurrencySummary = ({ inventory }: { inventory: InventoryItem }) => {
  const currency = inventory.currency;
  return (
    <div className="flex flex-col gap-2 px-4 pt-2 text-[13px] text-[var(--ink-muted)]">
      <div>
        <span>Gross profit per unit : </span>
        <span className="rounded-full bg-[var(--inset)] px-2 py-[1px] text-[12.5px] font-bold tabular-nums text-[var(--ink)]">
          {formatCurrencyValue(getGrossProfitPerUnit(inventory), currency)}
        </span>
      </div>
      <div className="mb-4">
        <span>Margin : </span>
        <span className="rounded-full bg-[var(--inset)] px-2 py-[1px] text-[12.5px] font-bold tabular-nums text-[var(--ink)]">
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
  const [isSectionEditing, setIsSectionEditing] = useState(false);
  // modalSections lists every InventorySectionKey and activeLabel only ever holds
  // one of those keys, so the lookup always hits.
  const currentLabelConfig = modalSections.find((l) => l.key === activeLabel)!;

  // Leave edit mode whenever the section or item changes — adjusted during render
  // via a prev-compare (same pattern as the tab reset above).
  const sectionResetKey = `${activeLabel}:${activeInventory?.id ?? ''}`;
  const [prevSectionResetKey, setPrevSectionResetKey] = useState(sectionResetKey);
  if (sectionResetKey !== prevSectionResetKey) {
    setPrevSectionResetKey(sectionResetKey);
    setIsSectionEditing(false);
  }

  /* The panel's actions live in a hook so this component is markup plus the
     state the markup itself owns. It carried seven pieces of state and six
     async handlers inline, which is what React Doctor's no-giant-component was
     pointing at. Nothing moved into the JSX or out of it, so the tests and
     stories assert exactly what they asserted before. */
  const {
    isUpdating,
    isHiding,
    showDeleteConfirm,
    setShowDeleteConfirm,
    sectionActions,
    batchActions,
    isHidden,
    handleSectionSave,
    handleHide,
    handlePrimaryAction,
    handleSecondaryAction,
  } = useInventoryInfoActions({
    activeInventory,
    activeLabel,
    isSectionEditing,
    setIsSectionEditing,
    setShowModal,
    onUpdate,
    onHide,
    onUnhide,
    onAddBatch,
    onUpdateBatch,
    toBatchList,
    sectionValidationHandlers,
  });
  const inEditMode = isSectionEditing;

  return (
    <>
      <Modal showModal={showModal} setShowModal={setShowModal} size="md">
        <div className="flex flex-col h-full gap-6">
          <ModalHeader
            title={activeInventory?.basicInfo.name ?? ''}
            meta={`${activeInventory?.basicInfo.category || 'Inventory item'}${
              activeInventory?.basicInfo.skuCode ? ` · ${activeInventory.basicInfo.skuCode}` : ''
            }`}
            onClose={() => setShowModal(false)}
          />

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

          <ModalFooter align="stretch">
            <Secondary
              href="#"
              text={inEditMode ? 'Cancel' : 'Close'}
              onClick={handleSecondaryAction}
              isDisabled={isUpdating || isHiding}
            />
            {/* Outside edit mode the trailing action hides or deletes the item: a
                destructive action is the outlined danger button, never the dark
                primary. Save and Unhide stay primary because they construct. */}
            {(canEdit || inEditMode) &&
              (!inEditMode && !isHidden ? (
                <Secondary
                  danger
                  href="#"
                  text={getPrimaryButtonText(inEditMode, isUpdating, isHiding, isHidden)}
                  onClick={handlePrimaryAction}
                  isDisabled={isHiding || !activeInventory?.id}
                />
              ) : (
                <Primary
                  href="#"
                  text={getPrimaryButtonText(inEditMode, isUpdating, isHiding, isHidden)}
                  onClick={handlePrimaryAction}
                  isDisabled={
                    (inEditMode && isUpdating) ||
                    (!inEditMode && (isHiding || !activeInventory?.id))
                  }
                />
              ))}
          </ModalFooter>
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
