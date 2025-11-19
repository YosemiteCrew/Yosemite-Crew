import React from "react";

const SelectLabel = ({
  title,
  options,
  activeOption,
  setOption,
  type,
}: any) => {
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
        {options.map((option: any) => (
          <button
            key={option}
            onClick={() => setOption(option)}
            className={`${type === "coloumn" ? "" : "flex-1"} ${activeOption === option ? "border-blue-text! bg-blue-light! text-blue-text!" : "border-black-text! text-black-text"} rounded-2xl! border! px-4! h-12! font-satoshi font-light text-[16px]`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SelectLabel;
