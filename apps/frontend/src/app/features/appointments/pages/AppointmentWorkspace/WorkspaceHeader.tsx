import React from 'react';
import { IoIosArrowBack } from 'react-icons/io';
import { LuPlus } from 'react-icons/lu';
import { HiBolt } from 'react-icons/hi2';
import type { Appointment } from '@yosemite-crew/types';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import AlertPill from '@/app/features/appointments/pages/AppointmentWorkspace/components/AlertPill';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import EmergencyBadge from '@/app/features/appointments/components/EmergencyBadge';
import type { CompanionAlert } from '@/app/features/appointments/types/workspace';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

type WorkspaceHeaderProps = {
  appointment: Appointment;
  companionName: string;
  alerts: CompanionAlert[];
  /** Read-only client (parent) alerts, surfaced alongside the patient alerts.
   *  Managed from the companion/client modal, not editable here. */
  clientAlerts?: CompanionAlert[];
  onBack: () => void;
  onQuickActions: () => void;
  onHospitalize?: () => void;
  /** Hide the hospitalize action when the encounter is already inpatient. */
  canHospitalize?: boolean;
  canAdmit?: boolean;
  isAdmitting?: boolean;
  onAdmit?: () => void;
  onAddAlert?: () => void;
  onRemoveAlert?: (id: string) => void;
};

const HospitalizeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M18.3405 17.6327C18.3405 17.8687 18.2429 18.0949 18.0693 18.2618C17.8957 18.4286 17.6601 18.5224 17.4146 18.5224H2.59975C2.35418 18.5224 2.11867 18.4286 1.94503 18.2618C1.77138 18.0949 1.67383 17.8687 1.67383 17.6327V8.28235C1.67373 8.14678 1.70588 8.01297 1.76782 7.89116C1.82977 7.76935 1.91987 7.66276 2.03124 7.57952L9.43864 1.69233C9.60118 1.57084 9.80123 1.50488 10.0072 1.50488C10.2131 1.50488 10.4131 1.57084 10.5757 1.69233L17.9831 7.57952C18.0945 7.66276 18.1846 7.76935 18.2465 7.89116C18.3084 8.01297 18.3406 8.14678 18.3405 8.28235V17.6327ZM16.4886 16.743V8.7165L10.0072 3.52236L3.52568 8.7165V16.743H16.4886Z"
      fill="white"
    />
    <path
      d="M9.17383 11.8561V13.5228C9.17383 13.7589 9.25383 13.9569 9.41383 14.1169C9.57383 14.2769 9.77161 14.3567 10.0072 14.3561C10.2427 14.3556 10.4408 14.2756 10.6013 14.1161C10.7619 13.9567 10.8416 13.7589 10.8405 13.5228V11.8561H12.5072C12.7433 11.8561 12.9413 11.7761 13.1013 11.6161C13.2613 11.4561 13.341 11.2583 13.3405 11.0228C13.3399 10.7872 13.2599 10.5895 13.1005 10.4295C12.941 10.2695 12.7433 10.1895 12.5072 10.1895H10.8405V8.52279C10.8405 8.28668 10.7605 8.0889 10.6005 7.92946C10.4405 7.77001 10.2427 7.69001 10.0072 7.68946C9.77161 7.6889 9.57383 7.7689 9.41383 7.92946C9.25383 8.09001 9.17383 8.28779 9.17383 8.52279V10.1895H7.50716C7.27105 10.1895 7.07328 10.2695 6.91383 10.4295C6.75439 10.5895 6.67439 10.7872 6.67383 11.0228C6.67328 11.2583 6.75328 11.4564 6.91383 11.617C7.07439 11.7775 7.27216 11.8572 7.50716 11.8561H9.17383Z"
      fill="white"
    />
  </svg>
);

/**
 * Top header: back arrow, "<Companion>'s Appointment", alert pills, then the
 * shared status pill (single source of truth — also used in the calendar
 * popover) and Quick Actions on the right.
 */
const WorkspaceHeader = ({
  appointment,
  companionName,
  alerts,
  clientAlerts = [],
  onBack,
  onQuickActions,
  onHospitalize,
  canHospitalize = true,
  canAdmit = false,
  isAdmitting = false,
  onAdmit,
  onAddAlert,
  onRemoveAlert,
}: WorkspaceHeaderProps) => {
  const terminologyText = useCompanionTerminologyText();
  const hasAlerts = alerts.length > 0 || clientAlerts.length > 0 || Boolean(onAddAlert);

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          aria-label="Go back"
          onClick={onBack}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-900 transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          <IoIosArrowBack size={22} aria-hidden="true" />
        </button>
        <h1 className="shrink-0 font-satoshi text-[24px] font-medium leading-[120%] tracking-[-0.48px] text-neutral-900">
          {companionName.split(' ')[0]}&rsquo;s Appointment
        </h1>
        <AppointmentStatusPill appointment={appointment} />
        {appointment.isEmergency && <EmergencyBadge />}
        {hasAlerts && (
          <div
            data-testid="workspace-alert-strip"
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 scrollbar-hidden"
          >
            {alerts.map((alert) => (
              <div key={alert.id} className="shrink-0">
                <AlertPill
                  id={alert.id}
                  label={alert.label}
                  severity={alert.severity}
                  onRemove={onRemoveAlert}
                />
              </div>
            ))}
            {clientAlerts.map((alert) => (
              <div key={alert.id} className="shrink-0">
                <AlertPill
                  id={alert.id}
                  label={`Client: ${alert.label}`}
                  severity={alert.severity}
                />
              </div>
            ))}
            {onAddAlert && (
              <GlassTooltip content={terminologyText('Add alerts for patient')} side="bottom">
                <button
                  type="button"
                  aria-label="Add alert"
                  onClick={onAddAlert}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border border-neutral-500 text-neutral-700 transition-colors duration-150 hover:border-text-brand hover:text-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
                >
                  <LuPlus size={14} aria-hidden="true" />
                </button>
              </GlassTooltip>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {canAdmit && onAdmit && (
          <Primary
            text={isAdmitting ? 'Admitting' : 'Admit'}
            onClick={onAdmit}
            isDisabled={isAdmitting}
          />
        )}
        {canHospitalize && (
          <button
            type="button"
            aria-label={terminologyText('Hospitalize patient')}
            onClick={onHospitalize}
            className="flex size-11 items-center justify-center rounded-3xl bg-neutral-900 transition-colors duration-150 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <HospitalizeIcon />
          </button>
        )}
        <Secondary
          text="Quick Actions"
          onClick={onQuickActions}
          icon={<HiBolt aria-hidden="true" />}
          className="bg-neutral-0!"
        />
      </div>
    </div>
  );
};

export default WorkspaceHeader;
