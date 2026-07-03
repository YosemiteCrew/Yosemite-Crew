'use client';
import React, {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import {
  AbcClassOptions,
  CategoryOptionsByBusiness,
  DispensaryRecord,
  DispensaryRequestType,
  DispensaryStatus,
  InventoryFiltersState,
  InventoryItem,
  InventoryTurnoverItem,
  SubCategoryOptions,
  SubCategoryByCategory,
} from '@/app/features/inventory/pages/Inventory/types';
import { defaultFilters } from '@/app/features/inventory/pages/Inventory/utils';
import { InventorySectionKey } from '@/app/features/inventory/components/AddInventory/InventoryConfig';
import { BusinessType, BusinessTypes } from '@/app/features/organization/types/org';
import { useOrgStore } from '@/app/stores/orgStore';
import { useLoadOrg } from '@/app/hooks/useLoadOrg';
import { useInventoryModule } from '@/app/hooks/useInventory';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useSearchStore } from '@/app/stores/searchStore';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoInformationCircleOutline } from 'react-icons/io5';
import {
  listDispenseRequests,
  DispenseRequestApi,
} from '@/app/features/inventory/services/dispensaryService';
import { dispensePrescription } from '@/app/features/appointments/services/prescriptionWorkflowService';
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';
import DispensaryDetailModal from '@/app/features/inventory/components/DispensaryDetailModal';
import Modal from '@/app/ui/overlays/Modal';
import Filters from '@/app/ui/filters/Filters';
import { StatusOption, status } from '@/app/features/companions/pages/Companions/types';
import { Primary } from '@/app/ui/primitives/Buttons';
import {
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiFilter,
  FiPlus,
  FiSearch,
  FiSliders,
  FiX,
} from 'react-icons/fi';
import { TbLayoutGrid, TbPill } from 'react-icons/tb';
import { LuFileText } from 'react-icons/lu';
import { FaCaretDown } from 'react-icons/fa6';

const INVENTORY_PAGE_SKELETON = <PageSkeleton variant="list" />;

const InventorySectionSkeleton = () => (
  <div className="h-full min-h-125 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const InventoryTable = dynamic(() => import('@/app/ui/tables/InventoryTable'), {
  loading: () => <InventorySectionSkeleton />,
});
const InventoryTurnoverTable = dynamic(() => import('@/app/ui/tables/InventoryTurnoverTable'), {
  loading: () => <InventorySectionSkeleton />,
});
const InventoryTurnoverFilters = dynamic(() => import('@/app/ui/filters/InventoryTurnoverFilters'));
const DispensaryTable = dynamic(() => import('@/app/ui/tables/DispensaryTable'), {
  loading: () => <InventorySectionSkeleton />,
});
const AddInventory = dynamic(() => import('@/app/features/inventory/components/AddInventory'));
const InventoryInfo = dynamic(() =>
  import('@/app/features/inventory/components').then((module) => ({
    default: module.InventoryInfo,
  }))
);

type InventoryView = 'inventory' | 'turnover' | 'analytics';

const toggleArrayValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

type SortMode = 'name' | 'expiry' | 'stock';

const compareInventoryRows = (a: InventoryItem, b: InventoryItem, sortMode: SortMode): number => {
  if (sortMode === 'expiry') {
    return String(a.batch.expiryDate ?? '').localeCompare(String(b.batch.expiryDate ?? ''));
  }
  if (sortMode === 'stock') {
    return Number(a.stock.current ?? 0) - Number(b.stock.current ?? 0);
  }
  return a.basicInfo.name.localeCompare(b.basicInfo.name);
};

const getSupplierName = (item: InventoryItem) =>
  (item.vendor?.supplierName || item.vendor?.vendor || '').trim();

const filterAndSortInventory = (
  inventory: InventoryItem[],
  filters: InventoryFiltersState,
  debouncedSearch: string,
  sortMode: SortMode
): InventoryItem[] => {
  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const visibilityFilter = (filters.visibility ?? 'ALL').toUpperCase();
  const stockHealthFilter = filters.status.toUpperCase();
  const selectedCategories = filters.categories ?? [];
  const selectedSubCategories = filters.subCategories ?? [];
  const selectedLocations = filters.locations ?? [];
  const selectedAbcClasses = filters.abcClasses ?? [];
  const selectedSuppliers = filters.suppliers ?? [];
  const nextFiltered = inventory.filter((item) => {
    const statusKey = (item.status || item.basicInfo.status || '').toUpperCase();
    const stockHealthKey = (item.stockHealth || '').toUpperCase().replaceAll(' ', '_');
    const categoryMatch =
      (filters.category === 'all' && selectedCategories.length === 0) ||
      selectedCategories.includes(item.basicInfo.category ?? '') ||
      item.basicInfo.category?.toLowerCase() === filters.category.toLowerCase();
    const subCategoryMatch =
      selectedSubCategories.length === 0 ||
      selectedSubCategories.includes(item.basicInfo.subCategory ?? '');
    const locationMatch =
      selectedLocations.length === 0 || selectedLocations.includes(item.stock?.stockLocation ?? '');
    const abcClassMatch =
      selectedAbcClasses.length === 0 || selectedAbcClasses.includes(item.stock?.abcClass ?? '');
    const supplierMatch =
      selectedSuppliers.length === 0 || selectedSuppliers.includes(getSupplierName(item));
    const visibilityMatch = visibilityFilter === 'ALL' || statusKey === visibilityFilter;
    const stockHealthMatch = stockHealthFilter === 'ALL' || stockHealthKey === stockHealthFilter;
    const searchMatch =
      normalizedSearch === '' ||
      item.basicInfo.name.toLowerCase().includes(normalizedSearch) ||
      item.basicInfo.category?.toLowerCase().includes(normalizedSearch) ||
      item.basicInfo.subCategory?.toLowerCase().includes(normalizedSearch) ||
      item.batch?.batch?.toLowerCase().includes(normalizedSearch) ||
      item.basicInfo.description?.toLowerCase().includes(normalizedSearch);
    return (
      categoryMatch &&
      subCategoryMatch &&
      locationMatch &&
      abcClassMatch &&
      supplierMatch &&
      visibilityMatch &&
      stockHealthMatch &&
      searchMatch
    );
  });
  nextFiltered.sort((a, b) => compareInventoryRows(a, b, sortMode));
  return nextFiltered;
};

const getDispenseRequestType = (
  fulfillment: string | undefined,
  patientName: string | null
): 'IN_HOUSE' | 'PATIENT' => {
  if (fulfillment === 'IN_HOUSE') return 'IN_HOUSE';
  return patientName ? 'PATIENT' : 'IN_HOUSE';
};

