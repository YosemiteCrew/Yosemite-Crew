import React from "react";

type OptionProp = {
  name: string;
  key: string;
};

type SelectLabelProps = {
  title: string;
  options: OptionProp[];
  activeOption: string;
  setOption: (key: string) => void;
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
      className={`${type === "coloumn" ? "flex-col" : "flex-row items-center"} flex justify-between gap-3`}
    >
      <div className="font-satoshi font-semibold text-[18px] text-black-text">
        {title}
      </div>
      <div
        className={`flex gap-2 ${type === "coloumn" ? "flex-wrap" : "flex-1"}`}
      >
        {options.map((option) => (
          <button
            key={option.key}
            onClick={() => setOption(option.key)}
            className={`${type === "coloumn" ? "" : "flex-1"} ${activeOption === option.key ? "border-blue-text! bg-blue-light! text-blue-text!" : "border-black-text! text-black-text"} rounded-2xl! border! px-4! h-12! font-satoshi font-light text-[16px]`}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SelectLabel;
