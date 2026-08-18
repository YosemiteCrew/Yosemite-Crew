import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import SmallAccordionButton from './SmallAccordionButton';

const Rows = () => (
  <div className="flex flex-col gap-2 pt-1">
    {[
      ['Species', 'Canine'],
      ['Breed', 'Beagle'],
      ['Microchip', '985 141 000 123 456'],
    ].map(([label, value]) => (
      <div key={label} className="flex items-baseline justify-between gap-4">
        <span className="text-[12px] text-[var(--ink-muted)]">{label}</span>
        <span className="text-[13px] text-[var(--ink)]">{value}</span>
      </div>
    ))}
  </div>
);

const meta = {
  title: 'Primitives/SmallAccordionButton',
  component: SmallAccordionButton,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A bordered card whose body is behind an `open` state, with an optional action button ' +
          'kept out on the header row.\n\n' +
          'It has seven-plus call sites and a jest test, and had no story at all. Its expanded body ' +
          'is `{open && <div>{children}</div>}`, so the closed card is all Storybook has ever ' +
          'drawn - the padding of the open body, how it sits under the header row, and the chevron ' +
          'at `rotate-0` were unreviewed.\n\n' +
          'The chevron is the state indicator and it is worth knowing which way round it is: ' +
          '`-rotate-90` when closed, `rotate-0` when open, so it points right at rest and down when ' +
          'expanded.\n\n' +
          'One sharp edge for anyone writing more stories against this component: the action ' +
          'button calls `buttonClick(true)` with no guard, so a story that renders it without ' +
          'passing a handler throws on click. Pass `buttonClick` or set `showButton={false}`.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Companion details',
    buttonTitle: 'Edit',
    buttonClick: fn(),
    children: <Rows />,
  },
} satisfies Meta<typeof SmallAccordionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Closed (default)',
};

export const Open: Story = {
  name: 'Expanded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Microchip')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /companion details/i }));
    // Assert the body actually rendered its children, not just that state flipped.
    await expect(await canvas.findByText('Microchip')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story: 'The state no story had drawn: the body under the header row, and the chevron down.',
    },
  },
};

export const DefaultOpen: Story = {
  name: 'Open on mount',
  args: { defaultOpen: true },
  parameters: {
    docs: {
      story:
        '`defaultOpen` seeds the state, so this is the same expanded card without the click - the ' +
        'form callers use when the section should start open.',
    },
  },
};

export const NoActionButton: Story = {
  name: 'Without the action button',
  args: { showButton: false, defaultOpen: true },
  parameters: {
    docs: {
      story:
        'With `showButton` false the header is title-only. The row is `justify-between`, so this is ' +
        'where the title has to hold the left edge on its own.',
    },
  },
};

export const LongTitle: Story = {
  name: 'Long title beside the button',
  args: {
    title: 'Companion details, vaccination history and microchip registration',
    defaultOpen: true,
  },
  parameters: {
    docs: {
      story:
        'The header row has no `min-w-0` or gap between the title button and the action, so a long ' +
        'title runs right up against the Edit button. Drawn here so that is a decision someone can ' +
        'see rather than a surprise at a particular width.',
    },
  },
};
