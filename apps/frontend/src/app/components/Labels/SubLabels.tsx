import React, { useEffect, useRef, useState } from "react";

type SubLabelItem = {
  key: string;
  name: string;
};

type SubLabelsProps = {
  labels: SubLabelItem[];
  activeLabel: string;
  setActiveLabel: (key: any) => void;
  statuses?: Record<string, "valid" | "error" | undefined>;
  disableClicking?: boolean;
};

const SubLabels = ({
  labels,
  activeLabel,
  setActiveLabel,
  statuses = {},
  disableClicking = false,
}: SubLabelsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const checkOverflow = () => {
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    };
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [labels]);

  return (
    <div
      ref={containerRef}
      className={`flex gap-2 overflow-x-auto overflow-y-hidden shrink-0 ${isOverflowing ? "justify-start" : "justify-center"}`}
    >
      {labels.map((label) => (
        <button
          key={label.key}
          onClick={() => !disableClicking && setActiveLabel(label.key)}
          className={`${activeLabel === label.key ? "border-blue-text! bg-blue-light! text-blue-text shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-black-text! text-black-text"} hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-9 px-3 border! flex items-center whitespace-nowrap rounded-xl! font-satoshi font-semibold text-[15px]`}
        >
          <span className="flex items-center gap-2">
            {label.name}
            {statuses[label.key] === "valid" && (
              <span className="text-green-600 text-sm">•</span>
            )}
            {statuses[label.key] === "error" && (
              <span className="text-red-500 text-sm">•</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
};

export default SubLabels;
