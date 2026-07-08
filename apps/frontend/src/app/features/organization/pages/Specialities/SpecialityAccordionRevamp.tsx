import React, { useId, useRef, useState } from 'react';
import type { ServicesTabHandle } from '@/app/features/organization/pages/Specialities/ServicesTab';
import type { PackagesTabHandle } from '@/app/features/organization/pages/Specialities/PackagesTab';
import { IoIosArrowDown } from 'react-icons/io';
import TabToggle from '@/app/ui/primitives/TabToggle/TabToggle';
import ServicesTab from '@/app/features/organization/pages/Specialities/ServicesTab';
import PackagesTab from '@/app/features/organization/pages/Specialities/PackagesTab';
import ArchiveTab from '@/app/features/organization/pages/Specialities/ArchiveTab';
import { SpecialityRevamp } from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { useNotify } from '@/app/hooks/useNotify';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import { getCatalogErrorMessage } from '@/app/features/organization/services/catalogErrors';
import { TABS, panelId, type ActiveTab, type SearchResult } from './specialityAccordionHelpers';
import SpecialitySearchBar from './SpecialitySearchBar';
import SpecialityDeleteModal from './SpecialityDeleteModal';
import SpecialityNameEditor from './SpecialityNameEditor';

type SpecialityAccordionRevampProps = {
  speciality: SpecialityRevamp;
  defaultOpen?: boolean;
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
            <SpecialityNameEditor
              editingName={editingName}
              nameInputId={nameInputId}
              inputRef={inputRef}
              nameValue={nameValue}
              nameError={nameError}
              specialityName={speciality.name}
              totalCount={totalCount}
              onToggleOpen={() => setOpen((p) => !p)}
              onNameChange={(value) => {
                setNameValue(value);
                if (nameError) setNameError('');
              }}
              onNameKeyDown={handleNameKeyDown}
              onSaveName={(event) => {
                Promise.resolve(handleSaveName(event)).catch(() => undefined);
              }}
              onCancelName={handleCancelName}
              onEditClick={handleEditClick}
              onRequestDelete={(event) => {
                event.stopPropagation();
                setConfirmDelete(true);
              }}
            />
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
            <SpecialitySearchBar
              searchRef={searchRef}
              specialityName={speciality.name}
              searchQuery={searchQuery}
              searchOpen={searchOpen}
              searchResults={searchResults}
              onQueryChange={(value) => {
                setSearchQuery(value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={handleSearchKeyDown}
              onClear={() => {
                setSearchQuery('');
                setSearchOpen(false);
              }}
              onSelectResult={handleSearchSelect}
            />
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
        <SpecialityDeleteModal
          specialityName={speciality.name}
          deleting={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            Promise.resolve(handleDeleteConfirm()).catch(() => undefined);
          }}
        />
      )}
    </div>
  );
};

export default SpecialityAccordionRevamp;
