import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import { isSameDay } from '@/app/features/appointments/components/Calendar/helpers';
import { Slot } from '@/app/features/appointments/types/appointments';
import { formatUtcTimeToLocalLabel } from '@/app/features/appointments/components/Availability/utils';

const isSameSlot = (a: Slot | null, b: Slot) =>
  !!a && a.startTime === b.startTime && a.endTime === b.endTime;

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const weekdayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DATE_STRIP_SCROLL_PX = 180;

type SlotpickerProps = {
  selectedDate: Date;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  selectedSlot: Slot | null;
  setSelectedSlot: React.Dispatch<React.SetStateAction<Slot | null>>;
  timeSlots: Slot[];
};

function getDaysInMonth(year: number, month: number): Date[] {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
}

function getDayButtonClass(isCurrent: boolean, isPast: boolean, isTodayDay: boolean): string {
  if (isCurrent) return 'text-blue-text bg-blue-light border-blue-text!';
  if (isPast) return 'border-grey-text! bg-neutral-0 opacity-40 cursor-not-allowed';
  if (isTodayDay) return 'border-blue-text! bg-brand-100';
  return 'border-grey-text! bg-neutral-0';
}

const Slotpicker = ({
  selectedDate,
  setSelectedDate,
  selectedSlot,
  setSelectedSlot,
  timeSlots,
}: SlotpickerProps) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewYear, setViewYear] = useState(() => selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDate.getMonth());
  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  if (prevSelectedDate !== selectedDate) {
    setPrevSelectedDate(selectedDate);
    const newYear = selectedDate.getFullYear();
    const newMonth = selectedDate.getMonth();
    if (viewYear !== newYear) setViewYear(newYear);
    if (viewMonth !== newMonth) setViewMonth(newMonth);
  }

  const dateStripRef = useRef<HTMLDivElement | null>(null);
  const slotListRef = useRef<HTMLDivElement | null>(null);
  const selectedDateRef = useRef<HTMLButtonElement | null>(null);
  const [canScrollDatesLeft, setCanScrollDatesLeft] = useState(false);
  const [canScrollDatesRight, setCanScrollDatesRight] = useState(false);
  const onWheelHorizontal = useWheelToHorizontalScroll();

  const isAtTodayMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const days = useMemo(() => getDaysInMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  // Auto-scroll selected date into center of strip whenever it changes
  useEffect(() => {
    const btn = selectedDateRef.current;
    const strip = dateStripRef.current;
    if (!btn || !strip) return;
    const btnLeft = btn.offsetLeft;
    const btnWidth = btn.offsetWidth;
    const stripWidth = strip.offsetWidth;
    strip.scrollTo({ left: btnLeft - stripWidth / 2 + btnWidth / 2, behavior: 'smooth' });
  }, [selectedDate, viewMonth, viewYear]);

  useLayoutEffect(() => {
    const strip = dateStripRef.current;
    if (!strip) {
      /* v8 ignore start -- unreachable: dateStripRef is attached to a div that is rendered unconditionally, so the ref is always set by the time this layout effect runs */
      return;
      /* v8 ignore stop */
    }

    const syncScrollArrows = () => {
      setCanScrollDatesLeft(strip.scrollLeft > 4);
      setCanScrollDatesRight(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4);
    };

    syncScrollArrows();
    strip.addEventListener('scroll', syncScrollArrows, { passive: true });
    globalThis.addEventListener('resize', syncScrollArrows);

    return () => {
      strip.removeEventListener('scroll', syncScrollArrows);
      globalThis.removeEventListener('resize', syncScrollArrows);
    };
  }, [days.length, viewMonth, viewYear]);

  const handlePrevMonth = () => {
    if (isAtTodayMonth) {
      /* v8 ignore start -- unreachable: the "Previous month" button carries `disabled={isAtTodayMonth}`, so this handler can never run while the guard is true */
      return;
      /* v8 ignore stop */
    }
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isPastDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const handleClickDate = (date: Date) => {
    if (isPastDay(date)) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    globalThis.setTimeout(() => {
      slotListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  };

  const scrollDateStrip = (direction: 'left' | 'right') => {
    const strip = dateStripRef.current;
    if (!strip) {
      /* v8 ignore start -- unreachable: the scroll arrows and the dateStripRef div are siblings in the same unconditional subtree, so the ref is always set whenever an arrow can be clicked */
      return;
      /* v8 ignore stop */
    }
    strip.scrollBy({
      left: direction === 'left' ? -DATE_STRIP_SCROLL_PX : DATE_STRIP_SCROLL_PX,
      behavior: 'smooth',
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={handlePrevMonth}
          disabled={isAtTodayMonth}
          className={isAtTodayMonth ? 'cursor-not-allowed text-neutral-200' : 'cursor-pointer'}
        >
          <IoChevronBackOutline size={16} />
        </button>
        <div className="text-body-3 text-text-primary">
          {monthNames[viewMonth]} {viewYear}
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={handleNextMonth}
          className="cursor-pointer text-text-primary"
        >
          <IoChevronForwardOutline size={16} />
        </button>
      </div>

      {/* Horizontal scrollable date strip */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Scroll dates left"
          onClick={() => scrollDateStrip('left')}
          disabled={!canScrollDatesLeft}
          className={
            canScrollDatesLeft
              ? 'cursor-pointer text-text-primary'
              : 'cursor-not-allowed text-neutral-200'
          }
        >
          <IoChevronBackOutline size={16} />
        </button>
        <div
          ref={dateStripRef}
          className="flex gap-2 overflow-x-auto scrollbar-x-float pb-1 flex-1"
          onWheel={onWheelHorizontal}
        >
          {days.map((day) => {
            const isCurrent = isSameDay(selectedDate, day);
            const isTodayDay = isSameDay(day, today);
            const isPast = isPastDay(day);
            const labelClass = isCurrent || isTodayDay ? 'text-blue-text' : 'text-text-primary';
            return (
              <button
                type="button"
                key={day.toISOString()}
                ref={isCurrent ? selectedDateRef : null}
                onClick={() => handleClickDate(day)}
                className={[
                  'relative flex flex-col gap-1 items-center justify-center px-3 py-2 border rounded-xl! shrink-0 min-w-14',
                  getDayButtonClass(isCurrent, isPast, isTodayDay),
                ].join(' ')}
              >
                <div className={`text-sm font-satoshi ${labelClass}`}>
                  {weekdayShort[day.getDay()]}
                </div>
                <div className={`text-sm font-satoshi ${labelClass}`}>
                  {String(day.getDate()).padStart(2, '0')}
                </div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Scroll dates right"
          onClick={() => scrollDateStrip('right')}
          disabled={!canScrollDatesRight}
          className={
            canScrollDatesRight
              ? 'cursor-pointer text-text-primary'
              : 'cursor-not-allowed text-neutral-200'
          }
        >
          <IoChevronForwardOutline size={16} />
        </button>
      </div>

      {/* Time slots */}
      <div
        ref={slotListRef}
        className="flex flex-wrap gap-2 px-2 sm:px-3 mb-2 max-h-50 overflow-y-auto scrollbar-hidden"
      >
        {timeSlots.length > 0 ? (
          timeSlots.map((slot, i) => {
            const selected = isSameSlot(selectedSlot, slot);
            return (
              <button
                type="button"
                key={slot.startTime + i}
                onClick={() => setSelectedSlot(slot)}
                className={`${selected ? 'bg-[var(--blue-strong)] text-white border-transparent! shadow-[0_6px_16px_var(--glow-b26)]' : 'border-input-border-default! bg-neutral-0 text-text-primary'} px-3.5 h-10 flex items-center justify-center border-[1.5px] rounded-[11px]! font-satoshi text-[12.5px]! font-semibold tabular-nums`}
              >
                {formatUtcTimeToLocalLabel(slot.startTime)}
              </button>
            );
          })
        ) : (
          <div className="text-center w-full text-caption-1 text-text-primary py-3">
            No slot available
          </div>
        )}
      </div>
    </div>
  );
};

export default Slotpicker;
