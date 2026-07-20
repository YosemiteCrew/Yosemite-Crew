import {
  useEffect,
  useImperativeHandle,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from 'react';
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
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import YosemiteLoader from '@/app/ui/overlays/Loader/YosemiteLoader';
import { getCatalogErrorMessage } from '@/app/features/organization/services/catalogErrors';
import {
  avatarAccentFor,
  humanize,
  initialsOf,
} from '@/app/features/organization/pages/Organization/Sections/orgDisplay';
import {
  IoAddOutline,
  IoArchiveOutline,
  IoCallOutline,
  IoCreateOutline,
  IoEllipsisHorizontal,
  IoInformationCircleOutline,
  IoPhonePortraitOutline,
} from 'react-icons/io5';

export type ServicesTabHandle = { openAdd: () => void };

export type ServicePractitioner = { id: string; name: string };

type ServicesTabProps = Readonly<{
  specialityId: string;
  organisationId: string;
  specialityName?: string;
  practitioners?: ServicePractitioner[];
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

/** Design column template for the speciality service table. */
const GRID_COLS = 'grid-cols-[1.7fr_1fr_90px_90px_100px_120px_44px]';

const STATUS_PILL_CLASS =
  'inline-flex items-center rounded-full border px-[9px] py-[2px] text-[9.5px] font-bold uppercase bg-[var(--status-completed-bg)] text-[var(--status-completed-text)] border-[var(--status-completed-border)]';

/**
 * The design's status micro-badge. The catalog status arrives as a backend enum
 * (`ACTIVE`, `ARCHIVED`, ...) which must never reach UI copy, so it is humanized
 * to a readable label ("Active") and the design's all-caps look is kept as a
 * `text-transform`. Shared by the wide row and the compact row so the two can
 * never drift apart.
 */
const StatusPill = ({ status }: { status: string }) => (
  <span className={STATUS_PILL_CLASS}>{humanize(status)}</span>
);

const BookableCell = ({ isBookable }: { isBookable: boolean }) =>
  isBookable ? (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--pink)]">
      <IoPhonePortraitOutline size={12} aria-hidden="true" />
      In app
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ink-faint)]">
      <IoCallOutline size={12} aria-hidden="true" />
      Desk only
    </span>
  );

/** Overlapping monogram cluster for the practitioners who cover this speciality. */
const PractitionerStack = ({ practitioners }: { practitioners: ServicePractitioner[] }) => {
  if (practitioners.length === 0) {
    return <span className="text-[11.5px] text-[var(--ink-faint)]">—</span>;
  }
  const shown = practitioners.slice(0, 3);
  const overflow = practitioners.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((person, position) => (
        <span
          key={person.id}
          title={person.name}
          className={`flex size-[26px] items-center justify-center rounded-full border-2 border-[var(--screen)] text-[9.5px] font-bold ${avatarAccentFor(person.id)} ${position > 0 ? '-ml-[7px]' : ''}`}
        >
          {initialsOf(person.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="ml-[5px] text-[10.5px] font-semibold text-[var(--ink-faint)]">
          +{overflow}
        </span>
      )}
    </span>
  );
};

const RowActionsMenu = ({
  serviceName,
  onEdit,
  onArchive,
}: {
  serviceName: string;
  onEdit: () => void;
  onArchive: () => void;
}) => {
  const [open, setOpen] = useState(false);

  /**
   * Escape closes the menu. Focus is always on one of the three buttons while the
   * menu is open (leaving them fires the wrapper's `blur`), so the handler lives on
   * the native controls rather than on the positioning wrapper, which carries no
   * interactive semantics of its own.
   */
  const closeOnEscape = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') setOpen(false);
  };

  return (
    <div
      className="relative flex justify-center"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={`Actions for ${serviceName}`}
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={closeOnEscape}
        className="flex size-7 items-center justify-center rounded-full text-[var(--ink-faint)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] transition-colors cursor-pointer"
      >
        <IoEllipsisHorizontal size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 flex min-w-[150px] flex-col overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--screen)] py-1 shadow-[0_8px_22px_var(--sh10)]">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            onKeyDown={closeOnEscape}
            className="flex items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[var(--ink-body)] hover:bg-[var(--surface-soft)] cursor-pointer"
          >
            <IoCreateOutline size={14} aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onArchive();
            }}
            onKeyDown={closeOnEscape}
            className="flex items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[var(--danger-text)] hover:bg-[var(--surface-soft)] cursor-pointer"
          >
            <IoArchiveOutline size={14} aria-hidden="true" />
            Archive
          </button>
        </div>
      )}
    </div>
  );
};

