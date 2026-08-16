import React from 'react';
import clsx from 'clsx';

export type StatusOptionButtonsOption = {
  key: string;
  name: string;
  border?: string;
};

type StatusOptionButtonsProps<Option extends StatusOptionButtonsOption> = {
  options: Option[];
  activeKey?: string;
  /** Key of the neutral "all" option, which never takes the active font weight. */
  allKey: string;
  onSelect: (key: string) => void;
  getTextColor: (option: Option) => string;
};

/**
 * Option rows shared by the status-filter dropdown panels: a dot swatch in the
 * option's border colour, the option name in its own text colour, and a
 * trailing check on the active row. The caller keeps its own portal wrapper,
 * panel styling, trigger, and selection state.
 */
const StatusOptionButtons = <Option extends StatusOptionButtonsOption>({
  options,
  activeKey,
  allKey,
  onSelect,
  getTextColor,
}: StatusOptionButtonsProps<Option>) => (
  <>
    {options.map((option) => {
      const isActive = option.key === activeKey;
      const textColor = getTextColor(option);
      return (
        <button
          key={option.key}
          type="button"
          onClick={() => onSelect(option.key)}
          className={clsx(
            'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors',
            isActive && option.key !== allKey ? 'font-medium' : 'hover:bg-card-hover'
          )}
        >
          {option.border && (
            <span
              className="inline-block size-2 rounded-full shrink-0"
              style={{
                backgroundColor: option.border,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: option.border,
              }}
            />
          )}
          <span style={{ color: textColor }}>{option.name}</span>
          {isActive && (
            <span className="ml-auto text-[12px] font-semibold" style={{ color: textColor }}>
              ✓
            </span>
          )}
        </button>
      );
    })}
  </>
);

export default StatusOptionButtons;
