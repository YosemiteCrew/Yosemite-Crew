import React from 'react';
import { IoAdd } from 'react-icons/io5';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import Datepicker from '@/app/ui/inputs/Datepicker';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { Primary } from '@/app/ui/primitives/Buttons';
import AppointmentScopeToggle from '@/app/ui/primitives/AppointmentScopeToggle/AppointmentScopeToggle';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { getEmergencyPillStyle } from '@/app/features/appointments/components/appointmentBoardHelpers';

type AppointmentBoardToolbarProps = {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  onWheelHorizontal: React.WheelEventHandler<HTMLDivElement>;
  emergency: {
    active: boolean;
    color: string;
    present: boolean;
    onToggle: () => void;
  };
  permissions: {
    editAppointments: boolean;
  };
  onAddAppointment?: () => void;
  scope: {
    mineOnly: boolean;
    onMineOnlyChange: (value: boolean) => void;
  };
};

const AppointmentBoardToolbar = ({
  currentDate,
  setCurrentDate,
  onWheelHorizontal,
  emergency,
  permissions,
  onAddAppointment,
  scope,
}: AppointmentBoardToolbarProps) => (
  <div className="shrink-0 border-b border-card-border bg-neutral-0 px-3 py-2">
    <div className="flex w-full items-center gap-4">
      <div className="flex shrink-0 items-center gap-2 text-body-4-emphasis text-text-primary">
        <GlassTooltip content="Select date" side="bottom">
          <Datepicker
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            placeholder="Select Date"
          />
        </GlassTooltip>
        <div className="flex items-center gap-2">
          <Back
            onClick={() =>
              setCurrentDate((prev) => {
                const next = new Date(prev);
                next.setDate(next.getDate() - 1);
                return next;
              })
            }
          />
          <div className="whitespace-nowrap">
            {formatDateInPreferredTimeZone(currentDate, {
              weekday: 'long',
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })}
          </div>
          <Next
            onClick={() =>
              setCurrentDate((prev) => {
                const next = new Date(prev);
                next.setDate(next.getDate() + 1);
                return next;
              })
            }
          />
        </div>
      </div>
      <div
        className="relative z-20 min-w-0 flex-1 overflow-x-auto scrollbar-x-float py-1 -my-1"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
        onWheel={onWheelHorizontal}
      >
        <div className="flex w-max items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={emergency.onToggle}
            className="relative flex w-fit shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3.5 py-1.5 rounded-full! text-[12px] font-semibold transition-colors"
            style={getEmergencyPillStyle(emergency.active)}
          >
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: 'var(--danger)' }}
            />
            <span>Emergencies</span>
            {emergency.present && (
              <span
                aria-label="Emergency appointments present"
                className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full"
                style={{
                  backgroundColor: 'var(--danger)',
                  outline: '2px solid var(--screen)',
                }}
              />
            )}
          </button>
          {permissions.editAppointments && (
            <>
              <div className="h-8 w-px shrink-0 bg-card-border" aria-hidden="true" />
              <Primary
                text="New appointment"
                onClick={onAddAppointment}
                icon={<IoAdd size={18} aria-hidden="true" />}
                className="h-12 w-fit shrink-0 justify-center gap-2 px-4 py-0 whitespace-nowrap hover:scale-100"
              />
            </>
          )}
          <div className="shrink-0">
            <AppointmentScopeToggle
              showMineOnly={scope.mineOnly}
              onChange={scope.onMineOnlyChange}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default AppointmentBoardToolbar;
