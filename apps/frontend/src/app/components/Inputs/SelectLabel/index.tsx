import React from "react";

type OptionProp = {
  label: string;
  value: string;
};

type SelectLabelProps = {
  title: string;
  options: OptionProp[];
  activeOption: string;
  setOption: (key: any) => void;
  type?: string;
};

const SelectLabel = ({
  title,
  options,
  activeOption,
  setOption,
  type,
}: SelectLabelProps) => {
  return (
    <div
      className={`${type === "coloumn" ? "flex-col" : "flex-row items-center"} flex justify-between gap-3 px-1`}
    >
      <div className="text-body-4-emphasis text-text-secondary">
        {title}
      </div>
      <div
        className={`flex gap-2 ${type === "coloumn" ? "flex-wrap" : "flex-1"}`}
      >
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => setOption(option.value)}
            className={`${type === "coloumn" ? "" : "flex-1"} ${activeOption === option.value ? "border-blue-text! bg-blue-light! text-blue-text!" : "border-black-text! text-black-text"} rounded-2xl! border! px-4! h-10! text-body-4`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SelectLabel;
