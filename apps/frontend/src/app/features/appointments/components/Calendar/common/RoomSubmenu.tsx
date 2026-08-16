import React from 'react';
import {
  getMenuItemClassName,
  getRoomSavingKey,
  getRoomStatusLabel,
  type RoomOption,
} from '@/app/features/appointments/components/Calendar/common/appointmentContextMenuHelpers';

type RoomSubmenuProps = {
  submenuRef: React.RefObject<HTMLDivElement | null>;
  submenuStyle: React.CSSProperties;
  roomOptions: RoomOption[];
  savingKey: string | null;
};

const RoomSubmenu = ({ submenuRef, submenuStyle, roomOptions, savingKey }: RoomSubmenuProps) => (
  <div
    ref={submenuRef}
    role="menu"
    aria-label="Assign appointment room"
    data-context-menu="true"
    className="yc-glass-overlay fixed z-[1002] overflow-hidden rounded-[22px] px-1.5 py-2"
    style={submenuStyle}
  >
    <div className="flex max-h-[260px] flex-col gap-0.5 overflow-y-auto">
      {roomOptions.length > 0 ? (
        roomOptions.map((room, index) => {
          const isSaving = savingKey === getRoomSavingKey(room.key);
          const roomStatusLabel = getRoomStatusLabel(room.selected, isSaving);

          return (
            <React.Fragment key={room.key}>
              {index > 0 ? (
                <div className="mx-1 border-t border-white/30" aria-hidden="true" />
              ) : null}
              <button
                type="button"
                role="menuitemradio"
                aria-checked={room.selected}
                className={getMenuItemClassName(false, room.selected)}
                onClick={() => {
                  room.onSelect();
                }}
                disabled={isSaving}
              >
                <span className="truncate">{room.label}</span>
                {roomStatusLabel ? (
                  <span className="shrink-0 text-[8px] opacity-60">{roomStatusLabel}</span>
                ) : null}
              </button>
            </React.Fragment>
          );
        })
      ) : (
        <div className="px-1.5 py-1 text-[9px] leading-3.5 text-text-secondary">
          No rooms available
        </div>
      )}
    </div>
  </div>
);

export default RoomSubmenu;
