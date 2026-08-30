import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import ModalFooter from './ModalFooter';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';

const meta = {
  title: 'Overlays/ModalFooter',
  component: ModalFooter,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The single action bar for every panel: one hairline rule, one set of paddings. Panels ' +
          'previously re-derived this ten different ways and split across two hairline tokens ' +
          '(`card-border` and `--hairline`) for the same rule, so a modal opened next to another ' +
          'showed two different greys for what the design draws once.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    align: {
      control: 'inline-radio',
      options: ['start', 'end', 'stretch'],
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 420,
          maxWidth: '100%',
          padding: 16,
          borderRadius: 18,
          background: 'var(--screen)',
          border: '1px solid var(--hairline)',
        }}
      >
        <p style={{ color: 'var(--ink-body)', fontSize: 13 }}>Panel body sits above the bar.</p>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ModalFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RightAligned: Story = {
  name: 'Default: actions to the right',
  args: {
    children: (
      <>
        <Secondary text="Cancel" />
        <Primary text="Save" />
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cancel = canvas.getByRole('button', { name: 'Cancel' }).getBoundingClientRect();
    const save = canvas.getByRole('button', { name: 'Save' }).getBoundingClientRect();
    // Confirm sits last, nearest the corner the thumb and the eye both end at.
    await expect(save.left).toBeGreaterThan(cancel.left);
    // Neither is stretched in this alignment.
    await expect(save.width).toBeLessThan(200);
  },
};

export const Stretched: Story = {
  name: 'Stretch: a paired Discard / Apply',
  args: {
    align: 'stretch',
    children: (
      <>
        <Secondary text="Discard" />
        <Primary text="Apply" />
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const discard = canvas.getByRole('button', { name: 'Discard' }).getBoundingClientRect();
    const apply = canvas.getByRole('button', { name: 'Apply' }).getBoundingClientRect();
    /* Equal halves, not "roughly wide": `stretch` exists so a two-action bar
       reads as a genuine choice rather than one default and one afterthought.
       2px of tolerance because the two buttons carry different borders, so
       `flex-1` settles a sub-pixel apart. */
    await expect(Math.abs(discard.width - apply.width)).toBeLessThanOrEqual(2);
    // And both are genuinely stretched, not merely equal at their natural size.
    await expect(discard.width).toBeGreaterThan(150);
  },
};

export const StretchedSingle: Story = {
  name: 'Stretch: a lone primary fills the bar',
  args: {
    align: 'stretch',
    children: <Primary text="Send invite" />,
  },
};

export const LeftAligned: Story = {
  name: 'Start: a destructive action kept away from the confirm corner',
  args: {
    align: 'start',
    children: <Secondary text="Delete this record" />,
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one case for `start`: a destructive action deliberately sits at the opposite end ' +
          'from where a confirm button would be, so it is not the thing under the cursor after a ' +
          'panel opens.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the bar keeps its rule and paddings',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    align: 'stretch',
    children: (
      <>
        <Secondary text="Discard" />
        <Primary text="Apply" />
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole('button');
    // Two stretched actions on a 375px screen still clear the touch-target floor.
    for (const button of buttons) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(36);
    }
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
