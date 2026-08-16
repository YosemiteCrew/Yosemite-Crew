import '@/app/ui/tables/GenericTable/Generictable.css';

type DayCalendarHeaderProps = {
  weekday: string;
  dateNumber: string | number;
};

/**
 * Day-column header for the single-day grid. This and the week grid's day strip
 * used to restate the same band by hand at 9.5px/700/0.08em - a comment here
 * even said "same recipe as the week grid", which is precisely the duplication
 * that let them drift from the table header at 10.5px/700/0.1em. Both now take
 * `.yc-table-head`.
 *
 * `--static`: the scrolling section is a SIBLING of this header, not an
 * ancestor, so `top: 0` has nothing to resolve against and sticky would be dead
 * weight. Day navigation lives in the toolbar's date-nav pill, so this strip
 * carries no arrows.
 */
const DayCalendarHeader = ({ weekday, dateNumber }: DayCalendarHeaderProps) => (
  <div className="yc-table-head yc-table-head--static flex shrink-0 flex-col items-center gap-px">
    <div style={{ color: 'var(--ink-faint)' }}>{weekday}</div>
    {/* Digits opt out of the inherited uppercase + 0.1em tracking: the trailing
        letter-space pushes centred numerals off centre. */}
    <div
      className="text-[14px] font-bold normal-case tracking-normal"
      style={{ color: 'var(--ink)' }}
    >
      {dateNumber}
    </div>
  </div>
);

export default DayCalendarHeader;
