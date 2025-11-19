import React from "react";
import SubLabels from "./SubLabels";

type LabelItem = {
  key: string;
  name: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  iconSize: number;
  labels: { key: string; name: string }[];
};

type LabelsProps = {
  labels: LabelItem[];
  activeLabel: string;
  setActiveLabel: (key: string) => void;
  activeSubLabel: string;
  setActiveSubLabel: (key: string) => void;
};

const Labels = ({
  labels,
  activeLabel,
  setActiveLabel,
  activeSubLabel,
  setActiveSubLabel,
}: LabelsProps) => {
  const active = labels.find((l) => l.key === activeLabel);
  const subLabels = active ? active.labels : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-3">
        {labels.map((label) => (
          <button
            key={label.key}
            onClick={() => setActiveLabel(label.key)}
            className={`${activeLabel === label.key ? "border-blue-text! bg-blue-light! text-blue-text shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-grey-light!"} hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] flex items-center justify-center h-[60px] w-[60px] rounded-2xl! bg-white! border!`}
          >
            <label.icon
              size={label.iconSize}
              color={activeLabel === label.key ? "#247aed" : "#000"}
            />
          </button>
        ))}
      </div>
      {subLabels.length > 0 && (
        <SubLabels
          labels={subLabels}
          activeLabel={activeSubLabel}
          setActiveLabel={setActiveSubLabel}
        />
      )}
    </div>
  );
};

export default Labels;
