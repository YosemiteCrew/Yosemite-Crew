import type { ElectronApplication } from '@playwright/test';

// Which web contents the app has handed focus to.
//
// `webContents.isFocused()` is not the measurable half here: a test-launched
// app is not allowed to become the active application, so its window is never
// key and isFocused() stays false whatever the app does. That is a property of
// the harness, not of the app, and asserting on it fails on a CI runner while
// passing nowhere useful. Which contents the app *hands* focus to is the part
// the app controls, so that is what this records.
//
// The same instrument is inlined in idle-lock.e2e.ts, which is where it was
// first worked out; that copy is left alone only to keep this change off a file
// another branch is editing.
export const recordFocusCalls = (app: ElectronApplication): Promise<void> =>
  app.evaluate(({ webContents }) => {
    const g = globalThis as Record<string, unknown>;
    if (g.__focused) return;
    const focused: number[] = [];
    g.__focused = focused;
    let proto = Object.getPrototypeOf(webContents.getAllWebContents()[0]);
    while (proto && !Object.prototype.hasOwnProperty.call(proto, 'focus')) {
      proto = Object.getPrototypeOf(proto);
    }
    const focus = proto.focus as (this: Electron.WebContents) => void;
    proto.focus = function (this: Electron.WebContents) {
      focused.push(this.id);
      return focus.call(this);
    };
  });

// How many focus calls the app has made so far; pass it to focusedSince.
export const focusMark = (app: ElectronApplication): Promise<number> =>
  app.evaluate(() => ((globalThis as Record<string, unknown>).__focused as number[]).length);

// Whether the app has focused something since `mark`, and the latest was the
// web contents whose URL contains `url`.
export const focusedSince = (
  app: ElectronApplication,
  mark: number,
  url: string
): Promise<boolean> =>
  app.evaluate(
    ({ webContents }, { mark: from, url: target }) => {
      const focused = ((globalThis as Record<string, unknown>).__focused as number[]).slice(from);
      const wc = webContents.getAllWebContents().find((w) => w.getURL().includes(target));
      return Boolean(wc) && focused[focused.length - 1] === wc!.id;
    },
    { mark, url }
  );
