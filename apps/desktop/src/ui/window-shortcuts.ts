'use strict';

/**
 * Keys the main process handles for the whole window. The tab strip listens for
 * these too, but only receives them while the strip itself has focus, which is
 * almost never — the page holds focus for the rest of the session.
 */
export const WINDOW_SHORTCUTS = Array.from({ length: 9 }, (_, i) => `CommandOrControl+${i + 1}`);

// Resolved from the list above rather than from a second copy of the digits, so
// the accelerators the conflict test checks are the ones the window claims.
const TAB_INDEX_BY_KEY = new Map(
  WINDOW_SHORTCUTS.map((accelerator, index) => [accelerator.split('+').pop() as string, index])
);

export interface WindowInput {
  type: string;
  key: string;
  control: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

interface WindowShortcutDeps {
  activateTabByIndex: (index: number) => void;
  isMac: boolean;
}

export const createWindowInputHandler =
  (deps: WindowShortcutDeps) =>
  (event: { preventDefault: () => void }, input: WindowInput): void => {
    if (input.type !== 'keyDown') return;
    const modifier = deps.isMac ? input.meta : input.control;
    if (!modifier || input.alt || input.shift) return;

    const index = TAB_INDEX_BY_KEY.get(input.key);
    if (index === undefined) return;

    event.preventDefault();
    deps.activateTabByIndex(index);
  };
