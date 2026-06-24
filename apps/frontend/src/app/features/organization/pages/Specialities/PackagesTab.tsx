import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { RiEdit2Line } from 'react-icons/ri';
import { MdOutlineArchive } from 'react-icons/md';
import { IoChevronDown } from 'react-icons/io5';
import { LuBedSingle, LuCheck } from 'react-icons/lu';
import { AiOutlineInfoCircle, AiOutlinePlus } from 'react-icons/ai';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { PackageRevamp } from '@/app/features/organization/types/revamp';
import PackageFormDraft from '@/app/features/organization/pages/Specialities/PackageFormDraft';
import PackageBreakdownTable from '@/app/features/organization/pages/Specialities/PackageBreakdownTable';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import Badge from '@/app/ui/Badge';
import { useNotify } from '@/app/hooks/useNotify';
import { computePackageTotals } from '@/app/features/organization/services/catalogCalculations';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import YosemiteLoader from '@/app/ui/overlays/Loader/YosemiteLoader';
import { getCatalogErrorMessage } from '@/app/features/organization/services/catalogErrors';

export type PackagesTabHandle = { openAdd: () => void };

type PackagesTabProps = Readonly<{
  specialityId: string;
  organisationId: string;
  ref?: Ref<PackagesTabHandle>;
}>;

type ActionMode = null | 'edit' | 'archive';

