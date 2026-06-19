'use strict';

export interface TabSummary {
  id: string;
  title: string;
  url: string;
  favicon: string;
  loading: boolean;
  pinned: boolean;
  zoom: number;
  error: string | null;
  offline: boolean;
  audible: boolean;
  muted: boolean;
  created: number;
}

export interface TabManagerState {
  tabs: TabSummary[];
  activeId: string | null;
  closedStack: TabSummary[];
}

interface TabManager {
  create(url: string, opts?: Partial<Pick<TabSummary, 'pinned' | 'title'>>): string;
  close(id: string): boolean;
  activate(id: string): boolean;
  move(id: string, toIndex: number): boolean;
  pin(id: string, pinned: boolean): boolean;
  duplicate(id: string): string | null;
  reopenClosed(): string | null;
  updateMeta(
    id: string,
    meta: Partial<
      Pick<
        TabSummary,
        'title' | 'favicon' | 'loading' | 'error' | 'offline' | 'zoom' | 'audible' | 'muted'
      >
    >
  ): boolean;
  getState(): TabManagerState;
  persist(): string;
  restore(json: string, isAllowed?: (url: string) => boolean): boolean;
  get activeTab(): TabSummary | null;
  get tabCount(): number;
}

let nextId = 1;
const generateId = (): string => `tab_${nextId++}_${Date.now()}`;

const MAX_CLOSED_STACK = 20;

const defaultTab = (
  url: string,
  opts?: Partial<Pick<TabSummary, 'pinned' | 'title'>>
): TabSummary => ({
  id: generateId(),
  title: opts?.title || 'Loading...',
  url,
  favicon: '',
  loading: true,
  pinned: opts?.pinned || false,
  zoom: 1,
  error: null,
  offline: false,
  audible: false,
  muted: false,
  created: Date.now(),
});

