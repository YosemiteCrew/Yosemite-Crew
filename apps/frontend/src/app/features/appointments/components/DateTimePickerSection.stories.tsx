import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { Slot } from '@/app/features/appointments/types/appointments';
import DateTimePickerSection from './DateTimePickerSection';

const SELECTED_DATE = new Date('2026-03-12T00:00:00');

const TIME_SLOTS: Slot[] = [
  { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1'] },
  { startTime: '09:30', endTime: '10:00', vetIds: ['vet-1', 'vet-2'] },
  { startTime: '10:00', endTime: '10:30', vetIds: ['vet-2'] },
  { startTime: '10:30', endTime: '11:00', vetIds: ['vet-1'] },
];

const LEAD_OPTIONS = [
  { label: 'Dr. Lena Hartmann', value: 'vet-1' },
  { label: 'Dr. Ravi Chandrasekaran', value: 'vet-2' },
  { label: 'Dr. Amara Osei', value: 'vet-3' },
];

const TEAM_OPTIONS = [
  { label: 'Nurse Priya Raman', value: 'staff-1' },
  { label: 'Nurse Tom Aldridge', value: 'staff-2' },
  { label: 'Tech Marisol Vega', value: 'staff-3' },
  { label: 'Tech Jonas Berg', value: 'staff-4' },
];

type SectionProps = ComponentProps<typeof DateTimePickerSection>;

type HarnessProps = Omit<
  SectionProps,
  'selectedDate' | 'setSelectedDate' | 'selectedSlot' | 'setSelectedSlot' | 'supportStaffIds'
> & {
  initialDate?: Date;
  initialSlot?: Slot | null;
  initialSupportStaff?: string[];
};

/**
 * The section is fully controlled by the appointment modal above it, so the
 * date, the chosen slot and the support-staff selection all have to live
 * somewhere for the panels to be openable at all.
 */
const DateTimePickerHarness = ({
  initialDate = SELECTED_DATE,
  initialSlot = null,
  initialSupportStaff = [],
  onSupportStaffChange,
  ...rest
}: HarnessProps) => {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(initialSlot);
  const [supportStaffIds, setSupportStaffIds] = useState<string[]>(initialSupportStaff);

  return (
    <DateTimePickerSection
      {...rest}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      selectedSlot={selectedSlot}
      setSelectedSlot={setSelectedSlot}
      supportStaffIds={supportStaffIds}
      onSupportStaffChange={(ids) => {
        setSupportStaffIds(ids);
        onSupportStaffChange?.(ids);
      }}
    />
  );
};

/**
 * Both dropdowns portal their panel to document.body and tag it the same way.
 * The panel renders one frame after the click - it waits on the layout effect
 * that measures the trigger - so this polls rather than reading once.
 */
const findPortalPanel = async (): Promise<HTMLElement> => {
  await waitFor(() => expect(document.querySelector('[data-portal-dropdown]')).toBeInTheDocument());
  return document.querySelector('[data-portal-dropdown]') as HTMLElement;
};

const meta = {
  title: 'Appointments/DateTimePickerSection',
  component: DateTimePickerHarness,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The scheduling half of the add/edit appointment modal: the horizontal `Slotpicker`, a ' +
          'read-only Date/Time pair in a `grid grid-cols-2 gap-3`, the Lead `LabelDropdown` and ' +
          'the support-staff `MultiSelectDropdown`.\n\n' +
          'Both dropdowns hide their entire panel behind a click **and** behind a portal. ' +
          '`useDropdownPositioning` measures the trigger and writes ' +
          '`position: absolute; left: rect.left + scrollX; top: rect.bottom + scrollY; ' +
          'width: rect.width; zIndex: 5000` onto a list `createPortal`ed to `document.body`. The ' +
          "panel is therefore not a descendant of this section at all - it is not in the story's " +
          'canvas element, and no snapshot of the closed section contains a single one of its ' +
          'rows. The height is measured too: `maxHeight` is clamped to the space below the ' +
          'trigger, between 72px and 200px, so the same list scrolls or does not depending purely ' +
          'on where the modal sits on screen.\n\n' +
          'The two panels are also visually unrelated, which is only apparent side by side. Lead ' +
          'renders a detached `rounded-[13px]` card 4px below the trigger with `p-1.5` and ' +
          '`rounded-[8px]` 12.5px/600 rows on `--nav-active-bg`. Support renders a *connected* ' +
          'panel: the trigger loses its bottom border and its bottom radius ' +
          '(`border-b-0 rounded-t-[12px]`) while the panel takes `rounded-b-[12px]` and a ' +
          '`--blue` border, so trigger and list read as one control. A change to either radius ' +
          'or border on its own splits the seam, and nothing but an open panel shows it.\n\n' +
          'Two further states replace whole subtrees rather than restyling them: `isLoadingSlot` ' +
          'swaps both the Time field and the entire Lead dropdown for `min-h-12` pulse ' +
          'skeletons, and `hideDateSlotPicker` drops the `Slotpicker` so the section starts at ' +
          'the Date/Time row.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    timeSlots: TIME_SLOTS,
    leadOptions: LEAD_OPTIONS,
    teamOptions: TEAM_OPTIONS,
    onLeadSelect: fn(),
    onSupportStaffChange: fn(),
    showSupportStaff: true,
    hideDateSlotPicker: false,
    isLoadingSlot: false,
  },
} satisfies Meta<typeof DateTimePickerHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Resting',
  parameters: {
    docs: {
      description: {
        story:
          'Slot strip, the read-only Date/Time pair, and both dropdowns closed. The Date and Time ' +
          'inputs are `readonly` with `tabIndex={-1}` and blur themselves on focus - they are ' +
          'display surfaces for the picker above, never typed into.',
      },
    },
  },
};