const mapDispenseRequestToRecord = (req: DispenseRequestApi): DispensaryRecord => {
  const firstMed = req.medications[0];
  const requestType = getDispenseRequestType(firstMed?.fulfillment, req.patientName);
  const amountCents = req.medications.reduce((sum, m) => sum + (m.priceCents ?? 0), 0);
  const parentName = typeof req.parentName === 'string' ? req.parentName : undefined;
  const metadataPetParentName =
    typeof req.metadata?.petParentName === 'string' ? req.metadata.petParentName : undefined;
  const petParentName = parentName ?? metadataPetParentName;

  return {
    id: req.id,
    prescriptionId: req.prescriptionId,
    patient: {
      name: req.patientName ?? '—',
      appointmentId: req.prescription.artifact.appointmentId ?? '—',
      imageUrl: req.patientImageUrl ?? undefined,
      petBreed: req.petBreed ?? undefined,
      petAge: req.petAge ?? undefined,
    },
    status: req.status,
    prescriptionItems: req.medications.map((m) => m.inventoryItemId),
    prescriptionCreated: req.requestedAt,
    amountCents,
    currency: req.currency ?? undefined,
    lead: typeof req.leadName === 'string' ? req.leadName : '—',
    petParentName,
    location: req.location ?? '—',
    requestType,
    invoiceId: req.invoiceId ?? undefined,
    paymentStatus: req.paymentStatus ?? undefined,
    timeDispensed: req.reviewedAt ?? undefined,
    items: req.medications.map((m) => {
      const metadataDoseUnit =
        typeof m.metadata?.doseUnit === 'string' ? m.metadata.doseUnit : undefined;
      const medicationDoseUnit = typeof m.doseUnit === 'string' ? m.doseUnit : undefined;
      const doseUnit = metadataDoseUnit ?? medicationDoseUnit;
      const durationUnit =
        typeof m.metadata?.durationUnit === 'string' ? m.metadata.durationUnit : undefined;
      return {
        name:
          m.inventoryItemName ??
          m.medication ??
          m.medicineName ??
          req.prescription.artifact.summary ??
          m.inventoryItemId,
        quantity: m.quantity ?? 1,
        priceCents: m.priceCents ?? 0,
        isRx: m.isRx,
        isControlled: m.isControlled,
        doseQty: m.doseQty,
        doseUnit,
        frequency: m.frequency,
        frequencyPerDay: m.frequencyPerDay,
        durationDays: m.durationDays,
        durationUnit,
        refillsRemaining: m.refillsRemaining,
        stockUnitQty:
          m.stockUnitQty ?? m.stockUnitQuantity ?? m.packageQuantity ?? m.unitQuantity ?? undefined,
        stockUnitType: m.stockUnitType ?? undefined,
        prescription: {
          dose: m.dosage ?? '',
          freq: m.frequency ?? '',
          duration: m.durationDays == null ? '' : `${m.durationDays} ${durationUnit ?? 'days'}`,
          refill: m.refillsRemaining == null ? '' : String(m.refillsRemaining),
          route: m.route ?? '',
        },
      };
    }),
  };
};

const getVisibilityLabel = (vis: 'ALL' | 'ACTIVE' | 'HIDDEN'): string => {
  if (vis === 'ALL') return 'All inventory';
  if (vis === 'ACTIVE') return 'Active';
  return 'Hidden';
};

type SelectedFilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'expiry', label: 'Expiry date' },
  { key: 'stock', label: 'Stock level' },
];

type InventoryFilterBarProps = {
  filters: InventoryFiltersState;
  selectedFilterChips: SelectedFilterChip[];
  sortMode: SortMode;
  setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFiltersState>>;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
};