const DetailField = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
      {label}
    </span>
    <span className="block break-words text-[12.5px] text-[var(--ink-body)]">{value}</span>
  </div>
);

/**
 * The verbose catalog fields the design keeps out of the default row. Revealed by
 * expanding a row so the numbers stay reachable without crowding the table.
 */
const ServiceDetail = ({
  service,
  currency,
  total,
}: {
  service: ServiceRevamp;
  currency: string;
  total: number;
}) => (
  <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5! pb-3! @3xl:grid-cols-4 @3xl:px-[22px]!">
    <DetailField label="Code" value={service.code} />
    <DetailField label="Type" value={TYPE_LABELS[service.type] ?? service.type} />
    <DetailField label="Gross amt." value={formatMoney(service.grossAmount, currency)} />
    <DetailField label="Total" value={formatMoney(total, currency)} />
    <DetailField label="Disc. (default)" value={`-${service.defaultDiscount}%`} />
    <DetailField label="Max disc." value={`-${service.maxDiscount}%`} />
    <DetailField label="In-patient" value={service.isInpatientPreferred ? 'Preferred' : 'No'} />
    <div className="col-span-2 min-w-0 @3xl:col-span-4">
      <span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
        Description
      </span>
      <span className="block text-[12.5px] text-[var(--ink-body)]">
        {service.description || '—'}
      </span>
    </div>
  </div>
);

