import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { ReactNode } from 'react';

import DropPreviewOverlay from './DropPreviewOverlay';

/**
 * The overlay is `absolute` inside the hour cell it lands in, so it needs a
 * positioned box of exactly one hour's height to be readable at all. 180px is
 * the real zoom-in row height (`getHourRowHeightPx('in')`); the hairline at 50%
 * is the half-hour rule the ghost is meant to be read against.
 */
const HourCell = ({ height, children }: Readonly<{ height: number; children: ReactNode }>) => (
  <div
    className="relative w-[260px] rounded-md border border-card-border bg-neutral-0"
    style={{ height: `${height}px` }}
  >
    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-card-border" />
    {children}
  </div>
);

const meta = {
  title: 'Appointments/Calendar/DropPreviewOverlay',
  component: DropPreviewOverlay,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The dashed ghost that shows where a dragged appointment will land. `Slot` renders it ' +
          'only while `draggedAppointmentId` is set **and** `dropPreviewMinute` is non-null, so it ' +
          'exists for the duration of a pointer drag and never afterwards. No snapshot, unit test ' +
          'or story had ever contained it: the two states it has to be correct in - a ghost that ' +
          'fits inside its hour and a ghost the hour has to clamp - only appear mid-gesture.\n\n' +
          'Its whole appearance is two computed inline pixel values, which is exactly the shape of ' +
          'defect that ships silently. `top` is `((dropPreviewMinute % 60) / 60) * height`, so the ' +
          'minute is read modulo the hour and a 09:45 drop sits three quarters down its own cell. ' +
          '`height` is clamped twice: the duration is floored at 5 minutes and ceilinged at ' +
          '`60 - (dropPreviewMinute % 60)` - the minutes left in this hour - and then the resulting ' +
          'pixel height is floored at 14px so a very short or very late drop is still a visible ' +
          'band rather than a hairline.\n\n' +
          'The stories drive it at the real row heights the calendar uses: 180px per hour zoomed in ' +
          'and 34px zoomed out (`getHourRowHeightPx`). At 34px the 14px floor is doing most of the ' +
          'work, which is only visible with both drawn side by side.\n\n' +
          'The label falls back to the string `Appointment` when ' +
          '`draggedAppointmentLabel` is null or empty, and the text is `truncate` inside a ' +
          '`px-2` centred row, so a long companion name clips rather than widening the ghost.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    dropPreviewMinute: 540,
    height: 180,
    draggedAppointmentDurationMinutes: 30,
    draggedAppointmentLabel: 'Poppy - Vaccination',
  },
  decorators: [
    (Story, context) => (
      <HourCell height={context.args.height}>
        <Story />
      </HourCell>
    ),
  ],
} satisfies Meta<typeof DropPreviewOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTheHour: Story = {
  name: 'Landing on the hour (09:00, 30 min)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Assert the ghost actually carries its label, not merely that a box exists -
    // an empty overlay would still satisfy a "did it render" check.
    const label = canvas.getByText('Poppy - Vaccination');
    await expect(label).toBeInTheDocument();
    const ghost = label.parentElement as HTMLElement;
    // 540 % 60 === 0, so it sits flush at the top of its own hour cell.
    await expect(ghost).toHaveStyle({ top: '0px' });
    // 30 of 60 minutes at a 180px hour row.
    await expect(ghost).toHaveStyle({ height: '90px' });
  },
  parameters: {
    docs: {
      description: {
        story:
          'A half-hour appointment dropped exactly on 09:00: `top` resolves to 0 and the band takes ' +
          'half the 180px row.',
      },
    },
  },
};

export const MidHour: Story = {
  name: 'Landing mid-hour (09:45, clamped)',
  args: { dropPreviewMinute: 585, draggedAppointmentDurationMinutes: 45 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ghost = canvas.getByText('Poppy - Vaccination').parentElement as HTMLElement;
    // 585 % 60 === 45, so three quarters down a 180px row.
    await expect(ghost).toHaveStyle({ top: '135px' });
    // Only 15 minutes remain in the hour, so a 45-minute drag is clamped to them.
    await expect(ghost).toHaveStyle({ height: '45px' });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The clamp branch. A 45-minute appointment dropped at :45 has only 15 minutes of its own ' +
          'hour left, so `Math.min(duration, 60 - minute % 60)` truncates the ghost at the cell ' +
          'boundary instead of letting it bleed into the hour below - the overflow bug this drawing ' +
          'exists to catch.',
      },
    },
  },
};

export const ZoomedOut: Story = {
  name: 'Zoomed out (34px hour row)',
  args: { height: 34, dropPreviewMinute: 570, draggedAppointmentDurationMinutes: 15 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ghost = canvas.getByText('Poppy - Vaccination').parentElement as HTMLElement;
    // 15 of 60 minutes at 34px would be 8.5px, so the 14px floor takes over.
    await expect(ghost).toHaveStyle({ height: '14px' });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same drag in the zoomed-out calendar, where an hour is 34px. The proportional height ' +
          'would be 8.5px, so `Math.max(14, ...)` floors it - the ghost is deliberately taller than ' +
          'its true duration here, and it is the only state where the two disagree.',
      },
    },
  },
};

export const NoLabel: Story = {
  name: 'No label (fallback text)',
  args: { draggedAppointmentLabel: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Appointment')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A drag that carries no label falls back to the literal word "Appointment" rather than ' +
          'rendering an empty dashed box the reader cannot identify.',
      },
    },
  },
};

export const LongLabel: Story = {
  name: 'Long label (truncates)',
  args: {
    draggedAppointmentLabel: 'Bartholomew Wigglesworth III - Post-operative recheck and bandage',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The label row is `truncate` inside `px-2`, so a long name clips at the ghost edge. The ' +
          'ghost is sized by the drag, never by its text.',
      },
    },
  },
};