const PackageCard = ({
  pkg,
  index,
  onEdit,
  onArchive,
  onViewBreakdown,
}: {
  pkg: PackageRevamp;
  index: number;
  onEdit: () => void;
  onArchive: () => void;
  onViewBreakdown: () => void;
}) => {
  const [showBreakdown, setShowBreakdown] = useState(index === 0 && pkg.breakdown.length > 0);
  const { totalCost } = computePackageTotals(pkg);
  const orgCurrency = useCurrencyForPrimaryOrg();
  const currency = pkg.currency ?? orgCurrency;
  const handleToggleBreakdown = () => {
    const next = !showBreakdown;
    if (next && pkg.breakdown.length === 0) {
      onViewBreakdown();
    }
    setShowBreakdown(next);
  };

  return (
    <div className="flex items-start gap-3">
      <span className="text-body-4 font-semibold text-text-secondary shrink-0 w-6 text-right leading-none -mt-1.5">
        {index + 1}.
      </span>
      <SectionContainer
        title={pkg.name}
        titleColor="var(--color-neutral-900)"
        titleSlot={
          <div className="flex items-center gap-2">
            {pkg.isBookable && (
              <Badge tone="brand">
                <LuCheck size={14} aria-hidden="true" />
                Bookable
              </Badge>
            )}
            {pkg.isInpatientPreferred && (
              <Badge tone="brand">
                <LuBedSingle size={14} aria-hidden="true" />
                In-patient
              </Badge>
            )}
          </div>
        }
        className="flex-1 min-w-0"
      >
        {/* @container drives layout from available width (page vs. narrow side drawer) */}
        <div className="@container">
          {/* Action buttons on narrow containers */}
          <div className="flex @2xl:hidden items-center justify-end gap-2 mb-3">
            <CircleIconButton
              label={`${showBreakdown ? 'Hide' : 'View'} breakdown of ${pkg.name}`}
              tooltip={showBreakdown ? 'Hide breakdown' : 'View breakdown'}
              onClick={handleToggleBreakdown}
              variant="dark"
              icon={
                <IoChevronDown
                  size={20}
                  aria-hidden="true"
                  style={{
                    transform: showBreakdown ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 150ms ease',
                  }}
                />
              }
            />
            <CircleIconButton
              label={`Edit ${pkg.name}`}
              tooltip="Edit"
              onClick={onEdit}
              icon={<RiEdit2Line size={20} aria-hidden="true" />}
            />
            <CircleIconButton
              label={`Archive ${pkg.name}`}
              tooltip="Archive"
              onClick={onArchive}
              variant="danger"
              icon={<MdOutlineArchive size={20} aria-hidden="true" />}
            />
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              {/* Narrow: 2-column grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 @2xl:hidden">
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">Code</span>
                  <span className="text-body-4 text-text-primary break-all">{pkg.code}</span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Duration
                  </span>
                  <span className="text-body-4 text-text-primary">{pkg.durationText}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Description
                  </span>
                  <span className="text-body-4 text-text-primary">{pkg.description || '—'}</span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Package discount
                  </span>
                  <span className="text-body-4 text-text-primary">{pkg.additionalDiscount}%</span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Total Amount
                  </span>
                  <span className="text-body-4-emphasis text-text-primary">
                    {formatMoney(totalCost, currency)}
                  </span>
                </div>
              </div>

              {/* Wide container: single-row grid */}
              <div
                className="hidden @2xl:grid gap-x-6 gap-y-1 items-start"
                style={{ gridTemplateColumns: 'auto minmax(0,220px) auto auto auto' }}
              >
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">Code</span>
                  <span className="text-body-4 text-text-primary whitespace-nowrap">
                    {pkg.code}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Description
                  </span>
                  <span className="text-body-4 text-text-primary line-clamp-2">
                    {pkg.description || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Duration
                  </span>
                  <span className="text-body-4 text-text-primary whitespace-nowrap">
                    {pkg.durationText}
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Package discount
                  </span>
                  <span className="text-body-4 text-text-primary whitespace-nowrap">
                    {pkg.additionalDiscount}%
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Total Amount
                  </span>
                  <span className="text-body-4-emphasis text-text-primary whitespace-nowrap">
                    {formatMoney(totalCost, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons — hidden on narrow (shown above) */}
            <div className="hidden @2xl:flex items-center gap-2 shrink-0">
              <CircleIconButton
                label={`${showBreakdown ? 'Hide' : 'View'} breakdown of ${pkg.name}`}
                tooltip={showBreakdown ? 'Hide breakdown' : 'View breakdown'}
                onClick={handleToggleBreakdown}
                variant="dark"
                icon={
                  <IoChevronDown
                    size={20}
                    aria-hidden="true"
                    style={{
                      transform: showBreakdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 150ms ease',
                    }}
                  />
                }
              />
              <CircleIconButton
                label={`Edit ${pkg.name}`}
                tooltip="Edit"
                onClick={onEdit}
                icon={<RiEdit2Line size={20} aria-hidden="true" />}
              />
              <CircleIconButton
                label={`Archive ${pkg.name}`}
                tooltip="Archive"
                onClick={onArchive}
                variant="danger"
                icon={<MdOutlineArchive size={20} aria-hidden="true" />}
              />
            </div>
          </div>

          {showBreakdown && pkg.breakdown.length > 0 && (
            <SectionContainer
              title="Breakdown"
              nested
              titleColor="var(--color-neutral-900)"
              className="mt-4"
            >
              <PackageBreakdownTable
                items={pkg.breakdown}
                additionalDiscount={pkg.additionalDiscount}
                editable={false}
              />
            </SectionContainer>
          )}
        </div>
      </SectionContainer>
    </div>
  );
};

function PackagesTab({ specialityId, organisationId, ref }: PackagesTabProps) {
  const packages = useRevampCatalogStore(
    useShallow((s) =>
      s.packages.filter((pkg) => pkg.specialityId === specialityId && pkg.status === 'ACTIVE')
    )
  );
  const archivePackage = useRevampCatalogStore((s) => s.archivePackage);
  const loadSpecialityCatalog = useRevampCatalogStore((s) => s.loadSpecialityCatalog);
  const hydratePackageDetail = useRevampCatalogStore((s) => s.hydratePackageDetail);
  const { notify } = useNotify();
  const loaded = useRevampCatalogStore((s) =>
    (s.loadedSpecialityIds ?? []).includes(`${specialityId}:active`)
  );
  const loading = !loaded;

  const [draftOpen, setDraftOpen] = useState(false);
  const [draftAtTop, setDraftAtTop] = useState(false);
  const [activePackage, setActivePackage] = useState<PackageRevamp | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);

  useEffect(() => {
    Promise.resolve(loadSpecialityCatalog(organisationId, specialityId)).catch(() => undefined);
  }, [loadSpecialityCatalog, organisationId, specialityId]);

  useImperativeHandle(ref, () => ({
    openAdd: () => {
      setActivePackage(null);
      setDraftAtTop(true);
      setDraftOpen(true);
    },
  }));

  const handleEdit = (pkg: PackageRevamp) => {
    setActivePackage(pkg);
    setActionMode('edit');
    setDraftOpen(true);
    if (pkg.breakdown.length === 0) {
      Promise.resolve(hydratePackageDetail(pkg.id)).catch(() => undefined);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!activePackage) return;
    try {
      await archivePackage(activePackage.id);
      notify('success', {
        title: 'Package archived',
        text: `"${activePackage.name}" has been archived.`,
      });
      setActionMode(null);
      setActivePackage(null);
    } catch (error) {
      notify('error', {
        title: 'Unable to archive package',
        text: getCatalogErrorMessage(
          error,
          'This package could not be archived. Please try again.'
        ),
      });
    }
  };

  const handleCloseForm = () => {
    setDraftOpen(false);
    setDraftAtTop(false);
    setActivePackage(null);
    setActionMode(null);
  };

  return (
    <div className="flex flex-col gap-7 py-5">
      {draftOpen && !activePackage && draftAtTop && (
        <PackageFormDraft
          specialityId={specialityId}
          organisationId={organisationId}
          onClose={handleCloseForm}
        />
      )}

      {loading && packages.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <YosemiteLoader variant="inline" size={48} label="Loading packages" />
        </div>
      )}

      {!loading && packages.length === 0 && !draftOpen && (
        <div className="flex items-center justify-center gap-2 py-8 text-body-4 text-text-secondary">
          <AiOutlineInfoCircle size={16} aria-hidden="true" />
          You haven&apos;t added any packages yet.
        </div>
      )}

      {packages.map((pkg, i) =>
        draftOpen && activePackage?.id === pkg.id && actionMode === 'edit' ? (
          <PackageFormDraft
            key={pkg.id}
            specialityId={specialityId}
            organisationId={organisationId}
            editPackage={pkg}
            onClose={handleCloseForm}
          />
        ) : (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            index={i}
            onEdit={() => handleEdit(pkg)}
            onArchive={() => {
              setActivePackage(pkg);
              setActionMode('archive');
            }}
            onViewBreakdown={() => {
              Promise.resolve(hydratePackageDetail(pkg.id)).catch(() => undefined);
            }}
          />
        )
      )}

      {draftOpen && !activePackage && !draftAtTop && (
        <PackageFormDraft
          specialityId={specialityId}
          organisationId={organisationId}
          onClose={handleCloseForm}
        />
      )}

      {!draftOpen && (
        <button
          type="button"
          onClick={() => {
            setActivePackage(null);
            setDraftAtTop(false);
            setDraftOpen(true);
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-input-border-active text-body-4 text-text-brand hover:bg-blue-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          <AiOutlinePlus size={16} aria-hidden="true" />
          Click to add package
        </button>
      )}

      {actionMode === 'archive' && activePackage && (
        <CenterModal
          showModal
          setShowModal={() => {
            setActionMode(null);
            setActivePackage(null);
          }}
        >
          <ModalHeader
            title="Archive package"
            onClose={() => {
              setActionMode(null);
              setActivePackage(null);
            }}
          />
          <p className="text-body-4 text-text-primary">
            Are you sure you want to archive <strong>{activePackage.name}</strong>? It will be
            hidden from active lists and the package builder, and you can restore it later from the
            Archive tab.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Secondary
              href="#"
              text="Cancel"
              onClick={() => {
                setActionMode(null);
                setActivePackage(null);
              }}
            />
            <Delete
              href="#"
              text="Archive"
              onClick={() => {
                Promise.resolve(handleArchiveConfirm()).catch(() => undefined);
              }}
            />
          </div>
        </CenterModal>
      )}
    </div>
  );
}

export default PackagesTab;
