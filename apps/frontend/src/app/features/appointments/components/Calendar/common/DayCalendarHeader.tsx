type DayCalendarHeaderProps = {
  weekday: string;
  dateNumber: string | number;
};

/**
 * Day-column header for the single-day grid. Same recipe as the week grid's day
 * headers: a --screen-2 band closed by a --hairline rule, carrying an all-caps
 * 9.5px/700/0.08em --ink-faint label over the 14px/700 date. Day navigation lives
 * in the header toolbar's date-nav pill, so this strip carries no arrows.
 */
const DayCalendarHeader = ({ weekday, dateNumber }: DayCalendarHeaderProps) => (
  <div
    className="flex shrink-0 flex-col items-center gap-px border-b px-1 py-2"
    style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--screen-2)' }}
  >
    <div
      className="text-[9.5px] font-bold uppercase tracking-[0.08em]"
      style={{ color: 'var(--ink-faint)' }}
    >
      {weekday}
    </div>
    <div className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
      {dateNumber}
    </div>
  </div>
);

export default DayCalendarHeader;
