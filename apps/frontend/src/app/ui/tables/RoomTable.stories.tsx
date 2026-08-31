import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { OrganisationRoom } from '@yosemite-crew/types';

import RoomTable from './RoomTable';

const ORG_ID = 'org-room-table-story';

type StoryRoom = OrganisationRoom & {
  occupancyStatus?: 'OCCUPIED' | 'VACANT';
  units?: Array<{ id?: string; name?: string; occupied?: boolean }>;
  unitCount?: number;
};

const room = (
  index: number,
  name: string,
  type: OrganisationRoom['type'],
  overrides: Partial<StoryRoom> = {}
): StoryRoom => ({
  id: `room-${index}`,
  organisationId: ORG_ID,
  name,
  code: `R-${String(index).padStart(2, '0')}`,
  type,
  availableNow: true,
  ...overrides,
});

const ROOMS: StoryRoom[] = [
  room(1, 'Consult 1', 'EXAM_ROOM'),
  room(2, 'Theatre', 'SURGERY', { availableNow: false }),
  room(3, 'Dental suite', 'DENTAL'),
  room(4, 'Ward', 'INPATIENT', {
    units: [
      { id: 'k1', name: 'Kennel 1', occupied: true },
      { id: 'k2', name: 'Kennel 2', occupied: false },
      { id: 'k3', name: 'Kennel 3', occupied: false },
    ],
  }),
  room(5, 'Isolation', 'ISOLATION', { occupancyStatus: 'OCCUPIED' }),
];

const meta = {
  title: 'Tables/RoomTable',
  component: RoomTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The room register. Occupancy is derived rather than stored: a room with units reports ' +
          'how many are free ("Vacant (2)"), a room with an explicit `occupancyStatus` reports ' +
          'that, and a room with neither reports a dash rather than guessing "Vacant" for a room ' +
          'nobody has told the system about. Availability is a real `switch`, so its state is ' +
          'announced rather than carried by the track colour alone.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: ROOMS,
    setActive: fn(),
    setView: fn(),
    onToggleAvailability: fn(),
    canEditRoom: true,
  },
} satisfies Meta<typeof RoomTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Five rooms',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Consult 1').length).toBeGreaterThan(0);
    // Every room offers its availability as a switch, not a checkbox or a pill.
    await expect(canvas.getAllByRole('switch').length).toBeGreaterThan(0);
  },
};

export const DerivedOccupancy: Story = {
  name: 'Occupancy is counted from the units',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Two of the ward's three kennels are free, so the row says how many rather
       than the bare "Vacant" that a room with no units would show. */
    await expect(canvas.getAllByText('Vacant (2)').length).toBeGreaterThan(0);
    // The isolation room states its status outright and is reported verbatim.
    await expect(canvas.getAllByText('Occupied').length).toBeGreaterThan(0);
  },
};

export const UnknownOccupancy: Story = {
  name: 'A room with neither units nor a status',
  args: { filteredList: [room(9, 'Grooming', 'GROOMING')] },
  play: async ({ canvasElement }) => {
    /* A dash, not "Vacant": claiming a room is free when nothing has reported on
       it is worse than admitting the system does not know. */
    await expect(within(canvasElement).getAllByText('-').length).toBeGreaterThan(0);
  },
};

export const TogglesAvailability: Story = {
  name: 'Turning a room off',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const [first] = canvas.getAllByRole('switch');
    await expect(first).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(first);
    // The row reports the value it is moving TO, so the caller does not have to
    // invert it.
    await expect(args.onToggleAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Consult 1' }),
      false
    );
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission the switch is locked',
  args: { canEditRoom: false },
  play: async ({ args, canvasElement }) => {
    const [first] = within(canvasElement).getAllByRole('switch');
    await expect(first).toBeDisabled();
    await userEvent.click(first, { pointerEventsCheck: 0 });
    // Disabled rather than hidden: a viewer should still see WHICH rooms are
    // available, they just cannot change it.
    await expect(args.onToggleAvailability).not.toHaveBeenCalled();
  },
};

export const OpensARoom: Story = {
  name: 'Viewing a room',
  play: async ({ args, canvasElement }) => {
    const view = within(canvasElement).getAllByRole('button', { name: /view/i })[0];
    await userEvent.click(view);
    await expect(args.setActive).toHaveBeenCalledTimes(1);
    await expect(args.setView).toHaveBeenCalledWith(true);
  },
};

export const Empty: Story = {
  name: 'No rooms configured',
  args: { filteredList: [] },
};

export const Phone: Story = {
  name: 'Phone: the rows become cards',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