export const LeadPanelOpen: Story = {
  name: 'Lead panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Lead' }));
    const panel = await findPortalPanel();
    // Assert the panel really mounted its three clinicians. `aria-expanded` on
    // the trigger flips whether or not the list rendered anything.
    await expect(within(panel).getAllByRole('button')).toHaveLength(3);
    await expect(within(panel).getByText('Dr. Ravi Chandrasekaran')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The portalled listbox, detached 4px below a trigger whose border turns `--blue` with a ' +
          '3px `--glow-b10` ring. Opening it also swaps the trigger content: the selected label is ' +
          'replaced by a search input (`aria-label="Search Lead"`), so the resting and open ' +
          'triggers are different DOM.',
      },
    },
  },
};

export const LeadSelected: Story = {
  name: 'Lead panel open (one selected)',
  args: { leadId: 'vet-2' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Lead: Dr. Ravi Chandrasekaran' }));
    const panel = await findPortalPanel();
    await expect(within(panel).getAllByRole('button')).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'With a lead resolved, the active row takes the `--nav-active-bg` wash and ' +
          '`--nav-active` ink. That is the only difference between the selected row and its ' +
          'neighbours - there is no check mark here, unlike the multi-select panel below.',
      },
    },
  },
};

export const SupportPanelOpen: Story = {
  name: 'Support panel open',
  args: { initialSupportStaff: ['staff-1', 'staff-3'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Support: Nurse Priya Raman, Tech Marisol Vega',
    });
    await userEvent.click(trigger);
    const panel = await findPortalPanel();
    const rows = within(panel).getAllByRole('button');
    await expect(rows).toHaveLength(4);
    // The selected rows are marked with aria-pressed plus a trailing check. An
    // empty or unmarked panel would still satisfy the trigger's aria-expanded.
    await expect(rows.filter((row) => row.getAttribute('aria-pressed') === 'true')).toHaveLength(2);
    // The seam: while open the trigger drops its bottom border so it joins the panel.
    await expect(trigger.className).toContain('border-b-0!');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Four staff, two already chosen, each selected row carrying an `IoCheckmarkOutline` in ' +
          '`--text-brand`. The trigger collapses its selection to a comma-joined `truncate` label, ' +
          'so the full list only exists in the accessible name and in this panel.',
      },
    },
  },
};

export const LoadingSlots: Story = {
  name: 'Loading slots',
  args: { isLoadingSlot: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Not a dimmed dropdown - the whole Lead control is unmounted and replaced.
    await expect(canvas.queryByRole('button', { name: 'Lead' })).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText('Time')).not.toBeInTheDocument();
    // The Date field is deliberately NOT skeletonised, so the grid stays half real.
    await expect(canvas.getByLabelText('Date')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'While availability is in flight the Time field and the Lead dropdown become ' +
          '`min-h-12 rounded-xl bg-neutral-100 animate-pulse` blocks, but the Date field and the ' +
          'support dropdown stay live. The asymmetric result - a 44px real field beside a 48px ' +
          'skeleton in the same two-column grid - is the thing to look at here.',
      },
    },
  },
};

export const SlotError: Story = {
  name: 'Slot error',
  args: { slotError: 'Pick a time slot to continue', leadError: 'Assign a lead clinician' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Pick a time slot to continue')).toBeInTheDocument();
    await expect(canvas.getByText('Assign a lead clinician')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both error lines at once. They sit *below* their fields inside the same flex column, so ' +
          'they push the Lead dropdown and the support dropdown down - the Time error only ' +
          'reserves `min-h-6`, the Lead error does not, and the two rows end up at different ' +
          'heights.',
      },
    },
  },
};

export const WithoutSlotPicker: Story = {
  name: 'Reschedule (picker hidden)',
  args: { hideDateSlotPicker: true, showSupportStaff: false, initialSlot: TIME_SLOTS[1] },
  parameters: {
    docs: {
      description: {
        story:
          'The variant used where the date is already fixed by the caller: no `Slotpicker`, no ' +
          'support dropdown, just the read-only pair and the lead. A third of the section is ' +
          'gone, and the remaining fields keep their own `gap-3` rather than re-flowing.',
      },
    },
  },
};
