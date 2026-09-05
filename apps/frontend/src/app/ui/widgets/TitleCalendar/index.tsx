import React from 'react';
import { Primary } from '@/app/ui/primitives/Buttons';

type TitleCalendarProps = {
  title: string;
  description?: string;
  setAddPopup: React.Dispatch<React.SetStateAction<boolean>>;
  count: number;
  activeView: string;
  setActiveView: React.Dispatch<React.SetStateAction<string>>;
  showAdd: boolean;
  /**
   * Label of the header's create action, in the product's "New <thing>" form
   * ("New appointment", "New task"). Each page names its own noun; the widget
   * cannot derive it from the plural `title`.
   */
  addLabel?: string;
  actionBeforeAdd?: React.ReactNode;
  viewOptions?: Array<'calendar' | 'board' | 'list'>;
};

const VIEW_OPTION_CONFIG = {
  calendar: { label: 'Calendar' },
  board: { label: 'Board' },
  list: { label: 'List' },
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
  addLabel = 'New',
  actionBeforeAdd,
  viewOptions = ['calendar', 'board', 'list'],
}: TitleCalendarProps) => {
  const n = viewOptions.length;
  const containerW = SEGMENT_WIDTH[n] ?? 'w-[300px]';
  const segW = n === 2 ? 'w-1/2' : 'w-1/3';

  return (
    <div className="flex w-full flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <h1 className="text-page-title">
          {title} <span className="text-page-title-count">{`(${count})`}</span>
        </h1>
        {description ? (
          <p className="text-[13.5px] text-[var(--ink-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2.5 sm:w-auto">
        {actionBeforeAdd}
        {showAdd && (
          <Primary href="#" text={addLabel} onClick={() => setAddPopup(true)} className="px-7" />
        )}
        <fieldset
          aria-label={`${title} view`}
          className={`flex h-10 items-center rounded-[999px]! border border-[var(--hairline)] bg-[var(--band)] m-0 p-[3px] ${containerW}`}
        >
          <legend className="sr-only">{`${title} view`}</legend>
          {viewOptions.map((option) => {
            const { label } = VIEW_OPTION_CONFIG[option];
            const isActive = activeView === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setActiveView(option);
                }}
                aria-pressed={isActive}
                className={`flex h-full items-center justify-center rounded-[999px]! text-[12.5px] transition-colors ${segW} ${
                  isActive
                    ? 'bg-[var(--screen)] font-bold text-[var(--ink)] shadow-[0_1px_3px_var(--sh08)]'
                    : 'font-semibold text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
};

export default TitleCalendar;
