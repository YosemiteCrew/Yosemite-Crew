'use strict';

// Pin / floating reference window: opens the current page in a small,
// always-on-top window so a clinician can keep a reference (e.g. a chart or
// protocol) visible while working in another tab. The manager is a pure,
// injectable unit (mirrors secondary-display.ts) — the real BrowserWindow
// creation is supplied by the composition root so this stays unit-testable.

export interface PinnedWindow {
  id: string;
  url: string;
  windowId: string;
}

export interface PinWindowManager {
  // Returns the manager id for the pin, or null when the URL can't be pinned.
  pin: (url: string, title?: string) => string | null;
  close: (id: string) => boolean;
  closeAll: () => void;
  list: () => { id: string; url: string }[];
  has: (url: string) => boolean;
}

interface PinWindowDeps {
  // Creates the real window and returns its (stringified) window id.
  createWindow: (url: string, title: string) => string;
  closeWindow: (windowId: string) => boolean;
  focusWindow?: (windowId: string) => void;
  // Gate which URLs may be pinned (defaults to http/https only). The composition
  // root passes an in-app-only check so external/arbitrary URLs can't be floated.
  isPinnable?: (url: string) => boolean;
  generateId?: () => string;
}

let pinCounter = 0;
const defaultGenerateId = (): string => `pin-${Date.now()}-${++pinCounter}`;

const defaultPinnable = (url: string): boolean => /^https?:\/\//i.test(url);

export const createPinWindowManager = (deps: PinWindowDeps): PinWindowManager => {
  const generateId = deps.generateId || defaultGenerateId;
  const isPinnable = deps.isPinnable || defaultPinnable;
  const pinned = new Map<string, PinnedWindow>();

  const findByUrl = (url: string): PinnedWindow | undefined => {
    for (const entry of pinned.values()) {
      if (entry.url === url) return entry;
    }
    return undefined;
  };

  const pin = (url: string, title = 'Pinned'): string | null => {
    if (!url || !isPinnable(url)) return null;
    // Avoid duplicate floats of the same page — focus the existing one instead.
    const existing = findByUrl(url);
    if (existing) {
      deps.focusWindow?.(existing.windowId);
      return existing.id;
    }
    const id = generateId();
    const windowId = deps.createWindow(url, title);
    pinned.set(id, { id, url, windowId });
    return id;
  };

  const close = (id: string): boolean => {
    const entry = pinned.get(id);
    if (!entry) return false;
    deps.closeWindow(entry.windowId);
    pinned.delete(id);
    return true;
  };

  const closeAll = (): void => {
    for (const entry of pinned.values()) {
      deps.closeWindow(entry.windowId);
    }
    pinned.clear();
  };

  const list = (): { id: string; url: string }[] =>
    Array.from(pinned.values()).map((entry) => ({ id: entry.id, url: entry.url }));

  const has = (url: string): boolean => Boolean(findByUrl(url));

  return { pin, close, closeAll, list, has };
};

const DEFAULT_PIN_SIZE = { width: 440, height: 720 };

// Pure helper: a floating reference panel anchored to the top-right of the given
// work area, clamped to the area so it never spawns off-screen.
export const pinWindowBounds = (
  area: { x: number; y: number; width: number; height: number },
  size: { width: number; height: number } = DEFAULT_PIN_SIZE
): { x: number; y: number; width: number; height: number } => {
  const margin = 24;
  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  const x = Math.round(area.x + area.width - width - margin);
  const y = Math.round(area.y + margin);
  return { x, y, width, height };
};
