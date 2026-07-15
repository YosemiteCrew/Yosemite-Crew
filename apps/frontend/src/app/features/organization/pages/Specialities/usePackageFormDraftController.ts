import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { PackageBreakdownItem, PackageRevamp } from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { useNotify } from '@/app/hooks/useNotify';
import { computePackageTotals } from '@/app/features/organization/services/catalogCalculations';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { catalogApi } from '@/app/features/organization/services/catalogApiService';
import { getCatalogErrorMessage } from '@/app/features/organization/services/catalogErrors';
import {
  countBookableBreakdownItems,
  hasBookableBreakdownItem,
  hasInpatientBreakdownItem,
} from '@/app/features/organization/services/catalogBookable';
import { CatalogEntry, FormErrors, mapItemsToCatalog } from './packageFormDraftHelpers';

type UsePackageFormDraftControllerParams = {
  specialityId: string;
  organisationId: string;
  editPackage?: PackageRevamp;
  onClose: () => void;
};

export const usePackageFormDraftController = ({
  specialityId,
  organisationId,
  editPackage,
  onClose,
}: UsePackageFormDraftControllerParams) => {
  const isEditing = Boolean(editPackage);
  const addPackage = useRevampCatalogStore((s) => s.addPackage);
  const updatePackage = useRevampCatalogStore((s) => s.updatePackage);
  const deletePackage = useRevampCatalogStore((s) => s.deletePackage);
  const orgCurrency = useCurrencyForPrimaryOrg();
  const allActivePackages = useRevampCatalogStore(
    useShallow((s) => s.packages.filter((p) => p.status === 'ACTIVE' && p.id !== editPackage?.id))
  );
  const activeServices = useRevampCatalogStore(
    useShallow((s) => s.services.filter((svc) => svc.status === 'ACTIVE'))
  );
  const { notify } = useNotify();

  const [name, setName] = useState(editPackage?.name ?? '');
  const [description, setDescription] = useState(editPackage?.description ?? '');
  const [durationText, setDurationText] = useState(editPackage?.durationText ?? 'Approx. 30 mins');
  const [leadCount, setLeadCount] = useState((editPackage?.leadCount ?? 1) >= 1 ? '1' : '0');
  const [supportCount, setSupportCount] = useState(String(editPackage?.supportCount ?? 0));
  const [isBookable, setIsBookable] = useState(editPackage?.isBookable ?? false);
  const [isInpatientPreferred, setIsInpatientPreferred] = useState(
    editPackage?.isInpatientPreferred ?? false
  );
  const [additionalDiscount, setAdditionalDiscount] = useState(
    String(editPackage?.additionalDiscount ?? 0)
  );
  const [breakdown, setBreakdown] = useState<PackageBreakdownItem[]>(editPackage?.breakdown ?? []);
  const [syncedBreakdownRef, setSyncedBreakdownRef] = useState(editPackage?.breakdown);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<CatalogEntry[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const descId = useId();

  if (editPackage && editPackage.breakdown !== syncedBreakdownRef) {
    setSyncedBreakdownRef(editPackage.breakdown);
    if (editPackage.breakdown.length > 0 && breakdown.length === 0) {
      setBreakdown(editPackage.breakdown);
    }
  }

  const localCatalog = useMemo<CatalogEntry[]>(() => {
    const serviceCatalog = activeServices.map(
      (service): CatalogEntry => ({
        id: service.id,
        code: service.code,
        name: service.name,
        type: service.type,
        unitPrice: service.grossAmount,
        currency: service.currency ?? orgCurrency,
        defaultDiscount: service.defaultDiscount,
        maxDiscount: service.maxDiscount,
        isBookable: service.isBookable,
        isInpatientPreferred: service.isInpatientPreferred,
      })
    );

    const packageCatalog = allActivePackages.map((pkg): CatalogEntry => {
      const { totalCost } = computePackageTotals(pkg);
      return {
        id: pkg.id,
        code: pkg.code,
        name: pkg.name,
        type: 'PACKAGE',
        unitPrice: totalCost,
        currency: pkg.currency ?? orgCurrency,
        defaultDiscount: 0,
        maxDiscount: 100,
        isBookable: pkg.isBookable || hasBookableBreakdownItem(pkg.breakdown),
        isInpatientPreferred: pkg.isInpatientPreferred || hasInpatientBreakdownItem(pkg.breakdown),
        nestedBreakdown: pkg.breakdown,
      };
    });

    return [...serviceCatalog, ...packageCatalog];
  }, [activeServices, allActivePackages, orgCurrency]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    let cancelled = false;
    const timeout = globalThis.window.setTimeout(() => {
      setSearchLoading(true);
      catalogApi
        .searchItems({
          organisationId,
          specialityId,
          q,
          kinds: ['CONSULTATION', 'PROCEDURE', 'LAB', 'MEDICATION', 'INVENTORY', 'PACKAGE'],
          excludePackageId: editPackage?.id,
        })
        .then((items) => {
          if (!cancelled) setCatalogResults(mapItemsToCatalog(items));
        })
        .catch(() => {
          if (!cancelled) setCatalogResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      globalThis.window.clearTimeout(timeout);
    };
  }, [editPackage?.id, organisationId, searchQuery, specialityId]);

  const capabilityById = useMemo(() => {
    const map = new Map<string, { isBookable: boolean; isInpatientPreferred: boolean }>();
    for (const service of activeServices) {
      map.set(service.id, {
        isBookable: service.isBookable,
        isInpatientPreferred: service.isInpatientPreferred,
      });
    }
    for (const pkg of allActivePackages) {
      map.set(pkg.id, {
        isBookable: pkg.isBookable || hasBookableBreakdownItem(pkg.breakdown),
        isInpatientPreferred: pkg.isInpatientPreferred || hasInpatientBreakdownItem(pkg.breakdown),
      });
    }
    return map;
  }, [activeServices, allActivePackages]);

  const itemIsBookable = useCallback(
    (item: PackageBreakdownItem): boolean => {
      if (item.isBookable) return true;
      const resolved = item.childItemId ? capabilityById.get(item.childItemId) : undefined;
      if (resolved?.isBookable) return true;
      return hasBookableBreakdownItem(item.nestedBreakdown ?? []);
    },
    [capabilityById]
  );

  const itemIsInpatient = useCallback(
    (item: PackageBreakdownItem): boolean => {
      if (item.isInpatientPreferred) return true;
      const resolved = item.childItemId ? capabilityById.get(item.childItemId) : undefined;
      if (resolved?.isInpatientPreferred) return true;
      return hasInpatientBreakdownItem(item.nestedBreakdown ?? []);
    },
    [capabilityById]
  );

  const requiredBookable = useMemo(
    () => breakdown.some(itemIsBookable),
    [breakdown, itemIsBookable]
  );
  const requiredInpatient = useMemo(
    () => breakdown.some(itemIsInpatient),
    [breakdown, itemIsInpatient]
  );
  const effectiveBookable = isBookable || requiredBookable;
  const effectiveInpatientPreferred = isInpatientPreferred || requiredInpatient;

  const filteredSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const uniqueItems = new Map<string, CatalogEntry>();
    for (const item of [...catalogResults, ...localCatalog]) {
      const matches = item.name.toLowerCase().includes(q) || item.code?.toLowerCase().includes(q);
      if (matches && !uniqueItems.has(item.id)) uniqueItems.set(item.id, item);
    }
    return Array.from(uniqueItems.values());
  }, [catalogResults, localCatalog, searchQuery]);

  const addBreakdownItem = useCallback(
    (catalog: CatalogEntry) => {
      const existing = breakdown.find(
        (b) => b.childItemId === catalog.id || b.name.toLowerCase() === catalog.name.toLowerCase()
      );
      if (existing) {
        setBreakdown((prev) =>
          prev.map((b) => (b.id === existing.id ? { ...b, quantity: b.quantity + 1 } : b))
        );
      } else {
        const catalogIsBookable =
          catalog.isBookable || hasBookableBreakdownItem(catalog.nestedBreakdown ?? []);
        if (catalogIsBookable && breakdown.some(itemIsBookable)) {
          notify('warning', {
            title: 'Only one bookable service allowed',
            text: 'A package can include just one bookable service. Remove the current bookable item before adding another.',
          });
          setSearchQuery('');
          return;
        }
        setBreakdown((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            childItemId: catalog.id,
            code: catalog.code,
            type: catalog.type,
            name: catalog.name,
            unitPrice: catalog.unitPrice,
            currency: catalog.currency ?? orgCurrency,
            quantity: 1,
            discount: catalog.defaultDiscount,
            maxDiscount: catalog.maxDiscount,
            isBookable: catalog.isBookable,
            isInpatientPreferred: catalog.isInpatientPreferred,
            nestedBreakdown: catalog.nestedBreakdown,
          },
        ]);
      }
      setSearchQuery('');
    },
    [breakdown, itemIsBookable, notify, orgCurrency]
  );

  const removeBreakdownItem = useCallback((id: string) => {
    setBreakdown((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const handleChangeQty = useCallback((id: string, qty: number) => {
    setBreakdown((prev) => prev.map((b) => (b.id === id ? { ...b, quantity: qty } : b)));
  }, []);

  const handleChangeDiscount = useCallback((id: string, discount: number) => {
    setBreakdown((prev) => prev.map((b) => (b.id === id ? { ...b, discount } : b)));
  }, []);

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    const additionalDiscountValue = Number(additionalDiscount);
    if (!name.trim()) errs.name = 'Package name is required.';
    if (!durationText.trim()) errs.durationText = 'Approx. duration is required.';
    if (breakdown.length === 0) errs.breakdown = 'Add at least one item to this package.';
    else if (countBookableBreakdownItems(breakdown) > 1)
      errs.breakdown = 'A package can include only one bookable service. Remove the extra one.';
    if (
      additionalDiscount &&
      (Number.isNaN(additionalDiscountValue) ||
        additionalDiscountValue < 0 ||
        additionalDiscountValue > 100)
    )
      errs.additionalDiscount = 'Additional discount must be 0–100.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [additionalDiscount, breakdown, durationText, name]);

  const handleSave = async () => {
    if (!validate()) return;
    const payload = {
      name: name.trim(),
      description: description.trim(),
      specialityId,
      organisationId,
      durationText: durationText.trim(),
      currency: editPackage?.currency ?? orgCurrency,
      leadCount: Number.parseInt(leadCount, 10),
      supportCount: Number.parseInt(supportCount, 10),
      isBookable: effectiveBookable,
      isInpatientPreferred: effectiveInpatientPreferred,
      additionalDiscount: Number.parseFloat(additionalDiscount) || 0,
      breakdown,
      status: 'ACTIVE' as const,
    };
    try {
      if (isEditing && editPackage) {
        await updatePackage(editPackage.id, payload);
        notify('success', { title: 'Package updated', text: `"${name}" has been saved.` });
      } else {
        await addPackage(payload);
        notify('success', { title: 'Package added', text: `"${name}" has been created.` });
      }
      onClose();
    } catch (error) {
      notify('error', {
        title: 'Unable to save package',
        text: getCatalogErrorMessage(error, 'Please check the details and try again.'),
      });
    }
  };

  const handleDelete = async () => {
    if (!editPackage) return;
    try {
      await deletePackage(editPackage.id);
      notify('success', {
        title: 'Package deleted',
        text: `"${editPackage.name}" has been removed.`,
      });
      onClose();
    } catch (error) {
      notify('error', {
        title: 'Unable to delete package',
        text: getCatalogErrorMessage(error, 'This package could not be deleted. Please try again.'),
      });
    }
  };

  return {
    additionalDiscount,
    breakdown,
    confirmDelete,
    descId,
    description,
    draftTitle: `${isEditing ? name || 'Package' : 'New Package'} (draft)`,
    effectiveBookable,
    effectiveInpatientPreferred,
    errors,
    filteredSearch,
    handleChangeDiscount,
    handleChangeQty,
    handleDelete,
    handleSave,
    isEditing,
    leadCount,
    name,
    orgCurrency,
    requiredBookable,
    requiredInpatient,
    searchLoading,
    searchQuery,
    supportCount,
    durationText,
    addBreakdownItem,
    removeBreakdownItem,
    setAdditionalDiscount,
    setConfirmDelete,
    setDescription,
    setDurationText,
    setErrors,
    setIsBookable,
    setIsInpatientPreferred,
    setLeadCount,
    setName,
    setSearchQuery,
    setSupportCount,
  };
};
