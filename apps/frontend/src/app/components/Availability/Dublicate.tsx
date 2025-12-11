import React, { useState } from "react";
import {
  AvailabilityState,
  daysOfWeek,
  DEFAULT_INTERVAL,
  Interval,
  SetAvailability,
} from "./utils";
import { IoCopy } from "react-icons/io5";

import "./Availability.css";

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
    <div className="availability-dublicate">
      <IoCopy
        color="#000"
        size={20}
        className="availability-dublicate-icon"
        onClick={() => setOpen((e) => !e)}
        aria-label="dublicate-button"
      />
      {open && (
        <div className="availability-dublicate-dropdown">
          {copyTargets.map((d, i) => (
            <button
              key={d.name}
              className="availability-dublicate-dropdown-item"
            >
              <label
                htmlFor={`availability-duplicate-${d.name}-check`}
                className="availability-dublicate-dropdown-item-label"
              >
                <input
                  id={`availability-duplicate-${d.name}-check`}
                  type="checkbox"
                  checked={d.active}
                  disabled={d.disable}
                  className="availability-dublicate-dropdown-item-check"
                  onClick={() => handleSelect(d.name)}
                />
                <span>{d.name}</span>
              </label>
            </button>
          ))}
          <button
            className="availability-dublicate-dropdown-button"
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
};

export default Dublicate;
