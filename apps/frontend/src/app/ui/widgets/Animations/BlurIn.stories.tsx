import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import { BlurIn } from './BlurIn';

const meta = {
  title: 'Widgets/Animations/BlurIn heading',
  component: BlurIn,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A marketing `<h2>` that resolves from an 8px blur and zero opacity to sharp and solid ' +
          'over 1.2 seconds, the first time it scrolls into view. It runs once (`useInView` with ' +
          '`once: true`), so a reader who scrolls past and back does not watch it again. The ' +
          'heading is Satoshi bold with tight tracking, stepping from 20px on phones to 60px at ' +
          '`md`, and the children are rendered as given, so an inline `<em>` or a line break ' +
          'travels through untouched. Framer Motion is loaded lazily with `domAnimation`, which ' +
          'keeps the marketing bundle to the subset that handles opacity and filter.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    children: 'Better animal health, together.',
  },
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 760, padding: 24 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof BlurIn>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The 1.2s transition is longer than the default `waitFor` timeout. */
const settled = { timeout: 4000 };

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole('heading', {
      level: 2,
      name: 'Better animal health, together.',
    });
    await waitFor(() => {
      expect(Number.parseFloat(getComputedStyle(heading).opacity)).toBe(1);
      expect(getComputedStyle(heading).filter).toBe('blur(0px)');
    }, settled);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one-line reading. The play function waits for the end state, opacity 1 and a zero ' +
          'blur, rather than trusting that the animation was wired.',
      },
    },
  },
};

export const LongHeadline: Story = {
  name: 'Two-line headline',
  args: {
    children: 'Appointments, records and billing for the whole practice, in one place.',
  },
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole('heading', { level: 2 });
    await expect(heading).toHaveTextContent(
      'Appointments, records and billing for the whole practice, in one place.'
    );
    await waitFor(() => {
      expect(Number.parseFloat(getComputedStyle(heading).opacity)).toBe(1);
    }, settled);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A headline long enough to wrap at the 760px frame. The `md:leading-16` line height is ' +
          'what keeps two lines of 60px type from touching.',
      },
    },
  },
};

export const InlineEmphasis: Story = {
  name: 'With inline emphasis',
  args: {
    children: (
      <>
        Open source, <em className="font-newsreader font-normal italic">for every clinic.</em>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole('heading', { level: 2 });
    await expect(heading.querySelector('em')).toHaveTextContent('for every clinic.');
    await waitFor(() => {
      expect(Number.parseFloat(getComputedStyle(heading).opacity)).toBe(1);
    }, settled);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The italic-word treatment the marketing pages use: a Newsreader `<em>` inside the ' +
          'Satoshi heading. Children pass straight through, so the blur applies to the whole line.',
      },
    },
  },
};
