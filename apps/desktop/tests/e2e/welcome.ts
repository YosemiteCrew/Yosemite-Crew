import { expect, type ElectronApplication, type Page } from '@playwright/test';

// Drive the app out of its welcome screen and hand back the page showing PIMS.
//
// These specs were written when launching the app navigated straight to
// YC_DESKTOP_START_URL, so every one of them took `app.firstWindow()` to be the
// PIMS page. The app now boots into its own bundled welcome screen
// (src/pages/welcome.html), and firstWindow() is that screen instead. Nothing
// errored; the specs simply asserted against the wrong document, and every one
// of them failed on
//
//   strict mode violation: getByRole('heading', { name: 'Sign In' })
//     resolved to 2 elements:
//       1) <h1>Sign in to Yosemite Crew</h1>
//       2) <h3>Sign in once</h3>
//
// which are welcome.html's own headings, matched because getByRole's `name`
// option is a case-insensitive substring match by default. The offline-cache
// specs failed the same way, as 30s timeouts, because content that never loads
// is never cached.
//
// The transition is the one the welcome screen's own button performs: the
// preload exposes startSignin(), which invokes yc:start-signin, which calls
// enterTabMode(config.startUrl) when the app is not already in tab mode. Using
// that path rather than clicking #signin keeps the helper independent of the
// welcome screen's markup, which is presentational and will keep changing.
export const openPimsTab = async (
  app: ElectronApplication,
  pimsOrigin: string,
  timeout = 20_000
): Promise<Page> => {
  const welcome = await app.firstWindow();
  await welcome.waitForLoadState('domcontentloaded');

  await welcome.evaluate(async () => {
    const yc = (globalThis as Record<string, unknown>).ycDesktop as
      { startSignin?: () => Promise<unknown> } | undefined;
    if (!yc?.startSignin) throw new Error('preload did not expose ycDesktop.startSignin');
    await yc.startSignin();
  });

  // Tabs are WebContentsView instances rather than BrowserWindows, so poll the
  // window list for the one that ended up at the test server rather than
  // waiting on a 'window' event that a view may never emit.
  let tab: Page | undefined;
  await expect
    .poll(
      () => {
        tab = app.windows().find((candidate) => candidate.url().startsWith(pimsOrigin));
        return Boolean(tab);
      },
      {
        timeout,
        message: `no window reached ${pimsOrigin} after startSignin; the app may still be on the welcome screen`,
      }
    )
    .toBe(true);

  const pimsPage = tab as Page;
  await pimsPage.waitForLoadState('domcontentloaded');
  return pimsPage;
};
