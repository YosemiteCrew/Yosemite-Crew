import React from "react";

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
  return (
    <div
      className={`flex gap-2 justify-start flex-wrap items-center rounded-2xl p-0.5 bg-card-hover`}
    >
      {labels.map((label) => (
        <button
          key={label.key}
          onClick={() => !disableClicking && setActiveLabel(label.key)}
          className={`${activeLabel === label.key ? "bg-white! text-blue-text!" : "text-black-text hover:bg-white"} transition-all duration-300  text-text-secondary text-body-4 h-9 px-3 flex items-center rounded-2xl!`}
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
