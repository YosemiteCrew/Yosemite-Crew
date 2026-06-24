import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { RiEdit2Line } from 'react-icons/ri';
import { MdOutlineArchive } from 'react-icons/md';
import { LuBedSingle, LuCheck } from 'react-icons/lu';
import { AiOutlineInfoCircle, AiOutlinePlus } from 'react-icons/ai';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { ServiceRevamp } from '@/app/features/organization/types/revamp';
import ServiceFormDraft from '@/app/features/organization/pages/Specialities/ServiceFormDraft';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import { useNotify } from '@/app/hooks/useNotify';
import { computeServiceTotal } from '@/app/features/organization/services/catalogCalculations';
import Badge from '@/app/ui/Badge';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import YosemiteLoader from '@/app/ui/overlays/Loader/YosemiteLoader';
import { getCatalogErrorMessage } from '@/app/features/organization/services/catalogErrors';

export type ServicesTabHandle = { openAdd: () => void };

type ServicesTabProps = Readonly<{
  specialityId: string;
  organisationId: string;
  ref?: Ref<ServicesTabHandle>;
}>;

type ActionMode = null | 'edit' | 'archive' | 'view';

const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: 'Consultation',
  PROCEDURE: 'Procedure',
  LAB: 'Lab / Diagnostics',
  INVENTORY: 'Inventory',
  MEDICATION: 'Medication',
};

