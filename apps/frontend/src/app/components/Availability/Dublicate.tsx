import React, { useState } from "react";
import { daysOfWeek, DEFAULT_INTERVAL } from "./utils";
import { IoCopy } from "react-icons/io5";

import "./Availability.css";

const Dublicate = ({ setAvailability, day }: any) => {
  const [copyTargets, setCopyTargets] = useState<any>(
    daysOfWeek.map((acc: any, i) => ({
      name: acc,
      active: false,
      disable: day === acc,
    }))
  );
  const [open, setOpen] = useState(false);

  const handleSelect = (dayName: string) => {
    setCopyTargets((prev: any[]) =>
      prev.map((item) =>
        item.name === dayName ? { ...item, active: !item.active } : item
      )
    );
  };

  const handleApply = () => {
    const selectedTargets = copyTargets
      .filter((t: any) => t.active && !t.disable)
      .map((t: any) => t.name);

    if (selectedTargets.length === 0) {
      setOpen(false);
      return;
    }
    setAvailability((prev: any) => {
      const fromIntervals = prev[day]?.intervals ?? [];
      const clone = fromIntervals.map((iv: any) => ({
        start: iv.start,
        end: iv.end,
      }));
      const next: any = { ...prev };
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
    setCopyTargets((prev: any[]) =>
      prev.map((item) => ({ ...item, active: false }))
    );
  };

  return (
    <div className="availability-dublicate">
      <IoCopy
        color="#000"
        size={20}
        className="availability-dublicate-icon"
        onClick={() => setOpen((e) => !e)}
      />
      {open && (
        <div className="availability-dublicate-dropdown">
          {daysOfWeek.map((d, i) => (
            <button
              key={d}
              className="availability-dublicate-dropdown-item"
              onClick={() => handleSelect(d)}
            >
              <label
                htmlFor="availability-dublicate-dropdown-item-check"
                className="availability-dublicate-dropdown-item-label"
              >
                <input
                  id="availability-dublicate-dropdown-item-check"
                  type="checkbox"
                  checked={copyTargets[i].active}
                  disabled={copyTargets[i].disable}
                  className="availability-dublicate-dropdown-item-check"
                />
                <span>{d}</span>
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
