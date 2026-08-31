import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import HistoryEmptyState from './HistoryEmptyState';

/** The copy the component falls back to when `isError` arrives without a message. */
const DEFAULT_ERROR_COPY = 'Unable to load overview right now.';
const SERVICE_ERROR_COPY = 'We could not reach the records service. Try again in a moment.';
const NOTICE_COPY = 'No diagnostics in the selected date range.';
/** The headline of the rich records empty state this component delegates to. */
const RECORDS_HEADLINE = 'No records yet';

const meta = {
  title: 'Companions/HistoryEmptyState',
  component: HistoryEmptyState,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The placeholder under a companion history timeline. Two optional props select between ' +
          'three completely different renders, and the split is easy to get wrong from the code ' +
          'alone.\n\n' +
          'With neither prop set the component is not a notice box at all - it delegates to ' +
          "`CompanionRecordsEmptyState`, the design's rich empty state (64px blue-soft folder " +
          'chip, Newsreader headline, muted supporting copy). Set either prop and that whole ' +
          'render is replaced by the compact bordered box.\n\n' +
          'Inside the box, `isError` decides two things that no reader can see in a screenshot: ' +
          'whether the container carries `role="alert"`, and whether the line is inked with ' +
          '`text-text-error` or `text-text-primary`. A notice announced as an alert interrupts a ' +
          'screen reader for something that is not a failure; an error rendered in the primary ' +
          'ink reads as ordinary copy. The two branches are otherwise identical markup, so the ' +
          'colour and the role are the only things worth pinning.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HistoryEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Nothing recorded yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(RECORDS_HEADLINE)).toBeInTheDocument();
    /* The two props are a gate, not a decoration: with neither set the notice box
       must not render at all, so there is no alert and no fallback copy hiding
       under the illustration. */
    await expect(canvas.queryByRole('alert')).toBeNull();
    await expect(canvas.queryByText(DEFAULT_ERROR_COPY)).toBeNull();
  },
};

export const LoadFailed: Story = {
  name: 'Overview request failed',
  args: { isError: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent(DEFAULT_ERROR_COPY);
    /* An error REPLACES the rich empty state rather than stacking under it. If the
       guard ever loosened, the screen would claim there is nothing to show and
       that loading failed at the same time. */
    await expect(canvas.queryByText(RECORDS_HEADLINE)).toBeNull();
  },
};

export const LoadFailedWithReason: Story = {
  name: 'Failure with a caller message',
  args: { isError: true, message: SERVICE_ERROR_COPY },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent(SERVICE_ERROR_COPY);
    // `message || default` - the caller's reason wins outright, it is not appended.
    await expect(alert).not.toHaveTextContent(DEFAULT_ERROR_COPY);
  },
};

export const Notice: Story = {
  name: 'Caller notice (not an error)',
  args: { message: NOTICE_COPY },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(NOTICE_COPY)).toBeInTheDocument();
    /* `role` is set only under `isError`. A filter notice announced as an alert
       would interrupt a screen reader every time the user narrowed the range. */
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

export const ErrorVersusNotice: Story = {
  name: 'The two notice tones together',
  render: () => (
    <div className="flex flex-col gap-3">
      <HistoryEmptyState isError message={SERVICE_ERROR_COPY} />
      <HistoryEmptyState message={NOTICE_COPY} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const errorInk = globalThis.getComputedStyle(canvas.getByText(SERVICE_ERROR_COPY)).color;
    const noticeInk = globalThis.getComputedStyle(canvas.getByText(NOTICE_COPY)).color;
    /* The only visual difference between the branches is this one token. If
       `text-text-error` ever resolves to nothing - a real failure mode here, the
       utility is theme-token based - both lines silently take the same ink and
       the box stops reading as a failure. Comparing them catches that; asserting
       a hex would only pin today's palette. */
    await expect(errorInk).not.toBe(noticeInk);
    await expect(errorInk).not.toBe('rgba(0, 0, 0, 0)');
    // Exactly one of the two boxes is announced.
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
  },
};