const ServiceRow = ({
  service,
  index,
  onEdit,
  onArchive,
}: {
  service: ServiceRevamp;
  index: number;
  onEdit: () => void;
  onArchive: () => void;
}) => {
  const { total } = computeServiceTotal(service);
  const orgCurrency = useCurrencyForPrimaryOrg();
  const currency = service.currency ?? orgCurrency;
  return (
    <div className="flex items-start gap-3">
      <span className="text-body-4 font-semibold text-text-secondary shrink-0 w-6 text-right leading-none -mt-1.5">
        {index + 1}.
      </span>
      <SectionContainer
        title={service.name}
        titleColor="var(--color-neutral-900)"
        titleSlot={
          service.isBookable || service.isInpatientPreferred ? (
            <div className="flex items-center gap-2">
              {service.isBookable && (
                <Badge tone="brand">
                  <LuCheck size={14} aria-hidden="true" />
                  Bookable
                </Badge>
              )}
              {service.isInpatientPreferred && (
                <Badge tone="brand">
                  <LuBedSingle size={14} aria-hidden="true" />
                  In-patient
                </Badge>
              )}
            </div>
          ) : undefined
        }
        className="flex-1 min-w-0"
      >
        {/* @container drives layout from available width (page vs. narrow side drawer) */}
        <div className="@container">
          {/* Action buttons row on narrow containers, inline on wide */}
          <div className="flex @2xl:hidden items-center justify-end gap-2 mb-3">
            <CircleIconButton
              label={`Edit ${service.name}`}
              tooltip="Edit"
              onClick={onEdit}
              icon={<RiEdit2Line size={20} aria-hidden="true" />}
            />
            <CircleIconButton
              label={`Archive ${service.name}`}
              tooltip="Archive"
              onClick={onArchive}
              variant="danger"
              icon={<MdOutlineArchive size={20} aria-hidden="true" />}
            />
          </div>

          <div className="flex items-start gap-4">
            {/* Data grid: 2-col on narrow, full 8-col on wide */}
            <div className="flex-1 min-w-0">
              {/* Narrow: 2-column grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 @2xl:hidden">
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">Code</span>
                  <span className="text-body-4 text-text-primary break-all">{service.code}</span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">Type</span>
                  <span className="text-body-4 text-text-primary">
                    {TYPE_LABELS[service.type] ?? service.type}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Description
                  </span>
                  <span className="text-body-4 text-text-primary">
                    {service.description || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Duration
                  </span>
                  <span className="text-body-4 text-text-primary">
                    {service.durationMinutes} mins
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Gross amt.
                  </span>
                  <span className="text-body-4 text-text-primary">
                    {formatMoney(service.grossAmount, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Disc. (default)
                  </span>
                  <span className="text-body-4 text-text-primary">-{service.defaultDiscount}%</span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Max disc.
                  </span>
                  <span className="text-body-4 text-text-primary">-{service.maxDiscount}%</span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">Total</span>
                  <span className="text-body-4-emphasis text-text-primary">
                    {formatMoney(total, currency)}
                  </span>
                </div>
              </div>

              {/* Wide container: single-row grid */}
              <div
                className="hidden @2xl:grid gap-x-6 gap-y-1 items-start"
                style={{
                  gridTemplateColumns: 'auto auto minmax(0,220px) auto auto auto auto auto',
                }}
              >
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">Code</span>
                  <span className="text-body-4 text-text-primary whitespace-nowrap">
                    {service.code}
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">Type</span>
                  <span className="text-body-4 text-text-primary whitespace-nowrap">
                    {TYPE_LABELS[service.type] ?? service.type}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Description
                  </span>
                  <span className="text-body-4 text-text-primary line-clamp-2">
                    {service.description || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Duration
                  </span>
                  <span className="text-body-4 text-text-primary whitespace-nowrap">
                    {service.durationMinutes} mins
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Gross amt.
                  </span>
                  <span className="text-body-4 text-text-primary whitespace-nowrap">
                    {formatMoney(service.grossAmount, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Disc. (default)
                  </span>
                  <span className="text-body-4 text-text-primary whitespace-nowrap">
                    -{service.defaultDiscount}%
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">
                    Max disc.
                  </span>
                  <span className="text-body-4 text-text-primary whitespace-nowrap">
                    -{service.maxDiscount}%
                  </span>
                </div>
                <div>
                  <span className="text-caption-2 font-bold text-text-tertiary block">Total</span>
                  <span className="text-body-4-emphasis text-text-primary whitespace-nowrap">
                    {formatMoney(total, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons — hidden on narrow (shown above), visible on wide container */}
            <div className="hidden @2xl:flex items-center gap-2 shrink-0">
              <CircleIconButton
                label={`Edit ${service.name}`}
                onClick={onEdit}
                icon={<RiEdit2Line size={20} aria-hidden="true" />}
              />
              <CircleIconButton
                label={`Archive ${service.name}`}
                onClick={onArchive}
                variant="danger"
                icon={<MdOutlineArchive size={20} aria-hidden="true" />}
              />
            </div>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
};

function ServicesTab({ specialityId, organisationId, ref }: ServicesTabProps) {
  const services = useRevampCatalogStore(
    useShallow((s) =>
      s.services.filter((svc) => svc.specialityId === specialityId && svc.status === 'ACTIVE')
    )
  );
  const archiveService = useRevampCatalogStore((s) => s.archiveService);
  const loadSpecialityCatalog = useRevampCatalogStore((s) => s.loadSpecialityCatalog);
  const { notify } = useNotify();

  const [draftOpen, setDraftOpen] = useState(false);
  const [draftAtTop, setDraftAtTop] = useState(false);
  const [activeService, setActiveService] = useState<ServiceRevamp | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const loaded = useRevampCatalogStore((s) =>
    (s.loadedSpecialityIds ?? []).includes(`${specialityId}:active`)
  );
  const loading = !loaded;

  useEffect(() => {
    Promise.resolve(loadSpecialityCatalog(organisationId, specialityId)).catch(() => undefined);
  }, [loadSpecialityCatalog, organisationId, specialityId]);

  useImperativeHandle(ref, () => ({
    openAdd: () => {
      setActiveService(null);
      setDraftAtTop(true);
      setDraftOpen(true);
    },
  }));

  const handleAddClick = () => {
    setActiveService(null);
    setDraftAtTop(false);
    setDraftOpen(true);
  };

  const handleEdit = (svc: ServiceRevamp) => {
    setActiveService(svc);
    setActionMode('edit');
    setDraftOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!activeService) return;
    try {
      await archiveService(activeService.id);
      notify('success', {
        title: 'Service archived',
        text: `"${activeService.name}" has been archived.`,
      });
      setActionMode(null);
      setActiveService(null);
    } catch (error) {
      notify('error', {
        title: 'Unable to archive service',
        text: getCatalogErrorMessage(
          error,
          'This service could not be archived. Please try again.'
        ),
      });
    }
  };

  const handleCloseForm = () => {
    setDraftOpen(false);
    setDraftAtTop(false);
    setActiveService(null);
    setActionMode(null);
  };

  return (
    <div className="flex flex-col gap-7 py-5">
      {draftOpen && !activeService && draftAtTop && (
        <ServiceFormDraft
          specialityId={specialityId}
          organisationId={organisationId}
          onClose={handleCloseForm}
        />
      )}

      {loading && services.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <YosemiteLoader variant="inline" size={48} label="Loading services" />
        </div>
      )}

      {!loading && services.length === 0 && !draftOpen && (
        <div className="flex items-center justify-center gap-2 py-8 text-body-4 text-text-secondary">
          <AiOutlineInfoCircle size={16} aria-hidden="true" />
          You haven&apos;t added any services yet.
        </div>
      )}

      {services.map((svc, i) =>
        draftOpen && activeService?.id === svc.id && actionMode === 'edit' ? (
          <ServiceFormDraft
            key={svc.id}
            specialityId={specialityId}
            organisationId={organisationId}
            editService={svc}
            onClose={handleCloseForm}
          />
        ) : (
          <ServiceRow
            key={svc.id}
            service={svc}
            index={i}
            onEdit={() => handleEdit(svc)}
            onArchive={() => {
              setActiveService(svc);
              setActionMode('archive');
            }}
          />
        )
      )}

      {draftOpen && !activeService && !draftAtTop && (
        <ServiceFormDraft
          specialityId={specialityId}
          organisationId={organisationId}
          onClose={handleCloseForm}
        />
      )}

      {!draftOpen && (
        <button
          type="button"
          onClick={handleAddClick}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-input-border-active text-body-4 text-text-brand hover:bg-blue-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          <AiOutlinePlus size={16} aria-hidden="true" />
          Click to add service
        </button>
      )}

      {actionMode === 'archive' && activeService && (
        <CenterModal
          showModal
          setShowModal={() => {
            setActionMode(null);
            setActiveService(null);
          }}
        >
          <ModalHeader
            title="Archive service"
            onClose={() => {
              setActionMode(null);
              setActiveService(null);
            }}
          />
          <p className="text-body-4 text-text-primary">
            Are you sure you want to archive <strong>{activeService.name}</strong>? It will be
            hidden from active lists and the package builder, and you can restore it later from the
            Archive tab.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Secondary
              href="#"
              text="Cancel"
              onClick={() => {
                setActionMode(null);
                setActiveService(null);
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

export default ServicesTab;
