"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import InventoryFilters from "@/app/components/Filters/InventoryFilters";
import InventoryTurnoverFilters from "@/app/components/Filters/InventoryTurnoverFilters";
import InventoryTable from "@/app/components/DataTable/InventoryTable";
import AddInventory from "@/app/components/AddInventory";
import InventoryTurnoverTable from "@/app/components/DataTable/InventoryTurnoverTable";
import InventoryInfo from "@/app/components/InventoryInfo";
import {
  CategoryOptionsByBusiness,
  InventoryFiltersState,
  InventoryItem,
  InventoryTurnoverItem,
} from "./types";
import { defaultFilters } from "./utils";
import { BusinessType, BusinessTypes } from "@/app/types/org";
import { useOrgStore } from "@/app/stores/orgStore";
import { useLoadOrg } from "@/app/hooks/useLoadOrg";
import { useInventoryModule } from "@/app/hooks/useInventory";
import OrgGuard from "@/app/components/OrgGuard";
import { useSearchStore } from "@/app/stores/searchStore";
import { usePermissions } from "@/app/hooks/usePermissions";
import { PERMISSIONS } from "@/app/utils/permissions";
import { PermissionGate } from "@/app/components/PermissionGate";
import Fallback from "@/app/components/Fallback";

const Inventory = () => {
  useLoadOrg();

  const { can } = usePermissions();
  const canEditInventory = can(PERMISSIONS.INVENTORY_EDIT_ANY);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const orgsById = useOrgStore((s) => s.orgsById);
  const primaryOrg = primaryOrgId ? orgsById[primaryOrgId] : null;
  const headerSearchQuery = useSearchStore((s) => s.query);

  const [businessType, setBusinessType] = useState<BusinessType | null>(
    primaryOrg?.type as BusinessType
  );
  const resolvedBusinessType: BusinessType = businessType ?? "GROOMER";

  const {
    inventory,
    turnover,
    status,
    error: loadError,
    createItem,
    updateItem,
    hideItem,
    unhideItem,
    addBatch,
    updateBatch,
  } = useInventoryModule(resolvedBusinessType);

  const [filters, setFilters] = useState<InventoryFiltersState>(defaultFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(headerSearchQuery);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>(
    []
  );
  const [filteredTurnoverList, setFilteredTurnoverList] = useState<
    InventoryTurnoverItem[]
  >([]);
  const [addPopup, setAddPopup] = useState(false);
  const [viewInventory, setViewInventory] = useState(false);
  const [activeInventory, setActiveInventory] = useState<InventoryItem | null>(
    null
  );
  const [savingItem, setSavingItem] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadingList = status === "loading";
  const error = actionError ?? loadError;

  useEffect(() => {
    const org = primaryOrgId ? orgsById[primaryOrgId] : null;
    if (org?.type && BusinessTypes.includes(org.type as BusinessType)) {
      setBusinessType(org.type as BusinessType);
    } else if (!businessType) {
      setBusinessType("GROOMER");
    }
  }, [primaryOrgId, orgsById, businessType]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(headerSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [headerSearchQuery]);

  const categoryOptions = useMemo(
    () => CategoryOptionsByBusiness[resolvedBusinessType] ?? [],
    [resolvedBusinessType]
  );

  useEffect(() => {
    setFilteredTurnoverList(turnover);
  }, [turnover]);

  useEffect(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();
    const statusFilter = filters.status.toUpperCase();
    const nextFiltered = inventory.filter((item) => {
      const statusKey = (
        item.status ||
        item.basicInfo.status ||
        ""
      ).toUpperCase();
      const stockHealthKey = (item.stockHealth || "").toUpperCase();
      const isStockHealthFilter =
        statusFilter !== "ALL" &&
        statusFilter !== "ACTIVE" &&
        statusFilter !== "HIDDEN";
      const categoryMatch =
        filters.category === "all" ||
        item.basicInfo.category?.toLowerCase() ===
          filters.category.toLowerCase();
      const statusMatch =
        statusFilter === "ALL" ||
        (isStockHealthFilter
          ? stockHealthKey === statusFilter
          : statusKey === statusFilter);
      const searchMatch =
        !normalizedSearch ||
        item.basicInfo.name.toLowerCase().includes(normalizedSearch) ||
        item.basicInfo.description?.toLowerCase().includes(normalizedSearch);
      return categoryMatch && statusMatch && searchMatch;
    });
    setFilteredInventory(nextFiltered);
  }, [inventory, filters.category, filters.status, debouncedSearch]);

  useEffect(() => {
    setActiveInventory((prev) => {
      if (!filteredInventory.length) return null;
      if (prev) {
        const existing = filteredInventory.find((i) => i.id === prev.id);
        if (existing) return existing;
      }
      return filteredInventory[0];
    });
    if (!filteredInventory.length) {
      setViewInventory(false);
    }
  }, [filteredInventory]);

  const handleCreateInventory = useCallback(
    async (data: InventoryItem) => {
      if (!primaryOrgId) {
        throw new Error("No organisation selected.");
      }
      setSavingItem(true);
      setActionError(null);
      try {
        const created = await createItem(data);
        setActiveInventory(created);
        setAddPopup(false);
      } catch (err) {
        setActionError("Unable to save inventory item.");
        throw err;
      } finally {
        setSavingItem(false);
      }
    },
    [primaryOrgId, createItem]
  );

  const handleUpdateInventory = useCallback(
    async (updatedItem: InventoryItem) => {
      if (!updatedItem.id) return;
      setActionError(null);
      try {
        const mapped = await updateItem(updatedItem);
        setActiveInventory(mapped);
      } catch (err) {
        setActionError("Unable to update inventory item.");
        throw err;
      }
    },
    [updateItem]
  );

  const handleAddBatch = useCallback(
    async (itemId: string, batches: any[]) => {
      if (!itemId) return;
      setActionError(null);
      try {
        await addBatch(itemId, batches);
      } catch (err) {
        setActionError("Unable to add batch.");
        throw err;
      }
    },
    [addBatch]
  );

  const handleUpdateBatch = useCallback(
    async (itemId: string, batches: any[]) => {
      if (!itemId) return;
      setActionError(null);
      try {
        await updateBatch(itemId, batches);
      } catch (err) {
        setActionError("Unable to update batch.");
        throw err;
      }
    },
    [updateBatch]
  );

  const handleHideInventory = useCallback(
    async (itemId: string) => {
      if (!itemId) return;
      setActionError(null);
      try {
        const res = await hideItem(itemId);
        if (res) {
          setActiveInventory(res);
        }
      } catch (err) {
        setActionError("Unable to hide inventory item.");
        throw err;
      }
    },
    [hideItem]
  );

  const handleUnhideInventory = useCallback(
    async (itemId: string) => {
      if (!itemId) return;
      setActionError(null);
      try {
        const res = await unhideItem(itemId);
        if (res) {
          setActiveInventory(res);
        }
      } catch (err) {
        setActionError("Unable to unhide inventory item.");
        throw err;
      }
    },
    [unhideItem]
  );

  return (
    <div className="flex flex-col gap-3 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex justify-between items-center w-full flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <div className="text-text-primary text-heading-1">Inventory</div>
          <p className="text-body-3 text-text-secondary max-w-3xl">
            Organize stock, track batches and expiry, and monitor turnover so you
            know what to reorder and which items need attention.
          </p>
        </div>
        {canEditInventory && (
          <Primary
            href="#"
            text={savingItem ? "Saving..." : "Add"}
            onClick={() => setAddPopup(true)}
            isDisabled={savingItem || !primaryOrgId}
          />
        )}
      </div>

      {error && (
        <div className="text-red-500 text-sm font-satoshi font-semibold">
          {error}
        </div>
      )}

      <PermissionGate
        allOf={[PERMISSIONS.INVENTORY_VIEW_ANY]}
        fallback={<Fallback />}
      >
        <div className="w-full flex flex-col gap-6">
          <InventoryFilters
            filters={filters}
            onChange={setFilters}
            categories={categoryOptions}
            loading={loadingList}
          />
          {loadingList && (
            <div className="text-grey-noti text-sm font-satoshi">
              Loading inventory...
            </div>
          )}
          <InventoryTable
            setActiveInventory={setActiveInventory}
            setViewInventory={setViewInventory}
            filteredList={filteredInventory}
          />
        </div>

        <div className="w-full flex flex-col gap-6">
          <div className="text-text-primary text-heading-1">Turnover</div>
          <InventoryTurnoverFilters
            list={turnover}
            setFilteredList={setFilteredTurnoverList}
          />
          <InventoryTurnoverTable filteredList={filteredTurnoverList} />
        </div>

        <AddInventory
          showModal={addPopup}
          setShowModal={setAddPopup}
          businessType={resolvedBusinessType}
          onSubmit={handleCreateInventory}
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
          />
        )}
      </PermissionGate>
    </div>
  );
};

const ProtectedInventory = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Inventory />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedInventory;
