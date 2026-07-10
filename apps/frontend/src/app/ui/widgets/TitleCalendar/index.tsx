import React from 'react';
import { Primary } from '@/app/ui/primitives/Buttons';
import {
  IoCalendarOutline,
  IoGridOutline,
  IoInformationCircleOutline,
  IoReorderFourOutline,
} from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

type TitleCalendarProps = {
  title: string;
  description?: string;
  setAddPopup: React.Dispatch<React.SetStateAction<boolean>>;
  count: number;
  activeView: string;
  setActiveView: React.Dispatch<React.SetStateAction<string>>;
  showAdd: boolean;
  actionBeforeAdd?: React.ReactNode;
  viewOptions?: Array<'calendar' | 'board' | 'list'>;
};

const VIEW_OPTION_CONFIG = {
  calendar: { label: 'Calendar', tooltip: 'Calendar view', Icon: IoCalendarOutline },
  board: { label: 'Board', tooltip: 'Status board view', Icon: IoGridOutline },
  list: { label: 'Table', tooltip: 'Table view', Icon: IoReorderFourOutline },
} as const;

const SEGMENT_WIDTH: Record<number, string> = {
  2: 'w-full sm:w-[320px]',
  3: 'w-full sm:w-[390px]',
};

const TitleCalendar = ({
  title,
  description,
  setAddPopup,
  count,
  activeView,
  setActiveView,
  showAdd,
  actionBeforeAdd,
  viewOptions = ['calendar', 'board', 'list'],
}: TitleCalendarProps) => {
  const n = viewOptions.length;
  const containerW = SEGMENT_WIDTH[n] ?? 'w-[300px]';
  const segW = n === 2 ? 'w-1/2' : 'w-1/3';

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-heading-2 font-newsreader text-text-primary">
          <span>
            {title}
            <span className="text-body-2 text-text-secondary">{` (${count})`}</span>
          </span>
          {description ? (
            <GlassTooltip content={description} side="bottom">
              <button
                type="button"
                aria-label={`${title} info`}
                className="inline-flex size-5 shrink-0 items-center justify-center leading-none text-text-secondary transition-colors hover:text-text-primary"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          ) : null}
        </h1>
      </div>
      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
        {actionBeforeAdd}
        {showAdd && (
          <Primary href="#" text="Add" onClick={() => setAddPopup(true)} className="px-7" />
        )}
        <fieldset
          aria-label={`${title} view`}
          className={`flex h-10 items-center rounded-[999px]! border border-[var(--hairline)] bg-[var(--band)] m-0 p-[3px] ${containerW}`}
        >
          <legend className="sr-only">{`${title} view`}</legend>
          {viewOptions.map((option) => {
            const { Icon, label } = VIEW_OPTION_CONFIG[option];
            const isActive = activeView === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setActiveView(option);
                }}
                aria-pressed={isActive}
                className={`flex h-full items-center justify-center gap-1.5 rounded-[999px]! text-[12.5px] transition-colors ${segW} ${
                  isActive
                    ? 'bg-[var(--screen)] font-bold text-[var(--ink)] shadow-[0_1px_3px_var(--sh08)]'
                    : 'font-semibold text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon size={15} aria-hidden="true" className="shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
};

export default TitleCalendar;
