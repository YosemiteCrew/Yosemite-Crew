import React, { useId, useState } from 'react';
import {
  AvailabilityState,
  daysOfWeek,
  DEFAULT_INTERVAL,
  Interval,
  SetAvailability,
} from '@/app/features/appointments/components/Availability/utils';
import { IoCopy } from 'react-icons/io5';

type DublicateProps = {
  setAvailability: SetAvailability;
  day: string;
};

type CopyTarget = {
  name: string;
  active: boolean;
  disable: boolean;
};

const Dublicate: React.FC<DublicateProps> = ({ setAvailability, day }) => {
  const [copyTargets, setCopyTargets] = useState<CopyTarget[]>(() =>
    daysOfWeek.map((acc) => ({
      name: acc,
      active: false,
      disable: day === acc,
    }))
  );
  const [open, setOpen] = useState<boolean>(false);
  // One Dublicate renders per day, each listing every weekday — so the day name alone
  // is not a unique id. useId scopes the checkbox ids to this instance's popover.
  const uid = useId();

  const handleSelect = (dayName: string) => {
    setCopyTargets((prev: CopyTarget[]) =>
      prev.map((item) => (item.name === dayName ? { ...item, active: !item.active } : item))
    );
  };

  const handleApply = () => {
    const selectedTargets = copyTargets.reduce<string[]>((targets, target) => {
      if (target.active && !target.disable) targets.push(target.name);
      return targets;
    }, []);

    if (selectedTargets.length === 0) {
      setOpen(false);
      return;
    }
    setAvailability((prev) => {
      const fromIntervals: Interval[] = prev[day]?.intervals ?? [];
      const clone: Interval[] = fromIntervals.map((iv) => ({
        start: iv.start,
        end: iv.end,
      }));
      const next: AvailabilityState = { ...prev };
      for (const toDay of selectedTargets) {
        next[toDay] = {
          ...next[toDay],
          enabled: true,
          intervals: clone.length ? clone : [{ ...DEFAULT_INTERVAL }],
        };
      }
      return next;
    });
    setOpen(false);
    setCopyTargets((prev) => prev.map((item) => ({ ...item, active: false })));
  };

  return (
    <div className="relative flex items-center h-[45px]">
      <IoCopy
        color="var(--color-black-pure)"
        size={20}
        className="cursor-pointer mt-0.5"
        onClick={() => setOpen((e) => !e)}
        aria-label="dublicate-button"
      />
      {open && (
        <div className="max-h-[200px] z-10 w-[120px] overflow-y-scroll scrollbar-hidden flex flex-col bg-neutral-0 rounded-2xl border border-card-border absolute left-0 top-[120%] p-1">
          {copyTargets.map((d) => (
            <label
              key={d.name}
              htmlFor={`${uid}-availability-duplicate-${d.name}-check`}
              className={`min-h-11 text-left p-2 flex items-center gap-1 select-none ${
                d.disable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            >
              <input
                id={`${uid}-availability-duplicate-${d.name}-check`}
                type="checkbox"
                aria-label={`Copy availability to ${d.name}`}
                checked={d.active}
                disabled={d.disable}
                className="h-4! w-4!"
                onChange={() => handleSelect(d.name)}
              />
              <span className="text-caption-1 text-text-primary">{d.name}</span>
            </label>
          ))}
          <button
            type="button"
            className="border-none outline-none bg-neutral-0 text-center border-t! border-t-card-border! py-2 hover:bg-card-hover! rounded-2xl! transition-all duration-300"
            onClick={handleApply}
          >
            <span className="text-caption-1 text-text-primary">Apply</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Dublicate;
