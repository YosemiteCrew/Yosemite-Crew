import Next from '@/app/ui/primitives/Icons/Next';
import Back from '@/app/ui/primitives/Icons/Back';

type DayCalendarHeaderProps = {
  weekday: string;
  dateNumber: string | number;
  onPrevDay: () => void;
  onNextDay: () => void;
};

const DayCalendarHeader = ({
  weekday,
  dateNumber,
  onPrevDay,
  onNextDay,
}: DayCalendarHeaderProps) => (
  <div className="flex items-center justify-between p-2 border-b border-grey-light shrink-0">
    <Back onClick={onPrevDay} />
    <div className="flex items-center gap-2 text-center">
      <div className="text-body-4 text-(--color-primary-700)">{weekday}</div>
      <div className="text-body-4-emphasis text-white size-10 flex items-center justify-center rounded-full bg-text-brand">
        {dateNumber}
      </div>
    </div>
    <Next onClick={onNextDay} />
  </div>
);

export default DayCalendarHeader;