export const createTabManager = (initial?: TabSummary[]): TabManager => {
  let tabs: TabSummary[] = initial || [];
  let activeId: string | null = tabs.length > 0 ? (tabs[0]?.id ?? null) : null;
  const closedStack: TabSummary[] = [];

  const findIndex = (id: string): number => tabs.findIndex((t) => t.id === id);

  const ensureActiveTab = (): void => {
    if (activeId && !tabs.some((t) => t.id === activeId)) {
      activeId = tabs.length > 0 ? (tabs[tabs.length - 1]?.id ?? null) : null;
    }
  };

  const get = (id: string): TabSummary | undefined => tabs.find((t) => t.id === id);

  return {
    get activeTab(): TabSummary | null {
      if (!activeId) return null;
      return get(activeId) || null;
    },

    get tabCount(): number {
      return tabs.length;
    },

    create(url: string, opts?: Partial<Pick<TabSummary, 'pinned' | 'title'>>): string {
      const tab = defaultTab(url, opts);
      if (opts?.pinned) {
        const lastPinned = tabs.reduce((max, t, i) => (t.pinned ? i : max), -1);
        tabs.splice(lastPinned + 1, 0, tab);
      } else {
        tabs.push(tab);
      }
      activeId = tab.id;
      return tab.id;
    },

    close(id: string): boolean {
      const idx = findIndex(id);
      if (idx === -1) return false;
      const tab = tabs[idx]!;
      const wasPinned = tab.pinned;
      tabs.splice(idx, 1);

      if (!wasPinned) {
        closedStack.unshift({ ...tab });
        if (closedStack.length > MAX_CLOSED_STACK) closedStack.pop();
      }

      ensureActiveTab();
      return true;
    },

    activate(id: string): boolean {
      if (!get(id)) return false;
      activeId = id;
      return true;
    },

    move(id: string, toIndex: number): boolean {
      const fromIdx = findIndex(id);
      if (fromIdx === -1) return false;
      const tab = tabs[fromIdx]!;

      const clampedIndex = Math.max(0, Math.min(toIndex, tabs.length - 1));
      const destTab = tabs[clampedIndex]!;

      if (tab.pinned !== destTab.pinned) return false;

      tabs.splice(fromIdx, 1);
      const adjust = fromIdx < clampedIndex ? 1 : 0;
      tabs.splice(clampedIndex - adjust, 0, tab);
      return true;
    },

    pin(id: string, pinned: boolean): boolean {
      const idx = findIndex(id);
      if (idx === -1) return false;
      const tab = tabs[idx]!;
      if (tab.pinned === pinned) return true;

      tabs.splice(idx, 1);
      tab.pinned = pinned;

      if (pinned) {
        const lastPinned = tabs.reduce((max, t, i) => (t.pinned ? i : max), -1);
        tabs.splice(lastPinned + 1, 0, tab);
      } else {
        const firstUnpinned = tabs.findIndex((t) => !t.pinned);
        if (firstUnpinned === -1) {
          tabs.push(tab);
        } else {
          tabs.splice(firstUnpinned, 0, tab);
        }
      }
      return true;
    },

    duplicate(id: string): string | null {
      const tab = get(id);
      if (!tab) return null;
      const dupId = this.create(tab.url, {
        pinned: false,
        title: tab.title || undefined,
      });
      return dupId;
    },

    reopenClosed(): string | null {
      const tab = closedStack.shift();
      if (!tab) return null;
      const restored: TabSummary = {
        ...tab,
        id: generateId(),
        loading: true,
        error: null,
        offline: false,
        created: Date.now(),
      };
      tabs.push(restored);
      activeId = restored.id;
      return restored.id;
    },

    updateMeta(
      id: string,
      meta: Partial<
        Pick<
          TabSummary,
          | 'url'
          | 'title'
          | 'favicon'
          | 'loading'
          | 'error'
          | 'offline'
          | 'zoom'
          | 'audible'
          | 'muted'
        >
      >
    ): boolean {
      const tab = get(id);
      if (!tab) return false;
      Object.assign(tab as unknown as Record<string, unknown>, meta);
      return true;
    },

    getState(): TabManagerState {
      return {
        tabs: tabs.map((t) => ({ ...t })),
        activeId,
        closedStack: closedStack.map((t) => ({ ...t })),
      };
    },

    persist(): string {
      return JSON.stringify({
        tabs: tabs.map((t) => ({
          title: t.title,
          url: t.url,
          favicon: t.favicon,
          pinned: t.pinned,
          zoom: t.zoom,
        })),
        activeId,
      });
    },

    restore(json: string, isAllowed?: (url: string) => boolean): boolean {
      try {
        const data = JSON.parse(json) as {
          tabs: Array<Partial<Omit<TabSummary, 'created'>>>;
          activeId: string | null;
        };
        if (!Array.isArray(data.tabs)) return false;
        tabs = data.tabs
          // Drop tabs whose persisted URL is missing or not an allowed in-app
          // origin — a tampered/corrupt session file must never load file:// or
          // arbitrary external origins inside the trusted shell.
          .filter((t) => (isAllowed ? isAllowed(t.url || '') : true))
          .map((t, i) => ({
            id: t.id || `tab_restored_${i}`,
            title: t.title || 'Loading...',
            url: t.url || '',
            favicon: t.favicon || '',
            loading: true,
            pinned: t.pinned || false,
            zoom: typeof t.zoom === 'number' ? t.zoom : 1,
            error: null,
            offline: false,
            audible: false,
            muted: false,
            created: Date.now(),
          }));
        // Nothing valid restored — report failure so the caller starts fresh
        // (seeds a default tab at the start URL) rather than showing empty chrome.
        if (tabs.length === 0) {
          activeId = null;
          return false;
        }
        activeId =
          data.activeId && tabs.some((t) => t.id === data.activeId)
            ? data.activeId
            : tabs[0]?.id || null;
        return true;
      } catch {
        return false;
      }
    },
  };
};