const InventoryFilterBar = ({
  filters,
  selectedFilterChips,
  sortMode,
  setFilterOpen,
  setFilters,
  setSortMode,
}: InventoryFilterBarProps) => {
  const [sortOpen, setSortOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const positionPanel = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
      minWidth: rect.width,
      zIndex: 9999,
    });
  }, []);

  useLayoutEffect(() => {
    if (sortOpen) positionPanel();
  }, [sortOpen, positionPanel]);

  useEffect(() => {
    if (!sortOpen) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return;
      setSortOpen(false);
    };
    const handleScroll = () => setSortOpen(false);
    document.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [sortOpen]);

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-center gap-2">
        {(['ACTIVE', 'HIDDEN'] as const).map((vis) => {
          const label = getVisibilityLabel(vis);
          const active = filters.visibility === vis;
          return (
            <button
              key={vis}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, visibility: vis }))}
              className={`inline-flex h-9 items-center rounded-full px-4 text-body-4 border transition-colors ${active ? 'border-blue-text text-blue-text bg-blue-light' : 'border-card-border text-text-primary hover:bg-card-hover bg-white'}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-card-border bg-white px-4 text-body-4 text-text-primary"
        >
          <FiSliders size={18} aria-hidden="true" />
          <span>Filter</span>
          {selectedFilterChips.length > 0 ? (
            <span className="rounded-full bg-badge-blue-bg px-2 text-caption-1 text-badge-blue-text">
              {selectedFilterChips.length}
            </span>
          ) : (
            <FiChevronDown size={16} aria-hidden="true" className="text-text-secondary" />
          )}
        </button>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setSortOpen((v) => !v)}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-card-border bg-white px-4 text-body-4 text-text-primary"
        >
          <FiFilter size={18} aria-hidden="true" />
          <span>Sort by</span>
          <FaCaretDown
            size={13}
            aria-hidden="true"
            className={`text-text-secondary transition-transform ${sortOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {sortOpen &&
          createPortal(
            <div
              ref={panelRef}
              className="rounded-2xl border border-card-border bg-white shadow-[0_8px_24px_rgba(0,0,0,0.10)] overflow-hidden"
              style={dropdownStyle}
            >
              {SORT_OPTIONS.map((option) => {
                const isActive = option.key === sortMode;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setSortMode(option.key);
                      setSortOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-2.5 text-body-4 text-left transition-colors ${isActive ? 'font-medium text-text-primary' : 'text-text-secondary hover:bg-card-hover'}`}
                  >
                    {option.label}
                    {isActive && <span className="ml-auto font-semibold">✓</span>}
                  </button>
                );
              })}
            </div>,
            document.body
          )}
        <div className="relative w-full sm:w-auto sm:min-w-72">
          <FiSearch
            size={18}
            aria-hidden="true"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <input
            aria-label="Search inventory"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Search inventory"
            className="h-11 w-full rounded-2xl border border-card-border bg-white pl-11 pr-4 text-body-4 text-text-primary outline-none focus:border-input-border-active"
          />
        </div>
      </div>
    </div>
  );
};

const DISPENSARY_STATUS_FILTERS: StatusOption[] = [
  status(
    'All',
    'ALL',
    'var(--color-pill-neutral-bg)',
    'var(--color-pill-neutral-text)',
    'var(--color-pill-neutral-border)',
    'var(--color-pill-neutral-text)'
  ),
  status(
    'Pending',
    'PENDING',
    'var(--color-pill-warning-bg)',
    'var(--color-pill-warning-text)',
    'var(--color-pill-warning-border)',
    'var(--color-pill-warning-text)'
  ),
  status(
    'Dispensed',
    'DISPENSED',
    'var(--color-pill-success-bg)',
    'var(--color-pill-success-text)',
    'var(--color-pill-success-border)',
    'var(--color-pill-success-text)'
  ),
  status(
    'Not dispensed',
    'NOT_DISPENSED',
    'var(--color-danger-100)',
    'var(--color-danger-600)',
    'var(--color-danger-400)',
    'var(--color-danger-600)'
  ),
];

type DispensaryFilterBarProps = {
  dispensarySearch: string;
  dispensaryStatusFilter: DispensaryStatus | 'ALL';
  setDispensaryStatusFilter: React.Dispatch<React.SetStateAction<DispensaryStatus | 'ALL'>>;
  setDispensarySearch: React.Dispatch<React.SetStateAction<string>>;
};

const DispensaryFilterBar = ({
  dispensarySearch,
  dispensaryStatusFilter,
  setDispensaryStatusFilter,
  setDispensarySearch,
}: DispensaryFilterBarProps) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2 shrink-0">
      <Filters
        statusOptions={DISPENSARY_STATUS_FILTERS}
        activeStatus={dispensaryStatusFilter}
        setActiveStatus={(v) => setDispensaryStatusFilter(v as DispensaryStatus | 'ALL')}
        className="!w-auto shrink-0"
      />
    </div>
    <div className="relative w-full sm:w-auto sm:min-w-72">
      <FiSearch
        size={18}
        aria-hidden="true"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
      />
      <input
        aria-label="Search dispensary"
        value={dispensarySearch}
        onChange={(event) => setDispensarySearch(event.target.value)}
        placeholder="Search dispensary"
        className="h-11 w-full rounded-2xl border border-card-border bg-white pl-11 pr-4 text-body-4 text-text-primary outline-none focus:border-input-border-active"
      />
    </div>
  </div>
);

type ActiveFilterBarProps = {
  activeView: InventoryView;
  filters: InventoryFiltersState;
  selectedFilterChips: SelectedFilterChip[];
  sortMode: SortMode;
  setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFiltersState>>;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
  dispensarySearch: string;
  dispensaryStatusFilter: DispensaryStatus | 'ALL';
  setDispensaryStatusFilter: React.Dispatch<React.SetStateAction<DispensaryStatus | 'ALL'>>;
  setDispensarySearch: React.Dispatch<React.SetStateAction<string>>;
};

const ActiveFilterBar = (props: ActiveFilterBarProps) => {
  if (props.activeView === 'inventory') {
    return (
      <InventoryFilterBar
        filters={props.filters}
        selectedFilterChips={props.selectedFilterChips}
        sortMode={props.sortMode}
        setFilterOpen={props.setFilterOpen}
        setFilters={props.setFilters}
        setSortMode={props.setSortMode}
      />
    );
  }

  if (props.activeView === 'turnover') {
    return (
      <DispensaryFilterBar
        dispensarySearch={props.dispensarySearch}
        dispensaryStatusFilter={props.dispensaryStatusFilter}
        setDispensaryStatusFilter={props.setDispensaryStatusFilter}
        setDispensarySearch={props.setDispensarySearch}
      />
    );
  }

  return null;
};

const filterDispensaryRecords = (
  records: DispensaryRecord[],
  requestType: DispensaryRequestType,
  statusFilter: DispensaryStatus | 'ALL',
  search: string
) => {
  const normalizedSearch = search.trim().toLowerCase();

  return records.filter((record) => {
    const typeMatch = requestType === 'ALL' || record.requestType === requestType;
    const statusMatch = statusFilter === 'ALL' || record.status === statusFilter;
    const searchMatch =
      normalizedSearch === '' ||
      record.patient.name.toLowerCase().includes(normalizedSearch) ||
      (record.lead || '').toLowerCase().includes(normalizedSearch) ||
      (record.location || '').toLowerCase().includes(normalizedSearch) ||
      (record.items ?? []).some((item) => item.name.toLowerCase().includes(normalizedSearch));

    return typeMatch && statusMatch && searchMatch;
  });
};

type InventoryTableContentProps = {
  activeView: InventoryView;
  turnover: InventoryTurnoverItem[];
  setFilteredTurnoverList: React.Dispatch<React.SetStateAction<InventoryTurnoverItem[]>>;
  turnoverCategoryOptions: string[];
  filteredTurnoverList: InventoryTurnoverItem[];
  filteredInventory: InventoryItem[];
  setActiveInventory: React.Dispatch<React.SetStateAction<InventoryItem | null>>;
  setViewInventory: React.Dispatch<React.SetStateAction<boolean>>;
  setInfoInitialSection: React.Dispatch<React.SetStateAction<InventorySectionKey | undefined>>;
  filteredDispensaryRecords: DispensaryRecord[];
  setActiveDispensaryRecord: React.Dispatch<React.SetStateAction<DispensaryRecord | null>>;
  setDispensaryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onRestock: (item: InventoryItem) => void;
  onDispense?: (record: DispensaryRecord) => Promise<void>;
};

const InventoryTableContent = ({
  activeView,
  turnover,
  setFilteredTurnoverList,
  turnoverCategoryOptions,
  filteredTurnoverList,
  filteredInventory,
  setActiveInventory,
  setViewInventory,
  setInfoInitialSection,
  filteredDispensaryRecords,
  setActiveDispensaryRecord,
  setDispensaryModalOpen,
  onRestock,
  onDispense,
}: InventoryTableContentProps) => {
  if (activeView === 'analytics') {
    return (
      <div className="flex flex-col gap-4 pt-3">
        <InventoryTurnoverFilters
          list={turnover}
          setFilteredList={setFilteredTurnoverList}
          categories={turnoverCategoryOptions}
        />
        <InventoryTurnoverTable filteredList={filteredTurnoverList} />
      </div>
    );
  }

  if (activeView === 'inventory') {
    return (
      <InventoryTable
        setActiveInventory={setActiveInventory}
        setViewInventory={setViewInventory}
        onView={(item) => {
          setActiveInventory(item);
          setInfoInitialSection(undefined);
          setViewInventory(true);
        }}
        filteredList={filteredInventory}
        onRestock={onRestock}
      />
    );
  }

  return (
    <DispensaryTable
      filteredList={filteredDispensaryRecords}
      onView={(record) => {
        setActiveDispensaryRecord(record);
        setDispensaryModalOpen(true);
      }}
      onDispense={onDispense}
    />
  );
};

const getInventoryPageTitle = (view: InventoryView): string => {
  if (view === 'turnover') return 'Dispensary';
  if (view === 'analytics') return 'Turnover';
  return 'Inventory';
};

const toggleSetItem = (prev: Set<string>, key: string): Set<string> => {
  const next = new Set(prev);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
};

type FilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

type InventoryFilterModalProps = {
  filterOpen: boolean;
  selectedFilterChips: FilterChip[];
  setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFiltersState>>;
  filterOpenSections: Set<string>;
  toggleFilterSection: (key: string) => void;
  filters: InventoryFiltersState;
  locationFilterOptions: string[];
  toggleListFilter: (
    key: 'subCategories' | 'locations' | 'abcClasses' | 'suppliers',
    value: string
  ) => void;
  categoryOptions: string[];
  categorySubcategoryOptions: Record<string, string[]>;
  expandedCategories: Set<string>;
  toggleCategoryFilter: (category: string) => void;
  toggleExpandedCategory: (category: string) => void;
  supplierFilterOptions: string[];
};

const InventoryFilterModal = ({
  filterOpen,
  selectedFilterChips,
  setFilterOpen,
  setFilters,
  filterOpenSections,
  toggleFilterSection,
  filters,
  locationFilterOptions,
  toggleListFilter,
  categoryOptions,
  categorySubcategoryOptions,
  expandedCategories,
  toggleCategoryFilter,
  toggleExpandedCategory,
  supplierFilterOptions,
}: InventoryFilterModalProps) => {
  return (
    <Modal showModal={filterOpen} setShowModal={setFilterOpen}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between pb-4 shrink-0">
          <div className="flex items-center gap-2 text-body-3-emphasis text-text-primary">
            <FiSliders size={18} aria-hidden="true" />
            <span>Filter</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedFilterChips.length > 0 && (
              <button
                type="button"
                onClick={() => setFilters(defaultFilters)}
                className="rounded-full border border-blue-text px-4 py-1.5 text-body-4 text-blue-text hover:bg-blue-light transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              aria-label="Close"
              className="inline-flex size-8 items-center justify-center rounded-full text-text-secondary hover:bg-card-hover transition-colors"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>
        {selectedFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-4 shrink-0">
            {selectedFilterChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-badge-blue-bg py-1 pl-3 pr-2 text-caption-1 capitalize text-badge-blue-text"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove ${chip.label}`}
                  onClick={chip.onRemove}
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-badge-blue-text/15 transition-colors"
                >
                  <FiX size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-1 flex-col overflow-y-auto pr-1 divide-y divide-card-border">
          <div>
            <button
              type="button"
              onClick={() => toggleFilterSection('stock-status')}
              className="flex w-full items-center justify-between py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-body-4 text-text-primary">Stock status</span>
                {filters.status !== 'ALL' && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                    1
                  </span>
                )}
              </div>
              {filterOpenSections.has('stock-status') ? (
                <FiChevronUp size={16} className="text-text-secondary" />
              ) : (
                <FiChevronDown size={16} className="text-text-secondary" />
              )}
            </button>
            {filterOpenSections.has('stock-status') && (
              <div className="flex flex-col gap-3 pb-3">
                {(['ALL', 'LOW_STOCK', 'EXPIRED', 'OUT_OF_STOCK'] as const).map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="stock-status"
                      checked={filters.status === s}
                      onChange={() => setFilters((prev) => ({ ...prev, status: s }))}
                      className="accent-blue-text"
                    />
                    <span>{s === 'ALL' ? 'All' : s.replaceAll('_', ' ').toLowerCase()}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {locationFilterOptions.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => toggleFilterSection('location')}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-body-4 text-text-primary">Location</span>
                  {filters.locations.length > 0 && (
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                      {filters.locations.length}
                    </span>
                  )}
                </div>
                {filterOpenSections.has('location') ? (
                  <FiChevronUp size={16} className="text-text-secondary" />
                ) : (
                  <FiChevronDown size={16} className="text-text-secondary" />
                )}
              </button>
              {filterOpenSections.has('location') && (
                <div className="flex flex-col gap-3 pb-3">
                  {locationFilterOptions.map((loc) => (
                    <label
                      key={loc}
                      className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.locations.includes(loc)}
                        onChange={() => toggleListFilter('locations', loc)}
                        className="size-4 accent-blue-text"
                      />
                      <span>{loc}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => toggleFilterSection('category')}
              className="flex w-full items-center justify-between py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-body-4 text-text-primary">Category</span>
                {filters.categories.length > 0 && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                    {filters.categories.length}
                  </span>
                )}
              </div>
              {filterOpenSections.has('category') ? (
                <FiChevronUp size={16} className="text-text-secondary" />
              ) : (
                <FiChevronDown size={16} className="text-text-secondary" />
              )}
            </button>
            {filterOpenSections.has('category') && (
              <div className="flex flex-col pb-3">
                {categoryOptions.map((category) => {
                  const subs = categorySubcategoryOptions[category] ?? [];
                  const isChecked = filters.categories.includes(category);
                  const isExpanded = expandedCategories.has(category);
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 py-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCategoryFilter(category)}
                          className="size-4 accent-blue-text"
                          id={`cat-${category}`}
                        />
                        <label
                          htmlFor={`cat-${category}`}
                          className={`flex-1 text-body-4 cursor-pointer ${isChecked ? 'text-blue-text font-semibold' : 'text-text-primary'}`}
                        >
                          {category}
                        </label>
                        {subs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpandedCategory(category)}
                            className="text-text-secondary"
                          >
                            {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                          </button>
                        )}
                      </div>
                      {subs.length > 0 && isExpanded && (
                        <div className="ml-6 flex flex-col gap-2 pb-2">
                          {subs.map((sub) => (
                            <label
                              key={sub}
                              className="flex items-center gap-3 text-body-4 text-text-secondary cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={filters.subCategories.includes(sub)}
                                onChange={() => toggleListFilter('subCategories', sub)}
                                className="size-4 accent-blue-text"
                              />
                              <span>{sub}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => toggleFilterSection('abc')}
              className="flex w-full items-center justify-between py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-body-4 text-text-primary">ABC</span>
                {filters.abcClasses.length > 0 && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                    {filters.abcClasses.length}
                  </span>
                )}
              </div>
              {filterOpenSections.has('abc') ? (
                <FiChevronUp size={16} className="text-text-secondary" />
              ) : (
                <FiChevronDown size={16} className="text-text-secondary" />
              )}
            </button>
            {filterOpenSections.has('abc') && (
              <div className="flex flex-col gap-3 pb-3">
                {AbcClassOptions.map((cls) => (
                  <label
                    key={cls}
                    className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.abcClasses.includes(cls)}
                      onChange={() => toggleListFilter('abcClasses', cls)}
                      className="size-4 accent-blue-text"
                    />
                    <span>{cls}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {supplierFilterOptions.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => toggleFilterSection('supplier')}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-body-4 text-text-primary">Supplier</span>
                  {filters.suppliers.length > 0 && (
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                      {filters.suppliers.length}
                    </span>
                  )}
                </div>
                {filterOpenSections.has('supplier') ? (
                  <FiChevronUp size={16} className="text-text-secondary" />
                ) : (
                  <FiChevronDown size={16} className="text-text-secondary" />
                )}
              </button>
              {filterOpenSections.has('supplier') && (
                <div className="flex flex-col gap-3 pb-3">
                  {supplierFilterOptions.map((sup) => (
                    <label
                      key={sup}
                      className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.suppliers.includes(sup)}
                        onChange={() => toggleListFilter('suppliers', sup)}
                        className="size-4 accent-blue-text"
                      />
                      <span>{sup}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-card-border pt-5 mt-5 shrink-0">
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-text-primary px-4 text-body-3-emphasis text-white hover:opacity-90 transition-opacity"
          >
            <FiCheck size={18} aria-hidden="true" />
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(defaultFilters);
              setFilterOpen(false);
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-card-border bg-white px-4 text-body-3-emphasis text-text-primary hover:bg-card-hover transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </Modal>
  );
};

type DispensaryFilterModalProps = {
  dispensaryFilterOpen: boolean;
  setDispensaryFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dispensaryStatusFilter: DispensaryStatus | 'ALL';
  setDispensaryStatusFilter: React.Dispatch<React.SetStateAction<DispensaryStatus | 'ALL'>>;
  dispensaryRequestType: DispensaryRequestType;
  setDispensaryRequestType: React.Dispatch<React.SetStateAction<DispensaryRequestType>>;
  filterOpenSections: Set<string>;
  toggleFilterSection: (key: string) => void;
};

const DispensaryFilterModal = ({
  dispensaryFilterOpen,
  setDispensaryFilterOpen,
  dispensaryStatusFilter,
  setDispensaryStatusFilter,
  dispensaryRequestType,
  setDispensaryRequestType,
  filterOpenSections,
  toggleFilterSection,
}: DispensaryFilterModalProps) => {
  return (
    <Modal showModal={dispensaryFilterOpen} setShowModal={setDispensaryFilterOpen}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between pb-4 shrink-0">
          <div className="flex items-center gap-2 text-body-3-emphasis text-text-primary">
            <FiSliders size={18} aria-hidden="true" />
            <span>Filter</span>
          </div>
          <div className="flex items-center gap-2">
            {(dispensaryStatusFilter !== 'ALL' || dispensaryRequestType !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setDispensaryStatusFilter('ALL');
                  setDispensaryRequestType('ALL');
                }}
                className="rounded-full border border-blue-text px-4 py-1.5 text-body-4 text-blue-text hover:bg-blue-light transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={() => setDispensaryFilterOpen(false)}
              aria-label="Close"
              className="inline-flex size-8 items-center justify-center rounded-full text-text-secondary hover:bg-card-hover transition-colors"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto pr-1 divide-y divide-card-border">
          <div>
            <button
              type="button"
              onClick={() => toggleFilterSection('disp-status')}
              className="flex w-full items-center justify-between py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-body-4 text-text-primary">Status</span>
                {dispensaryStatusFilter !== 'ALL' && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                    1
                  </span>
                )}
              </div>
              {filterOpenSections.has('disp-status') ? (
                <FiChevronUp size={16} className="text-text-secondary" />
              ) : (
                <FiChevronDown size={16} className="text-text-secondary" />
              )}
            </button>
            {filterOpenSections.has('disp-status') && (
              <div className="flex flex-col gap-3 pb-3">
                {(
                  [
                    { value: 'ALL', label: 'All' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'DISPENSED', label: 'Dispensed' },
                    { value: 'NOT_DISPENSED', label: 'Not dispensed' },
                  ] as const
                ).map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="dispensary-status"
                      checked={dispensaryStatusFilter === value}
                      onChange={() => setDispensaryStatusFilter(value)}
                      className="accent-blue-text"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => toggleFilterSection('disp-type')}
              className="flex w-full items-center justify-between py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-body-4 text-text-primary">Request type</span>
                {dispensaryRequestType !== 'ALL' && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                    1
                  </span>
                )}
              </div>
              {filterOpenSections.has('disp-type') ? (
                <FiChevronUp size={16} className="text-text-secondary" />
              ) : (
                <FiChevronDown size={16} className="text-text-secondary" />
              )}
            </button>
            {filterOpenSections.has('disp-type') && (
              <div className="flex flex-col gap-3 pb-3">
                {(
                  [
                    { value: 'ALL', label: 'All requests' },
                    { value: 'PATIENT', label: 'Patient' },
                    { value: 'IN_HOUSE', label: 'Inhouse' },
                  ] as const
                ).map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="dispensary-type"
                      checked={dispensaryRequestType === value}
                      onChange={() => setDispensaryRequestType(value)}
                      className="accent-blue-text"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-card-border pt-5 mt-5 shrink-0">
          <button
            type="button"
            aria-label="Apply dispensary filters"
            onClick={() => setDispensaryFilterOpen(false)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-text-primary px-4 text-body-3-emphasis text-white hover:opacity-90 transition-opacity"
          >
            <FiCheck size={18} aria-hidden="true" />
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setDispensaryStatusFilter('ALL');
              setDispensaryRequestType('ALL');
              setDispensaryFilterOpen(false);
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-card-border bg-white px-4 text-body-3-emphasis text-text-primary hover:bg-card-hover transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </Modal>
  );
};

const Inventory = () => {
  useLoadOrg();

  const permissions = usePermissions();
  const canEditInventory = permissions.can(PERMISSIONS.INVENTORY_EDIT_ANY);
  const canViewPrescription = permissions.can(PERMISSIONS.PRESCRIPTION_VIEW_ANY);
  const canEditPrescription =
    permissions.can(PERMISSIONS.PRESCRIPTION_EDIT_ANY) &&
    permissions.can(PERMISSIONS.INVENTORY_EDIT_ANY);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const orgsById = useOrgStore((s) => s.orgsById);
  const primaryOrg = primaryOrgId ? orgsById[primaryOrgId] : null;
  const rooms = useRoomsForPrimaryOrg();
  const headerSearchQuery = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);

  const [businessType, setBusinessType] = useState<BusinessType | null>(primaryOrg?.type ?? null);
  const resolvedBusinessType: BusinessType = businessType ?? 'GROOMER';

  const inventoryModule = useInventoryModule(resolvedBusinessType);
  const { inventory, turnover, status, error: loadError } = inventoryModule;
  const [filteredTurnoverList, setFilteredTurnoverList] = useState<InventoryTurnoverItem[]>([]);

  const [filters, setFilters] = useState<InventoryFiltersState>(defaultFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(headerSearchQuery);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [dispensaryRecords, setDispensaryRecords] = useState<DispensaryRecord[]>([]);

  const fetchDispensaryRecords = useCallback(async () => {
    if (!primaryOrgId) return;
    const orgAtCallTime = primaryOrgId;
    try {
      const data = await listDispenseRequests(orgAtCallTime);
      setDispensaryRecords((prev) =>
        primaryOrgId === orgAtCallTime ? data.map(mapDispenseRequestToRecord) : prev
      );
    } catch {
      // silently fail — table shows empty state
    }
  }, [primaryOrgId]);

  useEffect(() => {
    setDispensaryRecords([]);
    fetchDispensaryRecords();
  }, [fetchDispensaryRecords]);
  const [activeDispensaryRecord, setActiveDispensaryRecord] = useState<DispensaryRecord | null>(
    null
  );
  const [dispensaryModalOpen, setDispensaryModalOpen] = useState(false);
  const [dispensaryRequestType, setDispensaryRequestType] = useState<DispensaryRequestType>('ALL');
  const [dispensarySearch, setDispensarySearch] = useState('');
  const [dispensaryFilterOpen, setDispensaryFilterOpen] = useState(false);
  const [dispensaryStatusFilter, setDispensaryStatusFilter] = useState<DispensaryStatus | 'ALL'>(
    'ALL'
  );
  const [addPopup, setAddPopup] = useState(false);
  const [viewInventory, setViewInventory] = useState(false);
  const [infoInitialSection, setInfoInitialSection] = useState<InventorySectionKey | undefined>(
    undefined
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOpenSections, setFilterOpenSections] = useState<Set<string>>(
    new Set(['stock-status'])
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const toggleFilterSection = (key: string) =>
    setFilterOpenSections((prev) => toggleSetItem(prev, key));
  const toggleExpandedCategory = (cat: string) =>
    setExpandedCategories((prev) => toggleSetItem(prev, cat));
  const [activeInventory, setActiveInventory] = useState<InventoryItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<InventoryView>('inventory');
  const [sortMode, setSortMode] = useState<'name' | 'expiry' | 'stock'>('name');
  const { plannerSectionRef } = usePlannerAutoLock({ activeView: 'list', topOffset: 72 });

  const loadingList = status === 'loading';
  const error = actionError ?? loadError;

  useEffect(() => {
    const org = primaryOrgId ? orgsById[primaryOrgId] : null;
    if (org?.type && BusinessTypes.includes(org.type)) {
      setBusinessType(org.type);
    } else if (businessType === null) {
      setBusinessType('GROOMER');
    }
  }, [primaryOrgId, orgsById, businessType]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search || headerSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [headerSearchQuery, filters.search]);

  const categoryOptions = useMemo(() => {
    const configured = CategoryOptionsByBusiness[resolvedBusinessType] ?? [];
    const fromItems = inventory
      .map((item) => item.basicInfo.category?.trim())
      .filter((category): category is string => Boolean(category));
    return Array.from(new Set([...configured, ...fromItems]));
  }, [resolvedBusinessType, inventory]);

  const turnoverCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(turnover.map((item) => item.category?.trim()).filter(Boolean) as string[])
      ),
    [turnover]
  );

  useEffect(() => {
    setFilteredTurnoverList(turnover);
  }, [turnover]);

  const stockLocationOptions = useMemo(() => {
    const roomNames = rooms
      .map((room) => room?.name?.trim())
      .filter((name): name is string => Boolean(name));
    return roomNames.length > 0 ? Array.from(new Set(roomNames)) : undefined;
  }, [rooms]);

  const locationFilterOptions = useMemo(() => {
    const fromItems = inventory
      .map((item) => item.stock?.stockLocation?.trim())
      .filter((location): location is string => Boolean(location));
    return Array.from(new Set([...(stockLocationOptions ?? []), ...fromItems]));
  }, [inventory, stockLocationOptions]);

  const supplierFilterOptions = useMemo(() => {
    const suppliers = new Set<string>();
    inventory.forEach((item) => {
      const supplier = getSupplierName(item);
      if (supplier) suppliers.add(supplier);
    });
    return Array.from(suppliers);
  }, [inventory]);

  const categorySubcategoryOptions = useMemo(() => {
    return categoryOptions.reduce<Record<string, string[]>>((acc, category) => {
      const configured = SubCategoryByCategory[category] ?? [];
      const fromItems = inventory.reduce<string[]>((subCategories, item) => {
        const subCategory = item.basicInfo.subCategory?.trim();
        if (item.basicInfo.category === category && subCategory) {
          subCategories.push(subCategory);
        }
        return subCategories;
      }, []);
      const fallback = configured.length > 0 ? configured : SubCategoryOptions.slice(0, 6);
      acc[category] = Array.from(new Set([...fallback, ...fromItems]));
      return acc;
    }, {});
  }, [categoryOptions, inventory]);

  const { wrapperClassName, plannerSectionClassName } = getPlannerLayoutClassNames({
    activeView: 'list',
    listWrapperClassName:
      'w-full flex flex-col gap-4 h-[calc(100vh-236px)] min-h-[540px] max-h-[calc(100vh-236px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-104px)] lg:min-h-[calc(100dvh-104px)] lg:max-h-[calc(100dvh-104px)]',
    plannerClassName: '',
  });

  useEffect(() => {
    setFilteredInventory(filterAndSortInventory(inventory, filters, debouncedSearch, sortMode));
  }, [inventory, filters, debouncedSearch, sortMode]);

  useEffect(() => {
    setActiveInventory((prev) => {
      if (!filteredInventory.length) return null;
      return filteredInventory.find((i) => i.id === prev?.id) ?? filteredInventory[0];
    });
    if (!filteredInventory.length) {
      setViewInventory(false);
    }
  }, [filteredInventory]);

  useEffect(() => {
    const inventoryId = String(searchParams.get('inventoryId') ?? '').trim();
    if (!inventoryId) return;
    if (handledDeepLinkRef.current === inventoryId) return;

    const target = inventory.find((item) => item.id === inventoryId);
    if (target === undefined) return;

    setActiveInventory(target);
    setInfoInitialSection(undefined);
    setViewInventory(true);
    handledDeepLinkRef.current = inventoryId;
  }, [inventory, searchParams]);

  const handleCreateInventory = useCallback(
    async (data: InventoryItem) => {
      if (!primaryOrgId) {
        throw new Error('No organisation selected.');
      }
      setSavingItem(true);
      setActionError(null);
      try {
        const created = await inventoryModule.createItem(data);
        setActiveInventory(created);
        setAddPopup(false);
      } catch (err) {
        setActionError('Unable to save inventory item.');
        throw err;
      } finally {
        setSavingItem(false);
      }
    },
    [primaryOrgId, inventoryModule]
  );

  const handleUpdateInventory = useCallback(
    async (updatedItem: InventoryItem) => {
      if (!updatedItem.id) return;
      setActionError(null);
      try {
        const mapped = await inventoryModule.updateItem(updatedItem);
        setActiveInventory(mapped);
      } catch (err) {
        setActionError('Unable to update inventory item.');
        throw err;
      }
    },
    [inventoryModule]
  );

  const handleAddBatch = useCallback(
    async (itemId: string, batches: any[]) => {
      if (!itemId) return;
      setActionError(null);
      try {
        await inventoryModule.addBatch(itemId, batches);
      } catch (err) {
        setActionError('Unable to add batch.');
        throw err;
      }
    },
    [inventoryModule]
  );

  const handleUpdateBatch = useCallback(
    async (itemId: string, batches: any[]) => {
      if (!itemId) return;
      setActionError(null);
      try {
        await inventoryModule.updateBatch(itemId, batches);
      } catch (err) {
        setActionError('Unable to update batch.');
        throw err;
      }
    },
    [inventoryModule]
  );

  const handleHideInventory = useCallback(
    async (itemId: string) => {
      if (!itemId) return;
      setActionError(null);
      try {
        const res = await inventoryModule.hideItem(itemId);
        if (res !== undefined) {
          setActiveInventory(res);
        }
      } catch (err) {
        setActionError('Unable to hide inventory item.');
        throw err;
      }
    },
    [inventoryModule]
  );

  const handleUnhideInventory = useCallback(
    async (itemId: string) => {
      if (!itemId) return;
      setActionError(null);
      try {
        const res = await inventoryModule.unhideItem(itemId);
        if (res !== undefined) {
          setActiveInventory(res);
        }
      } catch (err) {
        setActionError('Unable to unhide inventory item.');
        throw err;
      }
    },
    [inventoryModule]
  );

  const handleRestock = useCallback((item: InventoryItem) => {
    setActiveInventory(item);
    setInfoInitialSection('stock');
    setViewInventory(true);
  }, []);

  const toggleCategoryFilter = useCallback(
    (category: string) => {
      setFilters((prev) => {
        const categories = toggleArrayValue(prev.categories ?? [], category);
        const categorySubcategories = categorySubcategoryOptions[category] ?? [];
        const subCategories = categories.includes(category)
          ? prev.subCategories
          : prev.subCategories.filter(
              (subCategory) => !categorySubcategories.includes(subCategory)
            );
        return {
          ...prev,
          category: categories.length === 1 ? categories[0] : 'all',
          categories,
          subCategories,
        };
      });
    },
    [categorySubcategoryOptions]
  );

  const toggleListFilter = useCallback(
    (key: 'subCategories' | 'locations' | 'abcClasses' | 'suppliers', value: string) => {
      setFilters((prev) => ({
        ...prev,
        [key]: toggleArrayValue(prev[key] ?? [], value),
      }));
    },
    []
  );

  const selectedFilterChips = useMemo(() => {
    const chips: SelectedFilterChip[] = [];
    if (filters.status !== 'ALL') {
      chips.push({
        id: `status-${filters.status}`,
        label: filters.status.replaceAll('_', ' ').toLowerCase(),
        onRemove: () => setFilters((prev) => ({ ...prev, status: 'ALL' })),
      });
    }
    (filters.categories ?? []).forEach((category) =>
      chips.push({
        id: `category-${category}`,
        label: category,
        onRemove: () => toggleCategoryFilter(category),
      })
    );
    (filters.subCategories ?? []).forEach((subCategory) =>
      chips.push({
        id: `subCategory-${subCategory}`,
        label: subCategory,
        onRemove: () => toggleListFilter('subCategories', subCategory),
      })
    );
    (filters.locations ?? []).forEach((location) =>
      chips.push({
        id: `location-${location}`,
        label: location,
        onRemove: () => toggleListFilter('locations', location),
      })
    );
    (filters.abcClasses ?? []).forEach((abcClass) =>
      chips.push({
        id: `abcClass-${abcClass}`,
        label: abcClass,
        onRemove: () => toggleListFilter('abcClasses', abcClass),
      })
    );
    (filters.suppliers ?? []).forEach((supplier) =>
      chips.push({
        id: `supplier-${supplier}`,
        label: supplier,
        onRemove: () => toggleListFilter('suppliers', supplier),
      })
    );
    if (filters.category !== 'all' && !(filters.categories ?? []).includes(filters.category)) {
      chips.push({
        id: `categorySingle-${filters.category}`,
        label: filters.category,
        onRemove: () => setFilters((prev) => ({ ...prev, category: 'all' })),
      });
    }
    return chips;
  }, [filters, toggleCategoryFilter, toggleListFilter]);

  const pageTitle = getInventoryPageTitle(activeView);
  const filteredDispensaryRecords = useMemo(
    () =>
      filterDispensaryRecords(
        dispensaryRecords,
        dispensaryRequestType,
        dispensaryStatusFilter,
        dispensarySearch
      ),
    [dispensaryRecords, dispensaryRequestType, dispensaryStatusFilter, dispensarySearch]
  );

  const handleDispense = useCallback(
    async (record: DispensaryRecord) => {
      if (!primaryOrgId) return;
      try {
        await dispensePrescription(primaryOrgId, record.prescriptionId);
        fetchDispensaryRecords();
      } catch {
        // silently fail
      }
    },
    [fetchDispensaryRecords, primaryOrgId]
  );

  return (
    <div className="relative min-w-0 flex h-full min-h-0 flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-3! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-3!">
      <div className="flex justify-between items-center w-full flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-text-primary text-heading-2 flex items-center gap-2">
            <span>{pageTitle}</span>
            {activeView === 'inventory' && (
              <GlassTooltip
                content="Organize stock, track batches and expiry, and monitor turnover so you know what to reorder and which items need attention."
                side="bottom"
              >
                <button
                  type="button"
                  aria-label="Inventory info"
                  className="inline-flex size-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
                >
                  <IoInformationCircleOutline size={20} />
                </button>
              </GlassTooltip>
            )}
          </h1>
        </div>
        <div className="ml-auto flex items-center justify-end gap-3 flex-wrap">
          {canEditInventory && activeView !== 'turnover' && (
            <Primary
              href="#"
              text={savingItem ? 'Saving...' : 'Add item'}
              onClick={() => setAddPopup(true)}
              isDisabled={savingItem || !primaryOrgId}
              icon={<FiPlus size={18} aria-hidden="true" />}
              className="h-11!"
            />
          )}
          {activeView === 'analytics' ? (
            <button
              type="button"
              onClick={() => setActiveView('inventory')}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-text-primary bg-white px-5 text-body-4-emphasis text-text-primary hover:bg-card-hover transition-colors"
            >
              Inventory
            </button>
          ) : (
            <GlassTooltip content="Turnover analytics" side="bottom">
              <button
                type="button"
                aria-label="Turnover analytics"
                onClick={() => setActiveView('analytics')}
                className="inline-flex size-11 items-center justify-center rounded-full border border-card-border bg-white text-text-primary hover:bg-card-hover transition-colors"
              >
                <LuFileText size={20} aria-hidden="true" />
              </button>
            </GlassTooltip>
          )}
          {canViewPrescription && activeView !== 'analytics' && (
            <fieldset
              aria-label="Inventory view"
              className="relative flex h-10 w-[260px] items-stretch overflow-hidden rounded-[999px]! border border-card-border bg-white m-0 p-0"
            >
              <legend className="sr-only">Inventory view</legend>
              <div
                aria-hidden
                className={`pointer-events-none absolute top-0 bottom-0 w-1/2 rounded-[999px]! transition-all duration-300 ease-in-out ${activeView === 'inventory' ? 'bg-(--color-primary-700)' : 'bg-success-700'}`}
                style={{ transform: `translateX(${activeView === 'inventory' ? '0%' : '100%'})` }}
              />
              <button
                type="button"
                onClick={() => setActiveView('inventory')}
                aria-pressed={activeView === 'inventory'}
                className={`relative z-10 flex w-1/2 items-center justify-center gap-1.5 text-body-4 transition-colors ${
                  activeView === 'inventory'
                    ? 'text-white duration-150 delay-150'
                    : 'text-text-secondary hover:text-text-primary duration-100 delay-0'
                }`}
              >
                <TbLayoutGrid size={15} aria-hidden="true" className="shrink-0" />
                <span>Inventory</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('turnover')}
                aria-pressed={activeView === 'turnover'}
                className={`relative z-10 flex w-1/2 items-center justify-center gap-1.5 text-body-4 transition-colors ${
                  activeView === 'turnover'
                    ? 'text-white duration-150 delay-150'
                    : 'text-text-secondary hover:text-text-primary duration-100 delay-0'
                }`}
              >
                <TbPill size={15} aria-hidden="true" className="shrink-0" />
                <span>Dispensary</span>
              </button>
            </fieldset>
          )}
        </div>
      </div>

      {error && <div className="text-red-500 text-sm font-satoshi font-semibold">{error}</div>}

      <PermissionGate allOf={[PERMISSIONS.INVENTORY_VIEW_ANY]} fallback={<Fallback />}>
        <div className={wrapperClassName}>
          <div className="flex w-full shrink-0 flex-col gap-4">
            <ActiveFilterBar
              activeView={activeView}
              filters={filters}
              selectedFilterChips={selectedFilterChips}
              sortMode={sortMode}
              setFilterOpen={setFilterOpen}
              setFilters={setFilters}
              setSortMode={setSortMode}
              dispensarySearch={dispensarySearch}
              dispensaryStatusFilter={dispensaryStatusFilter}
              setDispensaryStatusFilter={setDispensaryStatusFilter}
              setDispensarySearch={setDispensarySearch}
            />
          </div>

          {loadingList && activeView === 'inventory' && (
            <div className="text-grey-noti text-sm font-satoshi">Loading inventory…</div>
          )}

          <div ref={plannerSectionRef} className={plannerSectionClassName}>
            <InventoryTableContent
              activeView={activeView}
              turnover={turnover}
              setFilteredTurnoverList={setFilteredTurnoverList}
              turnoverCategoryOptions={turnoverCategoryOptions}
              filteredTurnoverList={filteredTurnoverList}
              filteredInventory={filteredInventory}
              setActiveInventory={setActiveInventory}
              setViewInventory={setViewInventory}
              setInfoInitialSection={setInfoInitialSection}
              filteredDispensaryRecords={filteredDispensaryRecords}
              setActiveDispensaryRecord={setActiveDispensaryRecord}
              setDispensaryModalOpen={setDispensaryModalOpen}
              onRestock={handleRestock}
              onDispense={canEditPrescription ? handleDispense : undefined}
            />
          </div>
        </div>

        <DispensaryDetailModal
          record={activeDispensaryRecord}
          showModal={dispensaryModalOpen}
          setShowModal={setDispensaryModalOpen}
          organisationId={primaryOrgId ?? ''}
          onActionComplete={fetchDispensaryRecords}
        />

        <AddInventory
          showModal={addPopup}
          setShowModal={setAddPopup}
          businessType={resolvedBusinessType}
          onSubmit={handleCreateInventory}
          stockLocationOptions={stockLocationOptions}
          organisationId={primaryOrgId ?? undefined}
        />

        <InventoryFilterModal
          filterOpen={filterOpen}
          selectedFilterChips={selectedFilterChips}
          setFilterOpen={setFilterOpen}
          setFilters={setFilters}
          filterOpenSections={filterOpenSections}
          toggleFilterSection={toggleFilterSection}
          filters={filters}
          locationFilterOptions={locationFilterOptions}
          toggleListFilter={toggleListFilter}
          categoryOptions={categoryOptions}
          categorySubcategoryOptions={categorySubcategoryOptions}
          expandedCategories={expandedCategories}
          toggleCategoryFilter={toggleCategoryFilter}
          toggleExpandedCategory={toggleExpandedCategory}
          supplierFilterOptions={supplierFilterOptions}
        />

        <DispensaryFilterModal
          dispensaryFilterOpen={dispensaryFilterOpen}
          setDispensaryFilterOpen={setDispensaryFilterOpen}
          dispensaryStatusFilter={dispensaryStatusFilter}
          setDispensaryStatusFilter={setDispensaryStatusFilter}
          dispensaryRequestType={dispensaryRequestType}
          setDispensaryRequestType={setDispensaryRequestType}
          filterOpenSections={filterOpenSections}
          toggleFilterSection={toggleFilterSection}
        />

        {activeInventory && (
          <InventoryInfo
            showModal={viewInventory}
            setShowModal={setViewInventory}
            activeInventory={activeInventory}
            businessType={activeInventory.businessType ?? resolvedBusinessType}
            onUpdate={handleUpdateInventory}
            onAddBatch={handleAddBatch}
            onUpdateBatch={handleUpdateBatch}
            onHide={handleHideInventory}
            onUnhide={handleUnhideInventory}
            canEdit={canEditInventory}
            stockLocationOptions={stockLocationOptions}
            initialSection={infoInitialSection}
            organisationId={primaryOrgId ?? undefined}
          />
        )}
      </PermissionGate>
    </div>
  );
};

const ProtectedInventory = () => {
  return (
    <ProtectedRoute skeleton={INVENTORY_PAGE_SKELETON}>
      <OrgGuard skeleton={INVENTORY_PAGE_SKELETON}>
        <Suspense fallback={INVENTORY_PAGE_SKELETON}>
          <Inventory />
        </Suspense>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedInventory;
