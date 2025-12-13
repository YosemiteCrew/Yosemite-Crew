"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import InventoryFilters from "@/app/components/Filters/InventoryFilters";
import InventoryTable from "@/app/components/DataTable/InventoryTable";
import AddInventory from "@/app/components/AddInventory";
import InventoryTurnoverTable from "@/app/components/DataTable/InventoryTurnoverTable";
import InventoryInfo from "@/app/components/InventoryInfo";
import {
  CategoryOptionsByBusiness,
  InventoryFiltersState,
  InventoryItem,
} from "./types";
import {
  buildInventoryPayload,
  defaultFilters,
  mapApiItemToInventoryItem,
  formatStatusLabel,
} from "./utils";
import {
  createInventoryItem,
  fetchInventoryItems,
  hideInventoryItem,
  updateInventoryItem,
  unhideInventoryItem,
} from "@/app/services/inventoryService";
import { BusinessType, BusinessTypes } from "@/app/types/org";
import { useOrgStore } from "@/app/stores/orgStore";
import { useLoadOrg } from "@/app/hooks/useLoadOrg";
import { useRef } from "react";

const Inventory = () => {
  useLoadOrg();

  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const orgsById = useOrgStore((s) => s.orgsById);

  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const resolvedBusinessType: BusinessType = businessType ?? "GROOMER";

  const [filters, setFilters] = useState<InventoryFiltersState>(defaultFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [addPopup, setAddPopup] = useState(false);
  const [viewInventory, setViewInventory] = useState(false);
  const [activeInventory, setActiveInventory] = useState<InventoryItem | null>(
    null
  );
  const [loadingList, setLoadingList] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoadedOrgId = useRef<string | null>(null);

  const withResolvedBusinessType = useCallback(
    (item: InventoryItem): InventoryItem => ({
      ...item,
      businessType: item.businessType ?? resolvedBusinessType,
    }),
    [resolvedBusinessType]
  );

  useEffect(() => {
    const org = primaryOrgId ? orgsById[primaryOrgId] : null;
    if (org?.type && BusinessTypes.includes(org.type as BusinessType)) {
      setBusinessType(org.type as BusinessType);
    } else if (!businessType) {
      setBusinessType("GROOMER");
    }
  }, [primaryOrgId, orgsById, businessType]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const categoryOptions = useMemo(
    () => CategoryOptionsByBusiness[resolvedBusinessType] ?? [],
    [resolvedBusinessType]
  );

  const loadInventory = useCallback(
    async (orgId?: string) => {
      const orgToUse = orgId ?? primaryOrgId;
      if (!orgToUse) {
        setInventory([]);
        setActiveInventory(null);
        return;
      }
      setLoadingList(true);
      setError(null);
      try {
        const data = await fetchInventoryItems(orgToUse);
        const mapped = data.map((entry) =>
          withResolvedBusinessType(mapApiItemToInventoryItem(entry))
        );
        setInventory(mapped);
        setActiveInventory((prev) => {
          const existing = prev ? mapped.find((i) => i.id === prev.id) : null;
          return existing ?? mapped[0] ?? null;
        });
      } catch (err) {
        setError("Unable to load inventory right now.");
      } finally {
        setLoadingList(false);
      }
    },
    [primaryOrgId, withResolvedBusinessType]
  );

  useEffect(() => {
    if (!primaryOrgId) return;
    if (lastLoadedOrgId.current === primaryOrgId) return;
    lastLoadedOrgId.current = primaryOrgId;
    void loadInventory(primaryOrgId);
  }, [primaryOrgId, loadInventory]);

  useEffect(() => {
    if (!inventory.length) {
      setActiveInventory(null);
      setViewInventory(false);
    }
  }, [inventory.length]);

  useEffect(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();
    const statusFilter = filters.status.toUpperCase();
    const nextFiltered = inventory.filter((item) => {
      const statusKey = (item.status || "").toUpperCase();
      const stockHealthKey = (item.stockHealth || "").toUpperCase();
      const categoryMatch =
        filters.category === "all" ||
        item.basicInfo.category?.toLowerCase() === filters.category.toLowerCase();
      const statusMatch =
        statusFilter === "ALL" ||
        statusKey === statusFilter ||
        (statusKey !== "HIDDEN" && statusKey !== "ACTIVE" && stockHealthKey === statusFilter);
      const searchMatch =
        !normalizedSearch ||
        item.basicInfo.name.toLowerCase().includes(normalizedSearch) ||
        item.basicInfo.description?.toLowerCase().includes(normalizedSearch);
      return categoryMatch && statusMatch && searchMatch;
    });
    setFilteredInventory(nextFiltered);
  }, [inventory, filters.category, filters.status, debouncedSearch]);

  useEffect(() => {
    if (filteredInventory.length > 0) {
      setActiveInventory(filteredInventory[0]);
    } else {
      setActiveInventory(null);
      setViewInventory(false);
    }
  }, [filteredInventory]);

  const handleCreateInventory = async (data: InventoryItem) => {
    if (!primaryOrgId) {
      throw new Error("No organisation selected.");
    }
    setSavingItem(true);
    setError(null);
    try {
      const payload = buildInventoryPayload(
        data,
        primaryOrgId,
        resolvedBusinessType
      );
      const created = await createInventoryItem(payload);
      const mapped = withResolvedBusinessType(mapApiItemToInventoryItem(created));
      setInventory((prev) => [mapped, ...prev]);
      setActiveInventory(mapped);
    } catch (err) {
      setError("Unable to save inventory item.");
      throw err;
    } finally {
      setSavingItem(false);
    }
  };

  const handleUpdateInventory = async (updatedItem: InventoryItem) => {
    if (!updatedItem.id || !primaryOrgId) return;
    setError(null);
    try {
      const payload = buildInventoryPayload(
        updatedItem,
        primaryOrgId,
        updatedItem.businessType ?? resolvedBusinessType
      );
      const res = await updateInventoryItem(updatedItem.id, payload);
      const mapped = withResolvedBusinessType(mapApiItemToInventoryItem(res));
      setInventory((prev) =>
        prev.map((item) => (item.id === mapped.id ? mapped : item))
      );
      setActiveInventory(mapped);
    } catch (err) {
      setError("Unable to update inventory item.");
      throw err;
    }
  };

  const handleHideInventory = async (itemId: string) => {
    if (!itemId) return;
    setError(null);
    try {
      const res = await hideInventoryItem(itemId);
      if (res) {
        const mapped = withResolvedBusinessType(mapApiItemToInventoryItem(res));
        const hiddenStatus = formatStatusLabel(mapped.status ?? "HIDDEN");
        const withStatus: InventoryItem = {
          ...mapped,
          stockHealth: mapped.stockHealth ?? "HIDDEN",
          status: mapped.status ?? "HIDDEN",
          basicInfo: {
            ...mapped.basicInfo,
            status: hiddenStatus,
          },
        };
        setInventory((prev) =>
          prev.map((item) => (item.id === itemId ? withStatus : item))
        );
        setActiveInventory((prev) =>
          prev && prev.id === itemId ? withStatus : prev
        );
      } else {
        await loadInventory();
      }
    } catch (err) {
      setError("Unable to hide inventory item.");
      throw err;
    }
  };

  const handleUnhideInventory = async (itemId: string) => {
    if (!itemId) return;
    setError(null);
    try {
      const res = await unhideInventoryItem(itemId);
      if (res) {
        const mapped = withResolvedBusinessType(mapApiItemToInventoryItem(res));
        setInventory((prev) =>
          prev.map((item) => (item.id === itemId ? mapped : item))
        );
        setActiveInventory((prev) =>
          prev && prev.id === itemId ? mapped : prev
        );
      } else {
        await loadInventory();
      }
    } catch (err) {
      setError("Unable to unhide inventory item.");
      throw err;
    }
  };

  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex justify-between items-center w-full">
        <div className="font-grotesk font-medium text-black-text text-[33px]">
          Inventory
        </div>
        <Primary
          href="#"
          text={savingItem ? "Saving..." : "Add"}
          onClick={() => setAddPopup(true)}
          classname="w-[140px] sm:w-40"
          isDisabled={savingItem || !primaryOrgId}
        />
      </div>

      {error && (
        <div className="text-red-500 text-sm font-satoshi font-semibold">
          {error}
        </div>
      )}

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
        <div className="font-grotesk font-medium text-black-text text-[33px]">
          Turnover
        </div>
        <InventoryTurnoverTable filteredList={[]} />
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
          onHide={handleHideInventory}
          onUnhide={handleUnhideInventory}
        />
      )}
    </div>
  );
};

const ProtectedInventory = () => {
  return (
    <ProtectedRoute>
      <Inventory />
    </ProtectedRoute>
  );
};

export default ProtectedInventory;
