import { create } from 'zustand';
import {
  CatalogItemType,
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
  SpecialityRevamp,
} from '@/app/features/organization/types/revamp';
import { catalogApi } from '@/app/features/organization/services/catalogApiService';

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

type RevampCatalogState = {
  specialities: SpecialityRevamp[];
  services: ServiceRevamp[];
  packages: PackageRevamp[];
  status: CatalogStatus;
  error?: string;
  loadedSpecialityIds: string[];

  loadOrganisationCatalog: (organisationId: string, opts?: { force?: boolean }) => Promise<void>;
  loadSpecialityCatalog: (
    organisationId: string,
    specialityId: string,
    opts?: { force?: boolean; includeArchive?: boolean }
  ) => Promise<void>;

  addSpeciality: (name: string, organisationId: string) => Promise<SpecialityRevamp>;
  renameSpeciality: (id: string, name: string) => Promise<void>;
  deleteSpeciality: (id: string) => Promise<void>;

  addService: (draft: Omit<ServiceRevamp, 'id' | 'code' | 'createdAt'>) => Promise<ServiceRevamp>;
  updateService: (id: string, patch: Partial<ServiceRevamp>) => Promise<void>;
  archiveService: (id: string) => Promise<void>;
  restoreService: (id: string) => Promise<void>;
  deleteService: (id: string) => Promise<void>;

  addPackage: (draft: Omit<PackageRevamp, 'id' | 'code' | 'createdAt'>) => Promise<PackageRevamp>;
  updatePackage: (id: string, patch: Partial<PackageRevamp>) => Promise<void>;
  archivePackage: (id: string) => Promise<void>;
  restorePackage: (id: string) => Promise<void>;
  deletePackage: (id: string) => Promise<void>;
  hydratePackageDetail: (id: string) => Promise<void>;

  addBreakdownItem: (packageId: string, item: Omit<PackageBreakdownItem, 'id'>) => void;
  updateBreakdownItem: (
    packageId: string,
    itemId: string,
    patch: Partial<PackageBreakdownItem>
  ) => void;
  removeBreakdownItem: (packageId: string, itemId: string) => void;

  generateItemCode: (type: CatalogItemType) => string;
};

const replaceById = <T extends { id: string }>(items: T[], item: T): T[] => {
  const exists = items.some((existing) => existing.id === item.id);
  return exists
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item];
};

const removeById = <T extends { id: string }>(items: T[], id: string): T[] =>
  items.filter((item) => item.id !== id);

const upsertMany = <T extends { id: string }>(current: T[], next: T[]): T[] =>
  next.reduce((items, item) => replaceById(items, item), current);

const applyBreakdownUpdate = (
  packages: PackageRevamp[],
  packageId: string,
  updateFn: (breakdown: PackageBreakdownItem[]) => PackageBreakdownItem[]
): PackageRevamp[] =>
  packages.map((p) => {
    if (p.id !== packageId) return p;
    return { ...p, breakdown: updateFn(p.breakdown) };
  });

const addPackageBreakdownItem = (
  packages: PackageRevamp[],
  packageId: string,
  item: PackageBreakdownItem
): PackageRevamp[] =>
  applyBreakdownUpdate(packages, packageId, (breakdown) => [...breakdown, item]);

const updatePackageBreakdownItem = (
  packages: PackageRevamp[],
  packageId: string,
  itemId: string,
  patch: Partial<PackageBreakdownItem>
): PackageRevamp[] =>
  applyBreakdownUpdate(packages, packageId, (breakdown) =>
    breakdown.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
  );

const removePackageBreakdownItem = (
  packages: PackageRevamp[],
  packageId: string,
  itemId: string
): PackageRevamp[] =>
  applyBreakdownUpdate(packages, packageId, (breakdown) =>
    breakdown.filter((item) => item.id !== itemId)
  );

const findService = (services: ServiceRevamp[], id: string): ServiceRevamp => {
  const service = services.find((item) => item.id === id);
  if (!service) throw new Error('Service not found.');
  return service;
};

const findPackage = (packages: PackageRevamp[], id: string): PackageRevamp => {
  const pkg = packages.find((item) => item.id === id);
  if (!pkg) throw new Error('Package not found.');
  return pkg;
};

