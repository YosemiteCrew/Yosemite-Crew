import React from 'react';

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

const SelectLabel = ({ title, options, activeOption, setOption, type }: SelectLabelProps) => {
  return (
    <div
      className={`${type === 'coloumn' ? 'flex-col' : 'flex-row items-center'} flex justify-between gap-3 px-1`}
    >
      <div className="text-[12px] font-semibold text-text-secondary">{title}</div>
      <div className={`flex gap-2 ${type === 'coloumn' ? 'flex-wrap' : 'flex-1'}`}>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => setOption(option.value)}
            className={`${type === 'coloumn' ? '' : 'flex-1'} ${activeOption === option.value ? 'border-blue-text! bg-blue-light! text-blue-text!' : 'border-input-border-default! text-text-secondary'} rounded-full! border-[1.5px]! px-4! h-9! text-caption-2 font-semibold font-satoshi!`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SelectLabel;
