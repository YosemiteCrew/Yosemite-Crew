export type MenuAction = {
  key: string;
  label: string;
  destructive?: boolean;
  submenu?: 'status' | 'room';
  onSelect?: () => void | Promise<void>;
};

export type MenuSubmenu = 'status' | 'room' | null;

export type RoomOption = {
  key: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
};

export type SubmenuPosition = {
  left: number;
  openToLeft: boolean;
  top: number;
};

export const MENU_ESTIMATED_WIDTH = 220;
export const SUBMENU_ESTIMATED_WIDTH = 200;
export const VIEWPORT_MARGIN = 12;
export const SUBMENU_HORIZONTAL_GAP = 10;
export const SUBMENU_ROW_OFFSET = 4;

export const getMenuItemClassName = (destructive = false, active = false) =>
  [
    'flex w-full items-center justify-between gap-2 rounded-[12px] px-2.5 py-1.5 text-left font-satoshi text-[13px] font-normal leading-5 tracking-[-0.32px] transition-colors',
    destructive ? 'text-text-error hover:bg-danger-100/72' : 'text-text-primary hover:bg-white/50',
    active ? 'bg-white/58' : 'bg-transparent',
  ].join(' ');

export const resolveMenuError = (error: unknown, fallback: string) => {
  const message =
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    (error as Error)?.message;
  return String(message || fallback);
};

export const getRoomSavingKey = (roomKey: string) =>
  `room-${roomKey === 'clear-room' ? 'none' : roomKey}`;

export const getRoomStatusLabel = (selected: boolean, saving: boolean) => {
  if (selected) return 'Current';
  if (saving) return 'Saving';
  return null;
};

// Re-exported for consumers that only need the status-label typing without pulling in React.
export type { AppointmentStatus } from '@/app/features/appointments/types/appointments';
