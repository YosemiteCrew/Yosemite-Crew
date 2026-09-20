import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The welcome screen's feature carousel, against the real app (issue #3299).
//
// These need the real window rather than a unit test for two reasons. The
// autoplay rule lives in carousel-autoplay.js and is unit tested there, but
// nothing in that test knows whether welcome.html actually LOADS it - the first
// cut of this fix did not, and every a11y attribute below silently stayed
// unset while the unit tests were green. And `inert` and the reduced-motion
// media query are browser behaviour, not logic.
//
// `firstWindow()` is the welcome screen: the app boots into it and only reaches
// a PIMS tab once startSignin runs, which these specs deliberately never do.

const APP_ROOT = path.resolve(__dirname, '..', '..');

// Comfortably more than the 4s carousel interval that carousel-autoplay.js
// declares, so "it did not advance" is a claim about three missed ticks.
const THREE_INTERVALS = 12_000;

const visibleSlide = (page: Page): Promise<number> =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.slide')).findIndex((s) => !(s as HTMLElement).inert)
  );

// The two transient holds, read off the page rather than assumed. Every spec
// below says which hold it is exercising and asserts the other one is not also
// in force, because any one of them alone keeps the slides still and a spec
// that does not check cannot tell which one it measured.
const holds = (page: Page): Promise<{ hovering: boolean; focusWithin: boolean }> =>
  page.evaluate(() => {
    const carousel = document.getElementById('carousel')!;
    // `:hover` matches the ancestors of the hovered element too, so this is
    // exactly the condition welcome.js tracks from mouseenter/mouseleave.
    return {
      hovering: carousel.matches(':hover'),
      focusWithin: carousel.contains(document.activeElement),
    };
  });

// Put the pointer somewhere the carousel is not, and take focus out of it.
// A CI runner starts with the OS cursor wherever it left it - Windows parks it
// mid-screen - and Chromium hovers whatever the new window puts under it, with
// no mouse movement needed. That hover held the carousel for the whole run: it
// is why the control spec failed on windows-latest and passed on macos-latest,
// and it means the three holding specs were each satisfied by a hover rather
// than by the thing they name.
const releaseHolds = async (page: Page): Promise<void> => {
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};
const ELECTRON_EXECUTABLE = electronPath as unknown as string;

