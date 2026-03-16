import React from 'react';
import { Primary } from '@/app/ui/primitives/Buttons';
import { IoIosCalendar } from 'react-icons/io';
import { MdTaskAlt, MdViewKanban } from 'react-icons/md';
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
    <div className="flex justify-between items-center w-full flex-wrap gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-text-primary text-heading-1">
          {title}
          <span className="text-text-tertiary">{' (' + count + ')'}</span>
        </div>
        {description ? (
          <p className="text-body-3 text-text-secondary max-w-lg">{description}</p>
        ) : null}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        {actionBeforeAdd}
        {showAdd && (
          <Primary
            href="#"
            text="Add"
            onClick={() => setAddPopup(true)}
            className="h-12 px-7 py-0"
          />
        )}
        <div className="flex h-12 rounded-2xl border border-card-border overflow-hidden bg-white">
          {viewOptions.includes('calendar') && (
            <GlassTooltip content="Calendar view" side="bottom">
              <button
                onClick={() => setActiveView('calendar')}
                className={`${activeView === 'calendar' ? 'bg-blue-light!' : 'hover:bg-card-hover!'} h-full px-5 transition-all duration-300 flex items-center justify-center ${
                  viewOptions.some((option) => option !== 'calendar')
                    ? 'border-r border-card-border'
                    : ''
                }`}
              >
                <IoIosCalendar
                  size={24}
                  className={`${activeView === 'calendar' ? 'text-text-brand' : 'text-text-primary'}`}
                />
              </button>
            </GlassTooltip>
          )}
          {viewOptions.includes('board') && (
            <GlassTooltip content="Status board view" side="bottom">
              <button
                onClick={() => setActiveView('board')}
                className={`${activeView === 'board' ? 'bg-blue-light!' : 'hover:bg-card-hover!'} h-full px-5 transition-all duration-300 flex items-center justify-center ${
                  viewOptions.includes('list') ? 'border-r border-card-border' : ''
                }`}
              >
                <MdViewKanban
                  size={22}
                  className={`${activeView === 'board' ? 'text-text-brand' : 'text-text-primary'}`}
                />
              </button>
            </GlassTooltip>
          )}
          {viewOptions.includes('list') && (
            <GlassTooltip content="Table view" side="bottom">
              <button
                onClick={() => setActiveView('list')}
                className={`${activeView === 'list' ? 'bg-blue-light!' : 'hover:bg-card-hover!'} h-full px-5 transition-all duration-300 bg-white flex items-center justify-center`}
              >
                <MdTaskAlt
                  size={24}
                  className={`${activeView === 'list' ? 'text-text-brand' : 'text-text-primary'}`}
                />
              </button>
            </GlassTooltip>
          )}
        </div>
      </div>
    </div>
  );
};

export default TitleCalendar;
