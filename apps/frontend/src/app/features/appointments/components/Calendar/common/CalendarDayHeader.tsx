import React from 'react';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import UserLabels from '@/app/features/appointments/components/Calendar/common/UserLabels';
import { Team } from '@/app/features/organization/types/team';

type CalendarDayHeaderProps = {
  weekday: string;
  dateNumber: string;
  team: Team[];
  teamColumnsStyle: React.CSSProperties;
  onPrevDay: () => void;
  onNextDay: () => void;
};

const CalendarDayHeader = ({
  weekday,
  dateNumber,
  team,
  teamColumnsStyle,
  onPrevDay,
  onNextDay,
}: CalendarDayHeaderProps) => (
  <div className="min-w-max bg-white">
    {/* Row 1: date navigation — arrows sit in the same row as the day/date */}
    <div className="grid grid-cols-[64px_minmax(0,1fr)_64px] py-2 bg-white">
      <div className="sticky left-0 z-30 bg-white flex items-center justify-center">
        <Back onClick={onPrevDay} />
      </div>
      <div className="flex items-center justify-center gap-2">
        <div className="text-body-4 text-text-brand">{weekday}</div>
        <div className="text-body-4-emphasis text-white h-8 w-8 flex items-center justify-center rounded-full bg-text-brand">
          {dateNumber}
        </div>
      </div>
      <div className="sticky right-0 z-30 bg-white flex items-center justify-center">
        <Next onClick={onNextDay} />
      </div>
    </div>

    {/* Row 2: team member names — light wash to separate from calendar grid */}
    <div
      className="grid grid-cols-[64px_minmax(0,1fr)_64px] border-b border-grey-light"
      style={{ background: 'color-mix(in srgb, var(--color-brand-100) 55%, white)' }}
    >
      <div className="sticky left-0 z-30" style={{ background: 'inherit' }} />
      <UserLabels team={team} columnsStyle={teamColumnsStyle} />
      <div className="sticky right-0 z-30" style={{ background: 'inherit' }} />
    </div>
  </div>
);

export default CalendarDayHeader;
