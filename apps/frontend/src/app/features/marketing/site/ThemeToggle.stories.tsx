import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { THEME_STORAGE_KEY } from '@/app/ui/theme/themeCore';
import { ThemeToggle } from './ThemeToggle';

/**
 * The toggle writes to two places that outlive a story: `<html data-theme>` and the
 * `yc-theme` key in localStorage. The preview decorator re-stamps `data-theme` from the
 * `theme` global on every render, but the STORED choice is not touched by anything - and
 * it is what makes `useThemeLifecycle` stop following the OS - so a click in one story
 * would otherwise decide what the next story is following. Snapshot both, start from a
 * cleared key, put both back on unmount.
 */
const withCleanThemeState = () => {
  const root = globalThis.document.documentElement;
  const previousTheme = root.dataset.theme;
  const previousChoice = globalThis.localStorage.getItem(THEME_STORAGE_KEY);
  globalThis.localStorage.removeItem(THEME_STORAGE_KEY);

  return () => {
    if (previousTheme === undefined) {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = previousTheme;
    }
    if (previousChoice === null) {
      globalThis.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      globalThis.localStorage.setItem(THEME_STORAGE_KEY, previousChoice);
    }
  };
};

const meta = {
  title: 'Marketing/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    layout: 'centered',
    // Marketing surface: without this the preview decorator stamps `data-yc-app` on the
    // wrapper and the faint inks switch to the PIMS-scoped values. This button is drawn
    // against the marketing palette (`--glass-btn`, not `--screen-2`), so it opts out.
    surface: 'marketing',
    docs: {
      description: {
        component:
          "The marketing site's 44px glass theme button - a bigger, blurrier sibling of the PIMS " +
          '`Theme/ThemeToggle`. There is no local state anywhere in it: `<html data-theme>` is the ' +
          'source of truth, `useSyncExternalStore` reads it, and every flip broadcasts ' +
          '`yc-theme-change` so all mounted instances re-read. That matters because the nav mounts ' +
          'two of them at once (the desktop rail and the burger panel), which is what the ' +
          '"One click flips every instance" story below pins down.\n\n' +
          'Pressing it here flips the whole Storybook canvas, exactly as it flips the site - the ' +
          'stories restore both `data-theme` and the stored choice on unmount so that does not ' +
          'leak into the next story.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    style: { control: false },
  },
  beforeEach: withCleanThemeState,
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  name: 'Light - a moon that offers dark',
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    /* The label names the DESTINATION, not the current theme. Getting that round the
       wrong way is invisible in a screenshot and tells a screen-reader user the exact
       opposite of what the button does. */
    await expect(button).toHaveAccessibleName('Switch to dark theme');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    // The tooltip is the short form of the same sentence, not a contradiction of it.
    await expect(button).toHaveAttribute('title', 'Switch to dark');

    /* 44x44 measured, not "width: 44 is in the style object": the button carries a 1px
       border, so this only holds while the global `box-sizing: border-box` reset does.
       44 is the tap-target floor the phone panel relies on. */
    const rect = button.getBoundingClientRect();
    await expect(rect.width).toBe(44);
    await expect(rect.height).toBe(44);

    /* The glyph is decorative. If it ever loses `aria-hidden` the accessible name stops
       being the label alone, and both assertions above start passing for the wrong
       reason. */
    await expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const Dark: Story = {
  name: 'Dark - a sun that offers light',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    /* `aria-pressed` is the only machine-readable statement of which theme is live -
       the icon swap says nothing to a screen reader - so it is the assertion that
       catches the branch being inverted. */
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button).toHaveAccessibleName('Switch to light theme');
    await expect(button).toHaveAttribute('title', 'Switch to light');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Driven by the toolbar `theme` global rather than by a prop: the preview decorator stamps ' +
          '`data-theme` on `<html>` the way the pre-paint script does at runtime, and the button ' +
          'reads it back. There is no dark prop to pass.',
      },
    },
  },
};

export const NavSized: Story = {
  name: 'Sized down for the nav rail',
  args: { style: { width: 40, height: 40 } },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    const rect = button.getBoundingClientRect();

    /* The override wins on size... */
    await expect(rect.width).toBe(40);
    await expect(rect.height).toBe(40);
    /* ...and the base style survives underneath it. Both halves matter: the spread is
       `{ ...toggleStyle, ...style }`, and a reversed spread would silently ignore the
       caller here while still rendering a perfectly plausible round button. */
    await expect(getComputedStyle(button).borderRadius).toBe('9999px');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one override the site actually ships: the desktop nav cluster renders it at 40px and ' +
          'the auth shell at 38px, so the pill can sit level with the links beside it. The burger ' +
          'panel passes nothing and gets the full 44.',
      },
    },
  },
};

export const SyncsAcrossInstances: Story = {
  name: 'One click flips every instance',
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <ThemeToggle style={{ width: 40, height: 40 }} />
      <ThemeToggle />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [rail, panel] = within(canvasElement).getAllByRole('button');
    await expect(rail).toHaveAttribute('aria-pressed', 'false');
    await expect(panel).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(rail);

    await waitFor(() => {
      // The attribute on <html> is the state. Nothing else is.
      expect(globalThis.document.documentElement.dataset.theme).toBe('dark');
      /* Persisted on an explicit press - this is the flag that stops the OS listener
         from overwriting the visitor's choice on the next `prefers-color-scheme`
         change. */
      expect(globalThis.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
      /* The instance nobody touched has to follow, because it re-reads on the
         broadcast rather than holding its own copy. The nav mounts both of these at
         once, so a dropped `yc-theme-change` shows a sun on one and a moon on the
         other with no error anywhere. */
      expect(panel).toHaveAttribute('aria-pressed', 'true');
      expect(panel).toHaveAccessibleName('Switch to light theme');
    });

    await userEvent.click(panel);

    await waitFor(() => {
      /* Straight back. `toggleTheme` re-reads the live theme every time instead of
         inverting a value captured at render, so pressing the OTHER button next is
         not a no-op. */
      expect(globalThis.document.documentElement.dataset.theme).toBe('light');
      expect(rail).toHaveAttribute('aria-pressed', 'false');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two toggles, one truth. This is the shape the site nav renders below 960px, where the ' +
          'rail copy and the panel copy are both mounted, and it is the only story that can catch ' +
          'the subscription being dropped.',
      },
    },
  },
};