// `fakeClock` swaps the page's timers for Playwright's controllable clock, so
// a spec can say "four autoplay intervals passed" instead of sleeping through
// them. That matters for more than speed: three of these specs assert a
// NON-event - the slide did not change - and a fixed sleep can only ever say it
// did not change within the sleep. Driving the clock makes the amount of time
// that passed exact, and the last spec is the control that proves the driven
// clock really does fire the autoplay interval, so the other three are not
// passing simply because nothing is running.
//
// The clock has to be installed before the page's scripts run, and the welcome
// screen is already loaded by the time the app hands us a window, so the page
// is reloaded under it.
const launchWelcome = async (
  options: { fakeClock?: boolean } = {}
): Promise<{ app: ElectronApplication; page: Page; userDataDir: string }> => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yc-e2e-welcome-'));
  const app = await electron.launch({
    executablePath: ELECTRON_EXECUTABLE,
    args: [APP_ROOT],
    env: {
      ...process.env,
      YC_DESKTOP_DISABLE_UPDATES: '1',
      YC_DESKTOP_USER_DATA_DIR: userDataDir,
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  if (options.fakeClock) {
    await page.clock.install();
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  }
  await page.waitForSelector('.dot');
  await releaseHolds(page);
  return { app, page, userDataDir };
};

test.describe('welcome carousel', () => {
  let app: ElectronApplication | undefined;
  let userDataDir: string | undefined;

  test.afterEach(async () => {
    await app?.close().catch(() => undefined);
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
    app = undefined;
    userDataDir = undefined;
  });

  test('only the visible slide is exposed, and the active dot says so', async () => {
    const launched = await launchWelcome();
    app = launched.app;
    userDataDir = launched.userDataDir;
    const { page } = launched;

    // All five slides used to be readable at once: the off-screen four are
    // still in the document, just translated out of view.
    const state = await page.evaluate(() => {
      const slides = Array.from(document.querySelectorAll('.slide'));
      const dots = Array.from(document.querySelectorAll('.dot'));
      return {
        total: slides.length,
        inert: slides.filter((s) => (s as HTMLElement).inert).length,
        current: dots.map((d) => d.getAttribute('aria-current')),
      };
    });
    expect(state.total).toBeGreaterThan(1);
    expect(state.inert).toBe(state.total - 1);
    expect(state.current).toEqual(['true', ...Array(state.total - 1).fill(null)]);
  });

  test('a dot press moves the carousel and takes the exposure with it', async () => {
    const launched = await launchWelcome();
    app = launched.app;
    userDataDir = launched.userDataDir;
    const { page } = launched;

    await page.locator('.dot').nth(2).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('.slide')).findIndex(
            (s) => !(s as HTMLElement).inert
          )
        )
      )
      .toBe(2);
    expect(
      await page.evaluate(() => document.querySelectorAll('.dot')[2]!.getAttribute('aria-current'))
    ).toBe('true');
  });

  test('the pause control stops the carousel and names the action it will do next', async () => {
    const launched = await launchWelcome({ fakeClock: true });
    app = launched.app;
    userDataDir = launched.userDataDir;
    const { page } = launched;

    const toggle = page.locator('#carousel-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-label', 'Pause slideshow');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-label', 'Play slideshow');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // The click left the pointer on the toggle and the focus in it, and the
    // toggle is inside #carousel - so without this the hover and focus holds
    // would keep the slides still whether or not the press did anything.
    await releaseHolds(page);
    expect(await holds(page)).toEqual({ hovering: false, focusWithin: false });

    // Paused means paused: the slide must still be the one the user left it on
    // well after the 4s interval that used to advance it unconditionally.
    const before = await visibleSlide(page);
    await page.clock.runFor(THREE_INTERVALS);
    expect(await visibleSlide(page)).toBe(before);
  });

  test('keyboard focus inside the carousel holds the slide still', async () => {
    const launched = await launchWelcome({ fakeClock: true });
    app = launched.app;
    userDataDir = launched.userDataDir;
    const { page } = launched;

    // Hovering already did this; a keyboard user on the dots had no equivalent
    // and watched their target move out from under them every four seconds.
    await page.locator('.dot').first().focus();
    expect(await holds(page)).toEqual({ hovering: false, focusWithin: true });

    const before = await visibleSlide(page);
    await page.clock.runFor(THREE_INTERVALS);
    expect(await visibleSlide(page)).toBe(before);
  });

  test('reduced motion stops the slides, not only the sliding animation', async () => {
    const launched = await launchWelcome({ fakeClock: true });
    app = launched.app;
    userDataDir = launched.userDataDir;
    const { page } = launched;

    // The page reads the preference at load and again on change; emulating it
    // here fires the change, which is the path a user flipping the OS setting
    // with the app already open takes.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect
      .poll(() => page.evaluate(() => document.getElementById('carousel-toggle')!.hidden))
      .toBe(true);
    expect(await holds(page)).toEqual({ hovering: false, focusWithin: false });

    const before = await visibleSlide(page);
    await page.clock.runFor(THREE_INTERVALS);
    expect(await visibleSlide(page)).toBe(before);
  });

  test('the carousel advances on its own when nothing is holding it', async () => {
    // The control for the three specs above, and for the driven clock itself:
    // if autoplay were broken outright, or if runFor did not fire the page's
    // interval, each of them would pass for the wrong reason.
    const launched = await launchWelcome({ fakeClock: true });
    app = launched.app;
    userDataDir = launched.userDataDir;
    const { page } = launched;

    expect(await holds(page)).toEqual({ hovering: false, focusWithin: false });

    // Prove the driven clock fires this page's timers before reading the
    // carousel: if it did not, this spec and the three above would all report
    // "the slide did not move" and none of them would be measuring anything.
    await page.evaluate(() => {
      const w = globalThis as unknown as { ycTicks: number };
      w.ycTicks = 0;
      setInterval(() => {
        w.ycTicks += 1;
      }, 4000);
    });

    const before = await visibleSlide(page);
    await page.clock.runFor(THREE_INTERVALS);
    expect(
      await page.evaluate(() => (globalThis as unknown as { ycTicks: number }).ycTicks)
    ).toBeGreaterThanOrEqual(3);
    expect(await visibleSlide(page)).not.toBe(before);
  });
});
