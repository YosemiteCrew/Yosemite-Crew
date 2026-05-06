import React from 'react';
import { Primary } from '@/app/ui/primitives/Buttons';
import { MdOutlineCalendarMonth, MdTableRows, MdViewKanban } from 'react-icons/md';
import { IoInformationCircleOutline } from 'react-icons/io5';
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
  calendar: {
    label: 'Calendar',
    tooltip: 'Calendar view',
    Icon: MdOutlineCalendarMonth,
    activeSlider: 'bg-(--color-primary-700)',
    activeText: 'text-neutral-0',
  },
  board: {
    label: 'Board',
    tooltip: 'Status board view',
    Icon: MdViewKanban,
    activeSlider: 'bg-success-700',
    activeText: 'text-neutral-0',
  },
  list: {
    label: 'Table',
    tooltip: 'Table view',
    Icon: MdTableRows,
    activeSlider: 'bg-text-primary',
    activeText: 'text-neutral-0',
  },
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
  const activeIndex = viewOptions.indexOf(activeView as 'calendar' | 'board' | 'list');
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;
  const activeConfig = VIEW_OPTION_CONFIG[viewOptions[safeIndex]];
  const containerW = SEGMENT_WIDTH[n] ?? 'w-[300px]';
  const segW = n === 2 ? 'w-1/2' : 'w-1/3';
  const sliderTranslate = `translateX(${safeIndex * 100}%)`;

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 items-center gap-2 text-heading-2 text-text-primary">
          <span>
            {title}
            <span className="text-body-2 text-text-secondary">{` (${count})`}</span>
          </span>
          {description ? (
            <GlassTooltip content={description} side="bottom">
              <button
                type="button"
                aria-label={`${title} info`}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center leading-none text-text-secondary transition-colors hover:text-text-primary"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          ) : null}
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
        {actionBeforeAdd}
        {showAdd && (
          <Primary
            href="#"
            text="Add"
            onClick={() => setAddPopup(true)}
            className="h-12 px-7 py-0"
          />
        )}
        <fieldset
          aria-label={`${title} view`}
          className={`relative flex h-10 items-stretch overflow-hidden rounded-[999px]! border border-card-border bg-white m-0 p-0 ${containerW}`}
        >
          <legend className="sr-only">{`${title} view`}</legend>
          <div
            aria-hidden
            className={`absolute top-0 bottom-0 rounded-[999px]! transition-all duration-300 ease-in-out ${activeConfig.activeSlider} ${segW}`}
            style={{ transform: sliderTranslate }}
          />
          {viewOptions.map((option) => {
            const { Icon, label, activeText } = VIEW_OPTION_CONFIG[option];
            const isActive = activeView === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setActiveView(option)}
                aria-pressed={isActive}
                className={`relative z-10 flex items-center justify-center gap-1.5 text-body-4 transition-colors duration-200 ${segW} ${
                  isActive ? activeText : 'text-text-secondary hover:text-text-primary'
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
