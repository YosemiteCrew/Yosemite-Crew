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
  <div className="grid border-b border-grey-light py-2 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max bg-white">
    <div className="sticky left-0 z-30 bg-white flex items-center justify-center">
      <Back onClick={onPrevDay} />
    </div>
    <div className="bg-white min-w-max flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <div className="text-body-4 text-text-brand">{weekday}</div>
        <div className="text-body-4-emphasis text-white h-8 w-8 flex items-center justify-center rounded-full bg-text-brand">
          {dateNumber}
        </div>
      </div>
      <UserLabels team={team} columnsStyle={teamColumnsStyle} />
    </div>
    <div className="sticky right-0 z-30 bg-white flex items-center justify-center">
      <Next onClick={onNextDay} />
    </div>
  </div>
);

export default CalendarDayHeader;
