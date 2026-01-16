import React, { useState } from "react";
import {
  AvailabilityState,
  daysOfWeek,
  DEFAULT_INTERVAL,
  Interval,
  SetAvailability,
} from "./utils";
import { IoCopy } from "react-icons/io5";

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
  const [copyTargets, setCopyTargets] = useState<CopyTarget[]>(
    daysOfWeek.map((acc) => ({
      name: acc,
      active: false,
      disable: day === acc,
    }))
  );
  const [open, setOpen] = useState<boolean>(false);

  const handleSelect = (dayName: string) => {
    setCopyTargets((prev: CopyTarget[]) =>
      prev.map((item) =>
        item.name === dayName ? { ...item, active: !item.active } : item
      )
    );
  };

  const handleApply = () => {
    const selectedTargets = copyTargets
      .filter((t) => t.active && !t.disable)
      .map((t) => t.name);

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
        color="#000"
        size={20}
        className="cursor-pointer"
        onClick={() => setOpen((e) => !e)}
        aria-label="dublicate-button"
      />
      {open && (
        <div className="max-h-[200px] z-10 w-[120px] overflow-y-scroll scrollbar-hidden flex flex-col bg-white rounded-2xl border border-card-border absolute left-0 top-[120%] py-1 px-1">
          {copyTargets.map((d, i) => (
            <button
              key={d.name}
              className="border-none outline-none bg-white text-left px-2 py-2 flex items-center gap-1"
            >
              <input
                id={`availability-duplicate-${d.name}-check`}
                type="checkbox"
                checked={d.active}
                disabled={d.disable}
                className="h-4! w-4!"
                onChange={() => handleSelect(d.name)}
              />
              <span className="text-caption-1 text-text-primary">{d.name}</span>
            </button>
          ))}
          <button
            className="border-none outline-none bg-white text-center border-t! border-t-card-border! py-2 hover:bg-card-hover! rounded-2xl! transition-all duration-300"
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
