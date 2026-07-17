import { create } from 'zustand';

/**
 * Transient state for the phone shell. `chatUnread` is the integration seam for
 * the Chat tab badge: the chat feature (Stream Chat) can publish its total
 * unread count here and the bottom tab bar renders the badge from it. Defaults
 * to 0 so the badge is absent until there is a real unread count — no invented
 * data.
 */
type PhoneShellState = {
  chatUnread: number;
  setChatUnread: (count: number) => void;
};

export const usePhoneShellStore = create<PhoneShellState>((set) => ({
  chatUnread: 0,
  setChatUnread: (count) => set({ chatUnread: Math.max(0, Math.trunc(count)) }),
}));
