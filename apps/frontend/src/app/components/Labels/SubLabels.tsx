import React, { useEffect, useRef, useState } from "react";

type SubLabelItem = {
  key: string;
  name: string;
};

type SubLabelsProps = {
  labels: SubLabelItem[];
  activeLabel: string;
  setActiveLabel: (key: any) => void;
};

const SubLabels = ({ labels, activeLabel, setActiveLabel }: SubLabelsProps) => {
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
      className={`flex gap-2 overflow-x-auto overflow-y-hidden shrink-0 scrollbar-hidden ${isOverflowing ? "justify-start" : "justify-center"}`}
    >
      {labels.map((label) => (
        <button
          key={label.key}
          onClick={() => setActiveLabel(label.key)}
          className={`${activeLabel === label.key ? "border-blue-text! bg-blue-light! text-blue-text shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-black-text! text-black-text"} hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-9 px-3 border! flex items-center whitespace-nowrap rounded-xl! font-satoshi font-semibold text-[15px]`}
        >
          {label.name}
        </button>
      ))}
    </div>
  );
};

export default SubLabels;
