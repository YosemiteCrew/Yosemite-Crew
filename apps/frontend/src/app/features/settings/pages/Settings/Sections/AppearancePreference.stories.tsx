import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { PreferenceGroup } from './PreferenceGroup';
import AppearancePreference from './AppearancePreference';

/**
 * Written out rather than imported from `themeCore`.
 *
 * The key is deliberately un-namespaced and shared with the marketing surface, so a
 * rename is a cross-product break that this story should FAIL on rather than follow
 * silently. Importing the constant would make the story rename itself along with it.
 */
const THEME_KEY = 'yc-theme';

/**
 * Seeds the only two pieces of state this row reads: the stored `yc-theme` choice
 * (which decides Auto vs Light vs Dark) and `data-theme` on `<html>` (which decides
 * what the surface is actually painted as). No fetch, no store, no provider.
 *
 * Both are genuinely global, and `data-theme` is also written by the preview
 * decorator on every render - so the previous values are captured here and put back
 * on unmount, or a story that flips the theme leaves the next one dark.
 */
const seedAppearance = (stored: 'light' | 'dark' | null) => () => {
  const previousStored = globalThis.localStorage.getItem(THEME_KEY);
  const previousAttr = globalThis.document.documentElement.dataset.theme;

  if (stored === null) {
    globalThis.localStorage.removeItem(THEME_KEY);
  } else {
    globalThis.localStorage.setItem(THEME_KEY, stored);
  }

  return () => {
    if (previousStored === null) {
      globalThis.localStorage.removeItem(THEME_KEY);
    } else {
      globalThis.localStorage.setItem(THEME_KEY, previousStored);
    }
    if (previousAttr === undefined) {
      delete globalThis.document.documentElement.dataset.theme;
    } else {
      globalThis.document.documentElement.dataset.theme = previousAttr;
    }
  };
};

/**
 * Resolves a design token to the `rgb(...)` string `getComputedStyle` reports, so the
 * surface assertions compare against `globals.css` rather than against a pasted hex
 * that would be wrong in one of the two themes.
 *
 * Called OUTSIDE any `waitFor`: testing-library retries a `waitFor` callback from a
 * MutationObserver, so a callback that appends and removes a node re-triggers itself
 * forever and wedges the tab instead of failing.
 */
const resolveToken = (token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.display = 'none';
  probe.style.backgroundColor = `var(${token})`;
  globalThis.document.body.append(probe);
  const value = globalThis.getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

/** The card the row actually ships in, so the surface under it is the real one. */
const Row = () => (
  <div className="w-[420px] max-w-full bg-[var(--page)] p-4">
    <PreferenceGroup title="This browser" scope="device">
      <AppearancePreference />
    </PreferenceGroup>
  </div>
);

const pressed = (canvas: ReturnType<typeof within>) =>
  ['Auto', 'Light', 'Dark'].filter(
    (label) => canvas.getByRole('button', { name: label }).getAttribute('aria-pressed') === 'true'
  );

const meta = {
  title: 'Settings/AppearancePreference',
  component: Row,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The Auto / Light / Dark segmented pill, drawn inside the "This browser" card it ' +
          'ships in.\n\n' +
          'Three states, and the third one is not a third stored value. `auto` is the ABSENCE ' +
          'of a stored choice: picking it calls `localStorage.removeItem`, and the row then ' +
          'follows the OS for as long as nothing is stored. Picking Light or Dark writes the ' +
          'literal theme. That is why the stories below assert on storage as well as on the ' +
          'pill - Auto and an explicit Light look identical on a machine set to light, and the ' +
          'only thing separating them is whether the key exists.\n\n' +
          'The key is `yc-theme`, un-namespaced and shared with the marketing site, and it lives ' +
          'in browser storage rather than on the account. That is the whole reason this row sits ' +
          'in its own "This device" card instead of with the profile preferences: it does not ' +
          'follow the user to another machine, and it does not reset for the next person to use ' +
          'the same browser.\n\n' +
          "Worth knowing when reading these in Storybook: the preview's own theme decorator " +
          'stamps `data-theme` from the toolbar global at render time, and this pill writes the ' +
          'same attribute on click. The click wins, because the decorator does not re-run - so ' +
          'the interaction story below really does repaint the surface, and the toolbar switch ' +
          'then disagrees with it until the story reloads.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Row>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FollowingTheSystem: Story = {
  name: 'Auto (nothing stored)',
  beforeEach: seedAppearance(null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exactly one segment is raised, and it is Auto. Asserted as a set rather than
    // three separate checks: a bug that raised two segments would pass all three.
    await expect(pressed(canvas)).toEqual(['Auto']);

    /* The contract that makes Auto work: nothing is written. If a change ever
       persisted the string 'auto' the pill would still read Auto - `readAppearance`
       treats anything that is not 'light'/'dark' as auto - but the marketing site's
       pre-paint script, which only checks that the key EXISTS, would stop following
       the OS. Same pill, silently broken elsewhere. */
    await expect(globalThis.localStorage.getItem(THEME_KEY)).toBeNull();

    // The control is a labelled group, not three loose buttons: without the name a
    // screen reader announces "Auto, button" with nothing saying what it sets.
    await expect(canvas.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
    await expect(canvas.getByText('Appearance')).toBeInTheDocument();
    await expect(canvas.getByText('Light, dark, or follow the system')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The shipped default for anyone who has never touched the setting. The surface here is ' +
          'whatever the OS asked for, and it will change under the user without them doing ' +
          'anything - `useThemeLifecycle` keeps listening to `prefers-color-scheme` for exactly ' +
          'as long as this state holds.',
      },
    },
  },
};

export const ExplicitLight: Story = {
  name: 'Light (explicit)',
  beforeEach: seedAppearance('light'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(pressed(canvas)).toEqual(['Light']);
    await expect(globalThis.localStorage.getItem(THEME_KEY)).toBe('light');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pixel-for-pixel identical to Auto on a machine set to light, which is the point: the ' +
          'difference is that this one has stopped listening to the OS. A user who chose Light ' +
          'here stays light when their laptop flips at sunset.',
      },
    },
  },
};