const ServiceNameCell = ({
  service,
  expanded,
  onToggle,
}: {
  service: ServiceRevamp;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={expanded}
    className="min-w-0 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] rounded"
  >
    <span className="block truncate font-bold text-[var(--ink)]">{service.name}</span>
    <span className="block truncate text-[11px] text-[var(--ink-faint)]">
      {service.description || TYPE_LABELS[service.type] || service.type}
    </span>
  </button>
);

const ServiceRow = ({
  service,
  currency,
  practitioners,
  onEdit,
  onArchive,
}: {
  service: ServiceRevamp;
  currency: string;
  practitioners: ServicePractitioner[];
  onEdit: () => void;
  onArchive: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const { total } = computeServiceTotal(service);
  const toggle = () => setExpanded((previous) => !previous);
  const price = formatMoney(total, currency);

  return (
    <div className="border-t border-[var(--hairline)]">
      {/* Design table row — needs the full 7-column width */}
      <div
        className={`hidden @3xl:grid ${GRID_COLS} items-center gap-[10px] px-[22px]! py-[11px]! text-[13px] text-[var(--ink-body)]`}
      >
        <ServiceNameCell service={service} expanded={expanded} onToggle={toggle} />
        <PractitionerStack practitioners={practitioners} />
        <span className="text-right tabular-nums">{service.durationMinutes} min</span>
        <span className="text-right font-bold tabular-nums text-[var(--ink)]">{price}</span>
        <span>
          <BookableCell isBookable={service.isBookable} />
        </span>
        <span>
          <StatusPill status={service.status} />
        </span>
        <RowActionsMenu serviceName={service.name} onEdit={onEdit} onArchive={onArchive} />
      </div>

      {/* Compact stacked row for narrow containers (phone / side drawer) */}
      <div className="flex flex-col gap-2 px-5! py-3! text-[13px] text-[var(--ink-body)] @3xl:hidden">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ServiceNameCell service={service} expanded={expanded} onToggle={toggle} />
          </div>
          <StatusPill status={service.status} />
          <RowActionsMenu serviceName={service.name} onEdit={onEdit} onArchive={onArchive} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="tabular-nums text-[12px] text-[var(--ink-muted)]">
            {service.durationMinutes} min
          </span>
          <span className="font-bold tabular-nums text-[var(--ink)]">{price}</span>
          <BookableCell isBookable={service.isBookable} />
          <PractitionerStack practitioners={practitioners} />
        </div>
      </div>

      {expanded && <ServiceDetail service={service} currency={currency} total={total} />}
    </div>
  );
};

const ServicesTableHeader = () => (
  <div
    className={`hidden @3xl:grid ${GRID_COLS} items-center gap-[10px] bg-[var(--screen-2)] px-[22px]! py-[10px]! text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]`}
  >
    <span>Service</span>
    <span>Practitioners</span>
    <span className="text-right">Duration</span>
    <span className="text-right">Price</span>
    <span>Bookable</span>
    <span>Status</span>
    <span aria-hidden="true" />
  </div>
);

function ServicesTab({
  specialityId,
  organisationId,
  specialityName,
  practitioners = [],
  ref,
}: ServicesTabProps) {
  const services = useRevampCatalogStore(
    useShallow((s) =>
      s.services.filter((svc) => svc.specialityId === specialityId && svc.status === 'ACTIVE')
    )
  );
  const archiveService = useRevampCatalogStore((s) => s.archiveService);
  const loadSpecialityCatalog = useRevampCatalogStore((s) => s.loadSpecialityCatalog);
  const { notify } = useNotify();
  const orgCurrency = useCurrencyForPrimaryOrg();

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
    <div className="@container flex flex-col">
      {draftOpen && !activeService && draftAtTop && (
        <div className="px-5! py-4!">
          <ServiceFormDraft
            specialityId={specialityId}
            organisationId={organisationId}
            onClose={handleCloseForm}
          />
        </div>
      )}

      {loading && services.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <YosemiteLoader variant="inline" size={48} label="Loading services" />
        </div>
      )}

      {!loading && services.length === 0 && !draftOpen && (
        <div className="flex items-center justify-center gap-2 py-8 text-body-4 text-text-secondary">
          <IoInformationCircleOutline size={16} aria-hidden="true" />
          You haven&apos;t added any services yet.
        </div>
      )}

      {services.length > 0 && <ServicesTableHeader />}

      {services.map((svc) =>
        draftOpen && activeService?.id === svc.id && actionMode === 'edit' ? (
          <div key={svc.id} className="border-t border-[var(--hairline)] px-5! py-4!">
            <ServiceFormDraft
              specialityId={specialityId}
              organisationId={organisationId}
              editService={svc}
              onClose={handleCloseForm}
            />
          </div>
        ) : (
          <ServiceRow
            key={svc.id}
            service={svc}
            currency={svc.currency ?? orgCurrency}
            practitioners={practitioners}
            onEdit={() => handleEdit(svc)}
            onArchive={() => {
              setActiveService(svc);
              setActionMode('archive');
            }}
          />
        )
      )}

      {draftOpen && !activeService && !draftAtTop && (
        <div className="border-t border-[var(--hairline)] px-5! py-4!">
          <ServiceFormDraft
            specialityId={specialityId}
            organisationId={organisationId}
            onClose={handleCloseForm}
          />
        </div>
      )}

      {!draftOpen && (
        <div className="border-t border-[var(--hairline)] px-5! py-[11px]! @3xl:px-[22px]!">
          <button
            type="button"
            onClick={handleAddClick}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--blue-text)] hover:text-[var(--nav-active)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] rounded"
          >
            <IoAddOutline size={14} aria-hidden="true" />
            {specialityName ? `Add service to ${specialityName}` : 'Add service'}
          </button>
        </div>
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
