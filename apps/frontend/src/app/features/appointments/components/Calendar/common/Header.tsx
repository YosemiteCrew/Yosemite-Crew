import React from 'react';
import { getMonthYear } from '@/app/features/appointments/components/Calendar/helpers';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { FiZoomIn, FiZoomOut } from 'react-icons/fi';
import Datepicker from '@/app/ui/inputs/Datepicker';
import Dropdown from '@/app/ui/inputs/Dropdown';
import { IoAdd } from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

type Headerprops = {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  zoomMode?: CalendarZoomMode;
  setZoomMode?: React.Dispatch<React.SetStateAction<CalendarZoomMode>>;
  activeCalendar?: string;
  setActiveCalendar?: React.Dispatch<React.SetStateAction<string>>;
  showAddButton?: boolean;
  onAddButtonClick?: () => void;
};

const Header = ({
  setCurrentDate,
  currentDate,
  zoomMode,
  setZoomMode,
  activeCalendar,
  setActiveCalendar,
  showAddButton = false,
  onAddButtonClick,
}: Headerprops) => {
  const isZoomIn = zoomMode !== 'out';
  const isZoomOut = !isZoomIn;
  const showCalendarTypeSelector = !!activeCalendar && !!setActiveCalendar;
  return (
    <div className="relative z-[140] overflow-visible flex w-full items-center justify-between gap-3 px-3 py-2 border-b border-grey-light">
      <div className="text-heading-2 text-text-primary text-left">{getMonthYear(currentDate)}</div>
      <div className="flex items-center justify-end gap-2">
        {showAddButton && (
          <GlassTooltip content="Add appointment" side="bottom">
            <button
              type="button"
              title="Add appointment"
              aria-label="Add appointment"
              onClick={onAddButtonClick}
              className="rounded-2xl! border! border-input-border-default! px-[13px] py-[13px] transition-all duration-300 ease-in-out hover:bg-card-bg"
            >
              <IoAdd size={20} color="#302f2e" />
            </button>
          </GlassTooltip>
        )}
        <GlassTooltip content="Select date" side="bottom">
          <div className="relative z-[150] scale-[0.94] origin-right">
            <Datepicker
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              placeholder="Select Date"
            />
          </div>
        </GlassTooltip>
        {showCalendarTypeSelector && (
          <div className="relative z-[150] scale-[0.94] origin-right">
            <Dropdown
              options={[
                { key: 'day', label: 'Day' },
                { key: 'week', label: 'Week' },
                { key: 'team', label: 'Team' },
              ]}
              placeholder="View"
              defaultOption={activeCalendar}
              onSelect={(option) => setActiveCalendar(option.key)}
            />
          </div>
        )}
        {zoomMode && setZoomMode && (
          <div className="inline-flex items-center rounded-full border border-card-border bg-card-bg p-1">
            <button
              type="button"
              onClick={() => setZoomMode('in')}
              title="Zoom in timeline"
              className={`h-9 w-9 rounded-full! cursor-pointer inline-flex items-center justify-center transition-colors ${
                isZoomIn
                  ? 'bg-white text-text-primary border border-card-border'
                  : 'text-text-secondary hover:bg-card-hover border border-transparent'
              }`}
            >
              <FiZoomIn size={18} />
            </button>
            <button
              type="button"
              onClick={() => setZoomMode('out')}
              title="Zoom out timeline"
              className={`h-9 w-9 rounded-full! cursor-pointer inline-flex items-center justify-center transition-colors ${
                isZoomOut
                  ? 'bg-white text-text-primary border border-card-border'
                  : 'text-text-secondary hover:bg-card-hover border border-transparent'
              }`}
            >
              <FiZoomOut size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;
