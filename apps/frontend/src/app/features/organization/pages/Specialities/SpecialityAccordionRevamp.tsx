import React, { useId, useRef, useState } from 'react';
import type { ServicesTabHandle } from '@/app/features/organization/pages/Specialities/ServicesTab';
import type { PackagesTabHandle } from '@/app/features/organization/pages/Specialities/PackagesTab';
import { IoIosArrowDown, IoIosSearch } from 'react-icons/io';
import { RiEdit2Line } from 'react-icons/ri';
import { MdOutlineArchive, MdDeleteForever } from 'react-icons/md';
import { FiCheck, FiX } from 'react-icons/fi';
import TabToggle, { TabOption } from '@/app/ui/primitives/TabToggle/TabToggle';
import ServicesTab from '@/app/features/organization/pages/Specialities/ServicesTab';
import PackagesTab from '@/app/features/organization/pages/Specialities/PackagesTab';
import ArchiveTab from '@/app/features/organization/pages/Specialities/ArchiveTab';
import { SpecialityRevamp } from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { useNotify } from '@/app/hooks/useNotify';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import { getCatalogErrorMessage } from '@/app/features/organization/services/catalogErrors';

type SpecialityAccordionRevampProps = {
  speciality: SpecialityRevamp;
  defaultOpen?: boolean;
};

type ActiveTab = 'services' | 'packages' | 'archive';

const TABS: TabOption[] = [
  { key: 'services', label: 'All Services' },
  { key: 'packages', label: 'All Packages' },
  { key: 'archive', label: 'Archive', icon: <MdOutlineArchive size={14} aria-hidden="true" /> },
];

const panelId = (key: string) => `panel-${key}`;

type SearchResult = {
  id: string;
  name: string;
  kind: 'service' | 'package';
  meta: string;
};

