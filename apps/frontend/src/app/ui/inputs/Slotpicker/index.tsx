import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GrNext, GrPrevious } from 'react-icons/gr';
import { isSameDay } from '@/app/features/appointments/components/Calendar/helpers';
import { Slot } from '@/app/features/appointments/types/appointments';
import { formatUtcTimeToLocalLabel } from '@/app/features/appointments/components/Availability/utils';

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
  if (isCurrent) return 'text-[#247AED] bg-[#E9F2FD] border-[#247AED]!';
  if (isPast) return 'border-[#747473]! bg-white opacity-40 cursor-not-allowed';
  if (isTodayDay) return 'border-[#247AED]! bg-[#F5FAFF]';
  return 'border-[#747473]! bg-white';
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

  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const dateStripRef = useRef<HTMLDivElement | null>(null);
  const slotListRef = useRef<HTMLDivElement | null>(null);
  const selectedDateRef = useRef<HTMLButtonElement | null>(null);
  const [canScrollDatesLeft, setCanScrollDatesLeft] = useState(false);
  const [canScrollDatesRight, setCanScrollDatesRight] = useState(false);

  const isAtTodayMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const days = useMemo(() => getDaysInMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  // Sync view month/year when selectedDate changes externally
  useEffect(() => {
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [selectedDate]);

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

  useEffect(() => {
    const strip = dateStripRef.current;
    if (!strip) return;

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
    if (isAtTodayMonth) return;
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

  const isSameSlot = (a: Slot | null, b: Slot) =>
    !!a && a.startTime === b.startTime && a.endTime === b.endTime;

  const scrollDateStrip = (direction: 'left' | 'right') => {
    const strip = dateStripRef.current;
    if (!strip) return;
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
          className={isAtTodayMonth ? 'cursor-not-allowed text-[#c0bfbe]' : 'cursor-pointer'}
        >
          <GrPrevious size={16} />
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
          <GrNext size={16} />
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
              : 'cursor-not-allowed text-[#c0bfbe]'
          }
        >
          <GrPrevious size={16} />
        </button>
        <div ref={dateStripRef} className="flex gap-2 overflow-x-auto scrollbar-hidden pb-1 flex-1">
          {days.map((day) => {
            const isCurrent = isSameDay(selectedDate, day);
            const isTodayDay = isSameDay(day, today);
            const isPast = isPastDay(day);
            const labelClass = isCurrent || isTodayDay ? 'text-[#247AED]' : 'text-text-primary';
            return (
              <button
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
              : 'cursor-not-allowed text-[#c0bfbe]'
          }
        >
          <GrNext size={16} />
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
                key={slot.startTime + i}
                onClick={() => setSelectedSlot(slot)}
                className={`${selected ? 'text-[#247AED] bg-[#E9F2FD] border-[#247AED]!' : 'border-[#747473]! bg-white'} px-3.5 py-2 flex items-center justify-center border rounded-xl! font-satoshi text-[12px]!`}
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
