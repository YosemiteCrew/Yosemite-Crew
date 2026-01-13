import React from "react";
import SubLabels from "./SubLabels";

type LabelItem = {
  key: string;
  name: string;
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {labels.map((label) => (
          <button
            key={label.key}
            onClick={() => setActiveLabel(label.key)}
            className={`min-w-20 text-body-4 px-3 py-[5px] text-text-secondary rounded-2xl! transition-all duration-300 ${label.key === activeLabel ? " bg-blue-light text-blue-text! border-text-brand! border" : "border border-card-border! hover:bg-card-hover!"}`}
          >
            {label.name}
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
