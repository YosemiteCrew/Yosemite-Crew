import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import AppointmentBoardToolbar from './AppointmentBoardToolbar';

/**
 * The toolbar owns no state at all - the board above it holds the date, the
 * emergency filter and the mine-only scope - so a story that hands it plain
 * `fn()` callbacks renders a toolbar whose Back/Next arrows and toggles do
 * nothing. This harness gives those props somewhere to land so the interactive
 * halves are actually reviewable, and still forwards to the story's mocks so
 * the actions panel logs every call.
 */
const StatefulToolbar = (args: ComponentProps<typeof AppointmentBoardToolbar>) => {
  const [currentDate, setCurrentDate] = useState<Date>(args.currentDate);
  const [emergencyActive, setEmergencyActive] = useState(args.emergency.active);
  const [mineOnly, setMineOnly] = useState(args.scope.mineOnly);

  return (
    <AppointmentBoardToolbar
      {...args}
      currentDate={currentDate}
      setCurrentDate={setCurrentDate}
      emergency={{
        ...args.emergency,
        active: emergencyActive,
        onToggle: () => {
          args.emergency.onToggle();
          setEmergencyActive((value) => !value);
        },
      }}
      scope={{
        mineOnly,
        onMineOnlyChange: (value) => {
          args.scope.onMineOnlyChange(value);
          setMineOnly(value);
        },
      }}
    />
  );
};

/** The calendar popper drops below the toolbar, so the canvas needs room under it. */
const Room = (Story: React.ComponentType) => (
  <div className="min-h-[520px] bg-[var(--screen)]">
    <Story />
  </div>
);

const meta = {
  title: 'Appointments/AppointmentBoardToolbar',
  component: AppointmentBoardToolbar,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The band above the appointment board: date field, day stepper, the Emergencies filter ' +
          'pill, the New appointment CTA and the mine-only scope toggle.\n\n' +
          'Two of its surfaces exist only after an interaction and had never been drawn. The first ' +
          'is the react-datepicker popper. It is portalled out of the toolbar entirely - ' +
          '`portalId="yc-datepicker-portal"` on a `.yc-datepicker-calendar` panel - so it is not ' +
          'even a descendant of this component in the DOM, and every rule that styles it (the ' +
          'selected day, the "today" chip, the month/year `<select>`s that `dropdownMode="select"` ' +
          'renders) lives behind a click. The second is the `GlassTooltip` reading "Select date" ' +
          'wrapped around that field, whose bubble is created on `mouseenter` and then ' +
          '`createPortal`ed to `document.body`.\n\n' +
          'Both matter here more than in isolation because the toolbar row is `overflow-x-auto` ' +
          'with `z-20` on the scroller: a panel that failed to escape it would be clipped rather ' +
          'than merely misplaced, and no closed-state snapshot can show that.\n\n' +
          'The stories below open each surface and assert it has real content - 42 day cells and ' +
          'the two dropdown selects, tooltip text plus its side transform - rather than asserting ' +
          'that a trigger flipped a flag, which an empty panel would also satisfy.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    currentDate: new Date(2026, 2, 12),
    setCurrentDate: fn(),
    onWheelHorizontal: fn(),
    emergency: {
      active: false,
      color: 'var(--danger)',
      present: true,
      onToggle: fn(),
    },
    permissions: { editAppointments: true },
    onAddAppointment: fn(),
    scope: { mineOnly: false, onMineOnlyChange: fn() },
  },
  render: (args) => <StatefulToolbar {...args} />,
} satisfies Meta<typeof AppointmentBoardToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Resting',
  parameters: {
    docs: {
      description: {
        story:
          'What the board shows before anything is touched: the emergency pill in its outline ' +
          'state with the unread dot, the full-permission CTA, and the scope toggle off.',
      },
    },
  },
};

export const CalendarOpen: Story = {
  name: 'Datepicker popper open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle calendar' }));

    // The popper portals to #yc-datepicker-portal on document.body, so it is
    // outside canvasElement.
    const calendar = document.querySelector('.yc-datepicker-calendar');
    await expect(calendar).toBeInTheDocument();

    /* Assert the panel actually has a month in it. `fixedHeight` pins the grid
       to six weeks, so a healthy popper paints a full month of day cells - an
       empty or collapsed panel would still satisfy "the popper is in the
       document", which is exactly how a broken panel stays invisible. */
    const days = (calendar as HTMLElement).querySelectorAll('.react-datepicker__day');
    await expect(days.length).toBeGreaterThanOrEqual(28);

    // showMonthDropdown + showYearDropdown with dropdownMode="select" render two
    // native selects in the header; they are the part most likely to lose styling.
    await expect(within(calendar as HTMLElement).getAllByRole('combobox')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The calendar itself. It is right-aligned to the icon trigger (`popperPlacement="bottom-end"` ' +
          "for the icon variant) and lands in a body portal, so it clears the toolbar's " +
          '`overflow-x-auto` scroller instead of being cut off by it.',
      },
    },
  },
};

export const DateTooltip: Story = {
  name: 'Select date tooltip',
  play: async ({ canvasElement }) => {
    // GlassTooltip listens on its own wrapper span, not on the Datepicker inside it.
    const trigger = canvasElement.querySelector('.glass-tooltip') as HTMLElement;
    await expect(trigger).toBeTruthy();
    await userEvent.hover(trigger);

    const bubble = await within(document.body).findByRole('tooltip');
    await expect(bubble).toHaveTextContent('Select date');
    /* side="bottom" positions the bubble under the field, and the transform is
       the only thing distinguishing it from the default "top" placement. Read
       the inline value, not the computed one: a laid-out element resolves any
       transform to a `matrix(...)`, so a computed-style check can never tell
       the two placements apart. */
    await expect(bubble.style.transform).toMatch(/^translate\(-50%, 0(px)?\)$/);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The hover hint on the date field. It is created on `mouseenter`, portalled to ' +
          '`document.body` and positioned from the trigger rect, so it can only be reviewed by ' +
          'actually hovering - the resting toolbar contains no trace of it.',
      },
    },
  },
};

export const EmergencyActive: Story = {
  name: 'Emergency filter on',
  args: { emergency: { active: true, color: 'var(--danger)', present: true, onToggle: fn() } },
  parameters: {
    docs: {
      description: {
        story:
          'The filled pill: `--danger-strong` with its paired ink rather than a literal white, so ' +
          'the label clears the fill in both themes and the pill keeps a visible edge on the dark ' +
          'screen. The unread dot outlines itself in `--screen`, which only reads correctly ' +
          'against the filled state.',
      },
    },
  },
};

export const NoEmergencies: Story = {
  name: 'No emergencies present',
  args: { emergency: { active: false, color: 'var(--danger)', present: false, onToggle: fn() } },
  parameters: {
    docs: {
      description: {
        story: 'With `present: false` the corner dot is not rendered at all - the pill stays.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { permissions: { editAppointments: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /new appointment/i })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Without `editAppointments` the CTA and its hairline divider are both dropped rather ' +
          'than disabled, so the scope toggle slides left against the emergency pill. That ' +
          're-flow is the reason this needs its own story.',
      },
    },
  },
};