const codeCounters: Record<CatalogItemType, number> = {
  CONSULTATION: 0,
  PROCEDURE: 0,
  INVENTORY: 0,
  LAB: 0,
  MEDICATION: 0,
  PACKAGE: 0,
};

const codePrefixes: Record<CatalogItemType, string> = {
  CONSULTATION: 'CS',
  PROCEDURE: 'PR',
  INVENTORY: 'IN',
  LAB: 'LB',
  MEDICATION: 'ME',
  PACKAGE: 'PK',
};

const organisationLoadPromises = new Map<string, Promise<void>>();
const specialityLoadPromises = new Map<string, Promise<void>>();
const packageDetailPromises = new Map<string, Promise<void>>();

const specialityLoadKey = (specialityId: string, includeArchive: boolean) =>
  `${specialityId}:${includeArchive ? 'all' : 'active'}`;

export const useRevampCatalogStore = create<RevampCatalogState>()((set, get) => ({
  specialities: [],
  services: [],
  packages: [],
  status: 'idle',
  loadedSpecialityIds: [],

  loadOrganisationCatalog: async (organisationId, opts) => {
    const state = get();
    const inFlight = organisationLoadPromises.get(organisationId);
    if (inFlight && !opts?.force) return inFlight;
    if (
      !opts?.force &&
      state.specialities.some((speciality) => speciality.organisationId === organisationId)
    ) {
      return;
    }
    set({ status: 'loading', error: undefined });
    const promise = (async () => {
      try {
        const specialities = await catalogApi.listSpecialities(organisationId, 'ACTIVE');
        set((current) => ({
          status: 'ready',
          specialities: upsertMany(current.specialities, specialities),
        }));
      } catch (error) {
        set({ status: 'error', error: 'Failed to load catalog.' });
        throw error;
      } finally {
        organisationLoadPromises.delete(organisationId);
      }
    })();
    organisationLoadPromises.set(organisationId, promise);
    return promise;
  },

  loadSpecialityCatalog: async (organisationId, specialityId, opts) => {
    const includeArchive = Boolean(opts?.includeArchive);
    const key = specialityLoadKey(specialityId, includeArchive);
    const inFlight = specialityLoadPromises.get(key);
    if (inFlight && !opts?.force) return inFlight;
    if (!opts?.force && get().loadedSpecialityIds.includes(key)) {
      return;
    }
    const serviceStatuses = includeArchive ? ['ACTIVE', 'ARCHIVED'] : ['ACTIVE'];
    const packageStatuses = includeArchive ? ['ACTIVE', 'ARCHIVED'] : ['ACTIVE'];
    const promise = (async () => {
      try {
        const [serviceGroups, packageGroups] = await Promise.all([
          Promise.all(
            serviceStatuses.map((status) =>
              catalogApi.listServices(organisationId, specialityId, status)
            )
          ),
          Promise.all(
            packageStatuses.map((status) =>
              catalogApi.listPackages(organisationId, specialityId, status)
            )
          ),
        ]);
        set((current) => ({
          services: upsertMany(current.services, serviceGroups.flat()),
          packages: upsertMany(current.packages, packageGroups.flat()),
          loadedSpecialityIds: current.loadedSpecialityIds.includes(key)
            ? current.loadedSpecialityIds
            : [...current.loadedSpecialityIds, key],
        }));
      } finally {
        specialityLoadPromises.delete(key);
      }
    })();
    specialityLoadPromises.set(key, promise);
    return promise;
  },

  addSpeciality: async (name, organisationId) => {
    const speciality = await catalogApi.createSpeciality(name, organisationId);
    set((state) => ({ specialities: replaceById(state.specialities, speciality) }));
    return speciality;
  },

  renameSpeciality: async (id, name) => {
    const current = get().specialities.find((speciality) => speciality.id === id);
    if (!current) throw new Error('Speciality not found.');
    const updated = await catalogApi.updateSpeciality({ ...current, name });
    set((state) => ({ specialities: replaceById(state.specialities, updated) }));
  },

  deleteSpeciality: async (id) => {
    const current = get().specialities.find((speciality) => speciality.id === id);
    if (!current) throw new Error('Speciality not found.');
    await catalogApi.deleteSpeciality(current.organisationId, current.id);
    set((state) => ({
      specialities: removeById(state.specialities, id),
      services: state.services.filter((service) => service.specialityId !== id),
      packages: state.packages.filter((pkg) => pkg.specialityId !== id),
    }));
  },

  addService: async (draft) => {
    const service = await catalogApi.createService(draft);
    set((state) => ({ services: replaceById(state.services, service) }));
    return service;
  },

  updateService: async (id, patch) => {
    const service = findService(get().services, id);
    const updated = await catalogApi.updateService(id, patch, service);
    set((state) => ({ services: replaceById(state.services, updated) }));
  },

  archiveService: async (id) => {
    const service = findService(get().services, id);
    await catalogApi.archiveService(service);
    set((state) => ({
      services: state.services.map((item) =>
        item.id === id ? { ...item, status: 'ARCHIVED' } : item
      ),
    }));
  },

  restoreService: async (id) => {
    const service = findService(get().services, id);
    await catalogApi.restoreService(service);
    set((state) => ({
      services: state.services.map((item) =>
        item.id === id ? { ...item, status: 'ACTIVE' } : item
      ),
    }));
  },

  deleteService: async (id) => {
    const service = findService(get().services, id);
    await catalogApi.deleteService(service);
    set((state) => ({ services: removeById(state.services, id) }));
  },

  addPackage: async (draft) => {
    const pkg = await catalogApi.createPackage(draft);
    const packageWithBreakdown = { ...pkg, breakdown: draft.breakdown };
    set((state) => ({ packages: replaceById(state.packages, packageWithBreakdown) }));
    return packageWithBreakdown;
  },

  updatePackage: async (id, patch) => {
    const pkg = findPackage(get().packages, id);
    const updated = await catalogApi.updatePackage(id, patch, pkg);
    set((state) => ({
      packages: replaceById(state.packages, {
        ...pkg,
        ...updated,
        breakdown: patch.breakdown ?? updated.breakdown ?? pkg.breakdown,
      }),
    }));
  },

  archivePackage: async (id) => {
    const pkg = findPackage(get().packages, id);
    await catalogApi.archivePackage(pkg);
    set((state) => ({
      packages: state.packages.map((item) =>
        item.id === id ? { ...item, status: 'ARCHIVED' } : item
      ),
    }));
  },

  restorePackage: async (id) => {
    const pkg = findPackage(get().packages, id);
    await catalogApi.restorePackage(pkg);
    set((state) => ({
      packages: state.packages.map((item) =>
        item.id === id ? { ...item, status: 'ACTIVE' } : item
      ),
    }));
  },

  deletePackage: async (id) => {
    const pkg = findPackage(get().packages, id);
    await catalogApi.deletePackage(pkg);
    set((state) => ({ packages: removeById(state.packages, id) }));
  },

  hydratePackageDetail: async (id) => {
    const inFlight = packageDetailPromises.get(id);
    if (inFlight) return inFlight;
    const pkg = findPackage(get().packages, id);
    const promise = (async () => {
      try {
        const hydrated = await catalogApi.getPackageDetail(pkg);
        set((state) => ({ packages: replaceById(state.packages, hydrated) }));
      } finally {
        packageDetailPromises.delete(id);
      }
    })();
    packageDetailPromises.set(id, promise);
    return promise;
  },

  addBreakdownItem: (packageId, item) => {
    const newItem: PackageBreakdownItem = { ...item, id: crypto.randomUUID() };
    set((state) => ({ packages: addPackageBreakdownItem(state.packages, packageId, newItem) }));
  },

  updateBreakdownItem: (packageId, itemId, patch) =>
    set((state) => ({
      packages: updatePackageBreakdownItem(state.packages, packageId, itemId, patch),
    })),

  removeBreakdownItem: (packageId, itemId) =>
    set((state) => ({
      packages: removePackageBreakdownItem(state.packages, packageId, itemId),
    })),

  generateItemCode: (type) => {
    codeCounters[type] += 1;
    return `${codePrefixes[type]}-${String(codeCounters[type]).padStart(4, '0')}`;
  },
}));
