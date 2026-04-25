import React from 'react';
import { Primary } from '@/app/ui/primitives/Buttons';
import { MdOutlineCalendarMonth, MdTableRows, MdViewKanban } from 'react-icons/md';
import { IoInformationCircleOutline } from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import clsx from 'clsx';

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
  },
  board: {
    label: 'Board',
    tooltip: 'Status board view',
    Icon: MdViewKanban,
  },
  list: {
    label: 'Table',
    tooltip: 'Table view',
    Icon: MdTableRows,
  },
} as const;

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
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 items-center gap-2 text-heading-2 text-text-primary">
          <span>
            {title}
            <span className="text-body-2 text-text-tertiary">{` (${count})`}</span>
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
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {actionBeforeAdd}
        {showAdd && (
          <Primary
            href="#"
            text="Add"
            onClick={() => setAddPopup(true)}
            className="h-12 px-7 py-0"
          />
        )}
        <div
          className="inline-flex h-10 items-center gap-1 rounded-2xl border border-neutral-300 bg-neutral-0 p-1"
          aria-label={`${title} view`}
        >
          {viewOptions.map((option) => {
            const { Icon, label, tooltip } = VIEW_OPTION_CONFIG[option];
            const isActive = activeView === option;
            return (
              <GlassTooltip key={option} content={tooltip} side="bottom">
                <button
                  type="button"
                  onClick={() => setActiveView(option)}
                  aria-pressed={isActive}
                  className={clsx(
                    'inline-flex h-8 min-w-23 items-center justify-center gap-2 rounded-xl! border px-3 text-body-4 transition-all duration-200',
                    isActive
                      ? 'border-primary-500 bg-primary-100 text-primary-700'
                      : 'border-transparent bg-transparent text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900'
                  )}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              </GlassTooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TitleCalendar;
