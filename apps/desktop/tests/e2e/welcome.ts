import { expect, type ElectronApplication, type Page } from '@playwright/test';

export type AppPages = {
  // The app shell: the window Electron opens first. It owns the privileged
  // preload, so every ycDesktop IPC call and every app-level keyboard shortcut
  // belongs here.
  shell: Page;
  // The tab showing PIMS content. Assert page content against this one.
  tab: Page;
};

// Drive the app out of its welcome screen and hand back both pages.
//
// These specs were written when launching the app navigated straight to
// YC_DESKTOP_START_URL, so each took `app.firstWindow()` to be the PIMS page.
// The app now boots into its own bundled welcome screen (src/pages/welcome.html)
// and firstWindow() is that screen. Nothing errored; the specs asserted against
// the wrong document and every one failed on
//
//   strict mode violation: getByRole('heading', { name: 'Sign In' })
//     resolved to 2 elements:
//       1) <h1>Sign in to Yosemite Crew</h1>
//       2) <h3>Sign in once</h3>
//
// which are welcome.html's own headings, matched because getByRole's `name`
// option is a case-insensitive SUBSTRING match by default.
//
// Two pages are returned rather than one because the app genuinely has two, and
// conflating them is what made the original specs fragile. Privileged IPC is
// deliberately NOT exposed to a tab: remote PIMS content must not be able to
// reach the document vault or the controlled-substance log, and core/ipc.ts
// gates trust on the sender frame. Calling ycDesktop from the tab returns null
// and surfaces as `Cannot read properties of null`, which reads like a broken
// test rather than the security boundary doing its job.
//
// Rule of thumb: IPC and shortcuts go to `shell`, page content goes to `tab`.
export const openPimsTab = async (
  app: ElectronApplication,
  pimsOrigin: string,
  timeout = 20_000
): Promise<AppPages> => {
  const shell = await app.firstWindow();
  await shell.waitForLoadState('domcontentloaded');

  const findTab = (): Page | undefined =>
    app.windows().find((candidate) => candidate.url().startsWith(pimsOrigin));

  // Idempotent: a spec that already reached tab mode by its own route (or a
  // relaunch that restored a session) must not have startSignin fired at it a
  // second time, which navigates a page another step of the test is using.
  if (!findTab()) {
    await shell.evaluate(async () => {
      const yc = (globalThis as Record<string, unknown>).ycDesktop as
        { startSignin?: () => Promise<unknown> } | undefined;
      if (!yc?.startSignin) throw new Error('preload did not expose ycDesktop.startSignin');
      await yc.startSignin();
    });
  }

  // Tabs are WebContentsView instances rather than BrowserWindows, so poll the
  // window list rather than waiting on a 'window' event a view may never emit.
  let tab: Page | undefined;
  await expect
    .poll(
      () => {
        tab = findTab();
        return Boolean(tab);
      },
      {
        timeout,
        message: `no window reached ${pimsOrigin} after startSignin; the app may still be on the welcome screen`,
      }
    )
    .toBe(true);

  const pimsTab = tab as Page;
  await pimsTab.waitForLoadState('domcontentloaded');
  return { shell, tab: pimsTab };
};