const SpecialityAccordionRevamp = ({
  speciality,
  defaultOpen = false,
}: SpecialityAccordionRevampProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<ActiveTab>('services');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(speciality.name);
  const [nameError, setNameError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const servicesTabRef = useRef<ServicesTabHandle>(null);
  const packagesTabRef = useRef<PackagesTabHandle>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const renameSpeciality = useRevampCatalogStore((s) => s.renameSpeciality);
  const deleteSpeciality = useRevampCatalogStore((s) => s.deleteSpeciality);
  const specialities = useRevampCatalogStore((s) => s.specialities);
  const specialityLoaded = useRevampCatalogStore((s) =>
    (s.loadedSpecialityIds ?? []).includes(`${speciality.id}:active`)
  );
  const loadedServiceCount = useRevampCatalogStore(
    (s) =>
      s.services.filter((svc) => svc.specialityId === speciality.id && svc.status === 'ACTIVE')
        .length
  );
  const loadedPackageCount = useRevampCatalogStore(
    (s) =>
      s.packages.filter((pkg) => pkg.specialityId === speciality.id && pkg.status === 'ACTIVE')
        .length
  );
  // Before a speciality's catalog is lazily loaded, trust the server-provided counts from the
  // specialities list so headers are accurate without fetching every speciality up front.
  const serviceCount = specialityLoaded
    ? loadedServiceCount
    : (speciality.activeServiceCount ?? loadedServiceCount);
  const packageCount = specialityLoaded
    ? loadedPackageCount
    : (speciality.activePackageCount ?? loadedPackageCount);

  const allServices = useRevampCatalogStore(
    useShallow((s) =>
      s.services.filter((svc) => svc.specialityId === speciality.id && svc.status === 'ACTIVE')
    )
  );
  const allPackages = useRevampCatalogStore(
    useShallow((s) =>
      s.packages.filter((pkg) => pkg.specialityId === speciality.id && pkg.status === 'ACTIVE')
    )
  );

  const { notify } = useNotify();
  const totalCount = serviceCount + packageCount;

  const nameInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const searchResults: SearchResult[] = searchQuery.trim()
    ? [
        ...allServices.reduce<SearchResult[]>((results, service) => {
          const normalizedQuery = searchQuery.toLowerCase();
          if (
            service.name.toLowerCase().includes(normalizedQuery) ||
            service.code.toLowerCase().includes(normalizedQuery)
          ) {
            results.push({
              id: service.id,
              name: service.name,
              kind: 'service',
              meta: `${service.code} · ${service.type}`,
            });
          }
          return results;
        }, []),
        ...allPackages.reduce<SearchResult[]>((results, pack) => {
          const normalizedQuery = searchQuery.toLowerCase();
          if (
            pack.name.toLowerCase().includes(normalizedQuery) ||
            pack.code.toLowerCase().includes(normalizedQuery)
          ) {
            results.push({
              id: pack.id,
              name: pack.name,
              kind: 'package',
              meta: `${pack.code} · ${pack.breakdown.length} items`,
            });
          }
          return results;
        }, []),
      ]
    : [];

  const handleSearchSelect = (result: SearchResult) => {
    setSearchQuery('');
    setSearchOpen(false);
    if (!open) setOpen(true);
    setActiveTab(result.kind === 'package' ? 'packages' : 'services');
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameValue(speciality.name);
    setEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSaveName = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameError('Speciality name is required.');
      return;
    }
    const duplicate = specialities.some(
      (s) =>
        s.id !== speciality.id &&
        s.organisationId === speciality.organisationId &&
        s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setNameError('A speciality with this name already exists.');
      return;
    }
    try {
      await renameSpeciality(speciality.id, trimmed);
      notify('success', { title: 'Speciality renamed', text: `Renamed to "${trimmed}".` });
      setNameError('');
      setEditingName(false);
    } catch {
      notify('error', { title: 'Unable to rename speciality', text: 'Please try again.' });
    }
  };

  const handleCancelName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameValue(speciality.name);
    setNameError('');
    setEditingName(false);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await deleteSpeciality(speciality.id);
      notify('success', {
        title: 'Speciality deleted',
        text: `"${speciality.name}" has been removed.`,
      });
      setConfirmDelete(false);
      setEditingName(false);
    } catch (error) {
      notify('error', {
        title: 'Unable to delete speciality',
        text: getCatalogErrorMessage(
          error,
          'It may have services, packages, or historical usage. Please try again.'
        ),
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      Promise.resolve(handleSaveName(e)).catch(() => undefined);
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      setNameValue(speciality.name);
      setEditingName(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  return (
    <div className="flex flex-col w-full rounded-2xl border border-card-border">
      {/* Accordion Header — two rows on mobile, single row on sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5">
        {/* Row 1 (always): chevron + name + rename icon */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            className="flex items-center gap-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand rounded"
            onClick={() => setOpen((p) => !p)}
            aria-expanded={open}
            aria-label={`${speciality.name} speciality`}
          >
            <IoIosArrowDown
              size={20}
              aria-hidden="true"
              className={`text-black-text transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
            />
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label htmlFor={nameInputId} className="sr-only">
                  Speciality name
                </label>
                <input
                  ref={inputRef}
                  id={nameInputId}
                  type="text"
                  value={nameValue}
                  onChange={(e) => {
                    setNameValue(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  onKeyDown={handleNameKeyDown}
                  className="flex-1 min-w-0 text-heading-3 text-text-primary bg-transparent border-b-2 border-input-border-active focus-visible:outline-none px-1"
                  aria-label="Edit speciality name"
                  aria-invalid={Boolean(nameError)}
                />
                <button
                  type="button"
                  aria-label="Save name"
                  onClick={(event) => {
                    Promise.resolve(handleSaveName(event)).catch(() => undefined);
                  }}
                  className="flex items-center justify-center size-8 rounded-full bg-text-brand text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand shrink-0"
                >
                  <FiCheck size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel rename"
                  onClick={handleCancelName}
                  className="flex items-center justify-center size-8 rounded-full border border-card-border hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors shrink-0"
                >
                  <FiX size={14} color="var(--color-danger-600)" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${speciality.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmDelete(true);
                  }}
                  className="flex items-center justify-center size-8 rounded-full border border-card-border hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors shrink-0"
                >
                  <MdDeleteForever size={16} color="var(--color-danger-600)" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="text-heading-3 text-text-primary text-left truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand rounded"
                  onClick={() => setOpen((p) => !p)}
                >
                  <span className="truncate">{speciality.name}</span>{' '}
                  <span className="text-text-secondary font-normal whitespace-nowrap">
                    ({totalCount})
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${speciality.name}`}
                  onClick={handleEditClick}
                  className="flex items-center justify-center size-9 rounded-full border border-transparent hover:border-card-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors shrink-0"
                >
                  <RiEdit2Line size={18} color="var(--color-neutral-700)" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
        {editingName && nameError && (
          <p className="text-caption-1 text-text-error sm:basis-full sm:pl-12">{nameError}</p>
        )}

        {/* Row 2 on mobile / inline on sm+: primary button (left) + search (right) */}
        {!editingName && (
          <div className="flex items-center gap-2 flex-wrap w-full sm:flex-nowrap sm:w-auto min-h-12">
            {/* Primary button — leftmost, only when accordion is open and not on Archive tab */}
            {open && activeTab !== 'archive' && (
              <div className="shrink-0 w-full sm:w-auto">
                <Primary
                  href="#"
                  icon={<span>+</span>}
                  text={activeTab === 'packages' ? 'New Package' : 'New Service'}
                  onClick={(e) => {
                    e.preventDefault();
                    if (activeTab === 'packages') {
                      packagesTabRef.current?.openAdd();
                    } else {
                      servicesTabRef.current?.openAdd();
                    }
                  }}
                  className="w-full sm:w-auto"
                />
              </div>
            )}
            {/* Search bar — full width on mobile, fixed 256px + pushed right on sm+ */}
            <div ref={searchRef} className="relative w-full sm:w-64 sm:ml-auto shrink-0">
              <div className="flex items-center gap-2 border border-input-border-default rounded-2xl px-3.5 h-10.5 focus-within:border-input-border-active transition-colors bg-white w-full">
                <input
                  type="text"
                  placeholder="Search services & packages..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  onKeyDown={handleSearchKeyDown}
                  className="flex-1 min-w-0 bg-transparent font-satoshi text-[13px] font-medium text-text-primary focus-visible:outline-none placeholder:text-text-secondary"
                  aria-label={`Search within ${speciality.name}`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    className="shrink-0 focus-visible:outline-none"
                  >
                    <FiX size={12} color="var(--color-text-secondary)" />
                  </button>
                )}
                <IoIosSearch
                  size={20}
                  color="var(--color-neutral-900)"
                  aria-hidden="true"
                  className="shrink-0"
                />
              </div>

              {searchOpen && searchQuery.trim() && (
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 z-50 mt-1 w-full sm:w-96 bg-white border border-card-border rounded-2xl shadow-lg overflow-hidden">
                  {searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onMouseDown={() => handleSearchSelect(result)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-card-hover transition-colors"
                      >
                        <span className="text-body-4 text-text-primary truncate">
                          {result.name}
                        </span>
                        <span className="text-caption-1 text-text-secondary shrink-0">
                          {result.meta}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-body-4 text-text-secondary">
                      No results found.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-card-border">
          <TabToggle
            tabs={TABS}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as ActiveTab)}
            panelId={panelId}
          />

          <div className="px-5 pt-3">
            {activeTab === 'services' && (
              <div id={panelId('services')} role="tabpanel" aria-labelledby="tab-services">
                <ServicesTab
                  ref={servicesTabRef}
                  specialityId={speciality.id}
                  organisationId={speciality.organisationId}
                />
              </div>
            )}
            {activeTab === 'packages' && (
              <div id={panelId('packages')} role="tabpanel" aria-labelledby="tab-packages">
                <PackagesTab
                  ref={packagesTabRef}
                  specialityId={speciality.id}
                  organisationId={speciality.organisationId}
                />
              </div>
            )}
            {activeTab === 'archive' && (
              <div id={panelId('archive')} role="tabpanel" aria-labelledby="tab-archive">
                <ArchiveTab
                  specialityId={speciality.id}
                  organisationId={speciality.organisationId}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <CenterModal showModal setShowModal={() => setConfirmDelete(false)}>
          <ModalHeader title="Delete speciality" onClose={() => setConfirmDelete(false)} />
          <p className="text-body-4 text-text-primary">
            Are you sure you want to delete <strong>{speciality.name}</strong>? This will remove the
            speciality and is only possible if it has no services, packages, or historical usage.
            This action cannot be undone.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Secondary href="#" text="Cancel" onClick={() => setConfirmDelete(false)} />
            <Delete
              href="#"
              text={deleting ? 'Deleting...' : 'Delete'}
              onClick={() => {
                if (deleting) return;
                Promise.resolve(handleDeleteConfirm()).catch(() => undefined);
              }}
            />
          </div>
        </CenterModal>
      )}
    </div>
  );
};

export default SpecialityAccordionRevamp;
