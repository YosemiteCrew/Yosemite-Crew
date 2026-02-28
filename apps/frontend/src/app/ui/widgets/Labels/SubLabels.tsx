import React from "react";

type SubLabelItem = {
  key: string;
  name: React.ReactNode;
};

type SubLabelsProps = {
  labels: SubLabelItem[];
  activeLabel?: string;
  setActiveLabel?: any;
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
  const isLogoOnlyIdexx =
    labels.length === 1 && labels[0]?.key === "idexx-labs";

  return (
    <div
      className={
        isLogoOnlyIdexx
          ? "inline-flex justify-center items-center w-fit mx-auto"
          : "inline-flex gap-2 justify-center flex-wrap items-center rounded-2xl p-1 border border-card-border bg-card-hover w-fit mx-auto"
      }
    >
      {labels.map((label) => (
        <button
          key={label.key}
          type="button"
          role="tab"
          aria-selected={activeLabel === label.key}
          disabled={disableClicking}
          onClick={() => setActiveLabel?.(label.key)}
          className={
            isLogoOnlyIdexx
              ? `transition-all duration-200 flex items-center focus-visible:outline-none ${
                  disableClicking ? "opacity-70 cursor-not-allowed" : ""
                }`
              : `transition-all duration-200 text-body-4 h-9 px-3 flex items-center rounded-2xl! border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-text ${
                  activeLabel === label.key
                    ? "bg-white! text-blue-text! border-text-brand!"
                    : "text-black-text border-transparent hover:bg-white"
                } ${disableClicking ? "opacity-70 cursor-not-allowed" : ""}`
          }
        >
          <span className="flex items-center justify-center gap-2 text-center w-full">
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
