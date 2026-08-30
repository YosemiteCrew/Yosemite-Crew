import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import SkipLink from './SkipLink';

/**
 * The link is visually hidden until focused, so a story that only screenshots it
 * shows an empty canvas. Every story here drives it with the keyboard instead,
 * which is the only way it is ever used.
 */
const meta = {
  title: 'Layout/SkipLink',
  component: SkipLink,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The first thing in the tab order on every page: a bypass link that jumps a keyboard or ' +
          'screen-reader user past the whole nav to `#main-content`. It is off-screen until it ' +
          'takes focus, then it pulls into view - if it stayed hidden while focused the user ' +
          'would be tabbing to a control they cannot see.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ minHeight: 320, background: 'var(--page)' }}>
        <Story />
        <nav style={{ padding: 16 }}>
          <a href="#a">A nav link the skip link is meant to bypass</a>
        </nav>
        <main id="main-content" style={{ padding: 16 }} tabIndex={-1}>
          <p style={{ color: 'var(--ink-body)' }}>Main content starts here.</p>
        </main>
      </div>
    ),
  ],
} satisfies Meta<typeof SkipLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AtRest: Story = {
  name: 'Unfocused (off screen)',
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Skip to main content' });
    /* Present in the DOM and reachable, not `display: none`. A skip link removed
       from the accessibility tree is worse than none at all, because the page
       then claims a bypass mechanism it does not have. */
    await expect(link).toBeInTheDocument();
    await expect(link).toHaveAttribute('href', '#main-content');
  },
};

export const Focused: Story = {
  name: 'Focused: it pulls into view',
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Skip to main content' });
    const before = link.getBoundingClientRect();

    // Tab rather than `link.focus()`: the reveal is keyed on `:focus-visible`.
    canvasElement.ownerDocument.body.focus();
    await userEvent.tab();
    await expect(link).toHaveFocus();

    /* The whole point: focused, it must be ON screen. Measured rather than
       asserted from a class name, because the failure mode is a stylesheet that
       stopped applying, not a missing class.

       Polled, because the reveal is a 200ms transform transition - read on the
       same tick as the Tab it is still translated -107px and the link looks
       broken when it is only mid-animation. */
    await waitFor(async () => {
      const after = link.getBoundingClientRect();
      await expect(after.top).toBeGreaterThanOrEqual(0);
      await expect(after.left).toBeGreaterThanOrEqual(0);
      await expect(after.top).toBeGreaterThan(before.top);
    });
  },
};

export const FirstInTabOrder: Story = {
  name: 'It is the first thing Tab reaches',
  play: async ({ canvasElement }) => {
    // A bypass link that is not first has nothing to bypass.
    canvasElement.ownerDocument.body.focus();
    await userEvent.tab();
    await expect(
      within(canvasElement).getByRole('link', { name: 'Skip to main content' })
    ).toHaveFocus();
  },
};
