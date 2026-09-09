import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { Option } from '@/app/features/companions/types/companion';
import TaskAssigneeSelect from './TaskAssigneeSelect';

const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';
const TOM = 'practitioner-tom';
const MARTA = 'parent-marta';
const SKY = 'parent-sky';

const TEAM_OPTIONS: Option[] = [
  { label: 'Dr. Elena Marsh', value: ELENA },
  { label: 'Dr. Ravi Patel', value: RAVI },
  { label: 'Tom Reyes', value: TOM },
];

const PARENT_OPTIONS: Option[] = [
  { label: 'Marta Alvarez', value: MARTA },
  { label: 'Sky Doe', value: SKY },
];

/** A hospital-sized staff list, to prove the point the chip row could not make. */
const HUNDRED_STAFF: Option[] = Array.from({ length: 100 }, (_, i) => ({
  label: `Staff Member ${i + 1}`,
  value: `staff-${i + 1}`,
}));

const meta = {
  title: 'Tasks/TaskAssigneeSelect',
  component: TaskAssigneeSelect,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Assign to" control in the New task dialog: one searchable dropdown, staff and pet ' +
          'parents grouped under their own headers. It replaced a row of individually-rendered ' +
          'chips - one pill per person, all on screen at once, with nothing but an avatar shape ' +
          'telling a staff pill from a pet-parent pill apart. That degrades badly: a hospital with ' +
          'a hundred staff rendered a hundred unsearchable pills. This control scales the same way ' +
          'regardless of list size, because only the open panel ever holds more than one row.\n\n' +
          'It sets two fields from one control: picking a pet-parent row flips `audience` to ' +
          '`PARENT_TASK` as well as `assignedTo`. `assignedTo` alone cannot tell a staff id from a ' +
          'pet-parent id apart when the two happen to collide, so every read pairs it with ' +
          '`audience` - the same rule the chip row it replaced used.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    teamOptions: TEAM_OPTIONS,
    parentOptions: PARENT_OPTIONS,
    audience: 'EMPLOYEE_TASK',
    assignedTo: '',
    onSelectTeam: fn(),
    onSelectParent: fn(),
  },
  decorators: [
    (Story) => (
      // 628px is the New task dialog's content box: an `md` centered Modal (680px)
      // less its 26px horizontal insets.
      <div className="w-[628px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TaskAssigneeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {
  name: 'Nothing chosen yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Assign to')).toBeInTheDocument();
    const trigger = canvas.getByRole('button', { name: 'Assign to' });
    await expect(trigger).toHaveTextContent('Select staff or pet parent');

    await userEvent.click(trigger);
    const listbox = canvas.getByRole('listbox');
    // Both group headers, five rows total, nothing pre-selected.
    await expect(within(listbox).getByText('Staff')).toBeInTheDocument();
    await expect(within(listbox).getByText('Pet parents')).toBeInTheDocument();
    await expect(within(listbox).getAllByRole('option')).toHaveLength(5);
    for (const option of within(listbox).getAllByRole('option')) {
      await expect(option).toHaveAttribute('aria-selected', 'false');
    }
  },
};

export const TeamMemberSelected: Story = {
  name: 'A team member chosen',
  args: { audience: 'EMPLOYEE_TASK', assignedTo: RAVI },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /Assign to: Dr\. Ravi Patel/ });
    await expect(trigger).toHaveTextContent('Dr. Ravi Patel');

    await userEvent.click(trigger);
    const selected = canvas.getByRole('option', { name: 'Dr. Ravi Patel' });
    await expect(selected).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('option', { name: 'Dr. Elena Marsh' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  },
};

export const PetParentSelected: Story = {
  name: 'A pet parent chosen',
  args: { audience: 'PARENT_TASK', assignedTo: MARTA },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The trigger's accessible name says "pet parent" even though the row
    // itself does not repeat it - the group header already carries that.
    await expect(
      canvas.getByRole('button', { name: /Assign to: Marta Alvarez \(pet parent\)/ })
    ).toHaveTextContent('Marta Alvarez');
  },
};

export const Searching: Story = {
  name: 'Search narrows both groups at once',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Assign to' }));
    await userEvent.type(canvas.getByLabelText('Search staff or pet parents'), 'ra');

    const listbox = canvas.getByRole('listbox');
    // "Ravi" and "Marta" both match; "Elena", "Tom" and "Sky" fall out of both groups.
    await waitFor(async () => {
      await expect(within(listbox).getByText('Dr. Ravi Patel')).toBeInTheDocument();
      await expect(within(listbox).getByText('Marta Alvarez')).toBeInTheDocument();
      await expect(within(listbox).queryByText('Dr. Elena Marsh')).not.toBeInTheDocument();
      await expect(within(listbox).queryByText('Sky Doe')).not.toBeInTheDocument();
    });
  },
};

export const NoMatches: Story = {
  name: 'Search matches nobody',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Assign to' }));
    await userEvent.type(canvas.getByLabelText('Search staff or pet parents'), 'zzz');
    await waitFor(async () => {
      await expect(canvas.getByText('No matches found')).toBeInTheDocument();
    });
  },
};

export const Choosing: Story = {
  name: 'Picking a row calls back and closes',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Assign to' }));
    await userEvent.click(canvas.getByText('Tom Reyes'));

    await expect(args.onSelectTeam).toHaveBeenCalledWith({ label: 'Tom Reyes', value: TOM });
    await expect(args.onSelectParent).not.toHaveBeenCalled();
    // The control is fully controlled - args are frozen, so the panel closed
    // but the trigger still reads the unchanged prop, exactly like a caller
    // that forgot to echo the selection back into form state.
    await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();
  },
};

export const NoAssignees: Story = {
  name: 'No assignees available yet',
  args: { teamOptions: [], parentOptions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No assignees available yet.')).toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.getByText('Assign to')).toBeInTheDocument();
  },
};

export const ErrorAfterCreate: Story = {
  name: 'Error after Create with nothing chosen',
  args: { error: 'Please select a companion or staff' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const error = canvas.getByText('Please select a companion or staff');
    await expect(error).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Assign to' })).toHaveAttribute(
      'aria-describedby',
      error.id
    );
  },
};

export const HundredStaff: Story = {
  name: 'A hospital with 100 staff',
  args: { teamOptions: HUNDRED_STAFF, parentOptions: PARENT_OPTIONS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Assign to' }));
    // One trigger, one scrollable panel - never 102 pills on screen at once.
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await userEvent.type(canvas.getByLabelText('Search staff or pet parents'), 'Staff Member 47');
    const listbox = canvas.getByRole('listbox');
    await waitFor(async () => {
      await expect(within(listbox).getAllByRole('option')).toHaveLength(1);
      await expect(within(listbox).getByText('Staff Member 47')).toBeInTheDocument();
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The case the chip row could not handle at all: a hundred staff plus pet parents ' +
          'searches down to one match instead of rendering a hundred unsearchable pills.',
      },
    },
  },
};