export const ExplicitDark: Story = {
  name: 'Dark (explicit)',
  beforeEach: seedAppearance('dark'),
  // The stored choice and the preview toolbar have to agree, or the pill reads Dark
  // on a surface the decorator has stamped light - a state the app cannot produce.
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(pressed(canvas)).toEqual(['Dark']);
    await expect(globalThis.localStorage.getItem(THEME_KEY)).toBe('dark');
    await expect(globalThis.document.documentElement.dataset.theme).toBe('dark');

    // The card really is on the espresso surface, not just labelled as such.
    const card = canvasElement.querySelector('section') as HTMLElement;
    await expect(globalThis.getComputedStyle(card).backgroundColor).toBe(resolveToken('--screen'));
  },
};

export const ChoosingDarkThenAuto: Story = {
  name: 'Choosing Dark, then handing control back',
  beforeEach: seedAppearance(null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvasElement.querySelector('section') as HTMLElement;
    const lightSurface = globalThis.getComputedStyle(card).backgroundColor;

    await userEvent.click(canvas.getByRole('button', { name: 'Dark' }));

    /* Polled, not read on the same tick. `[data-yc-app]` carries a 300ms
       background-color transition once `data-theme-ready` is set, so a synchronous
       read here can catch a colour partway between the two themes. */
    await waitFor(() =>
      expect(globalThis.getComputedStyle(card).backgroundColor).not.toBe(lightSurface)
    );
    await expect(globalThis.getComputedStyle(card).backgroundColor).toBe(resolveToken('--screen'));

    // Three things move together on one click, and all three are load-bearing: the
    // attribute paints, the storage persists, and the pill reflects it.
    await expect(globalThis.document.documentElement.dataset.theme).toBe('dark');
    await expect(globalThis.localStorage.getItem(THEME_KEY)).toBe('dark');
    await expect(pressed(canvas)).toEqual(['Dark']);

    await userEvent.click(canvas.getByRole('button', { name: 'Auto' }));

    // Going back to Auto CLEARS the key rather than storing 'auto'. This is the
    // assertion worth having: a version that stored a value would look correct here
    // and quietly pin the theme forever.
    await expect(globalThis.localStorage.getItem(THEME_KEY)).toBeNull();
    await expect(pressed(canvas)).toEqual(['Auto']);

    /* And the surface hands itself back to the OS. Compared against what the runner
       actually prefers rather than against 'light': hard-coding it would make this
       story pass or fail by the machine's appearance setting. */
    const osPrefersDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    await waitFor(() =>
      expect(globalThis.document.documentElement.dataset.theme).toBe(
        osPrefersDark ? 'dark' : 'light'
      )
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The round trip, and the only story here that writes anything. Nothing is saved to the ' +
          'account and no request is made - the whole preference is one `localStorage` key and ' +
          'one attribute on `<html>`, which is also why it applies instantly with no saving ' +
          'indicator while every other row on the Settings page PATCHes a profile.\n\n' +
          'Because the pill writes `data-theme` directly, this story leaves the preview canvas ' +
          'on whichever theme the OS reports, out of step with the toolbar. That is the ' +
          'component behaving correctly, not the story leaking - the seed restores both values ' +
          'when it unmounts.',
      },
    },
  },
};
