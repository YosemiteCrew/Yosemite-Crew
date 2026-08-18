import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { ManagedRoom } from './RoomInfo.types';
import RoomInfoSections, { type OpenSections } from './RoomInfoSections';

const ROOM: ManagedRoom = {
  id: 'room-icu-1',
  organisationId: 'org-storybook',
  name: 'ICU Bay A',
  code: 'ICU-A',
  type: 'ICU',
  assignedSpecialiteis: ['spec-surgery'],
  assignedStaffs: ['staff-1', 'staff-2'],
  availability: {
    isAvailable: true,
    days: 'MON_SAT',
    startTime: '08:00',
    endTime: '20:00',
    species: ['CANINE', 'FELINE'],
    totalUnits: 6,
  },
  units: [
    { id: 'unit-1', name: 'Small kennel', size: 'Small', count: 4 },
    { id: 'unit-2', name: 'Oxygen cage', size: 'Large', count: 2 },
  ],
  equipment: ['Oxygen Tank', 'Heating Support'],
};

const EXAM_ROOM: ManagedRoom = {
  ...ROOM,
  id: 'room-exam-2',
  name: 'Exam 2',
  code: 'EX-02',
  type: 'EXAM_ROOM',
  units: [],
  availability: { ...ROOM.availability, totalUnits: 0 },
};

const OPTIONS = {
  equipment: ['Warming blanket'],
  specialities: [
    { label: 'Surgery', value: 'spec-surgery' },
    { label: 'Internal medicine', value: 'spec-internal' },
    { label: 'Dermatology', value: 'spec-derm' },
  ],
  team: [
    { label: 'Dr. Lena Hartmann', value: 'staff-1' },
    { label: 'Nurse Priya Raman', value: 'staff-2' },
    { label: 'Tech Marisol Vega', value: 'staff-3' },
  ],
};

const ALL_OPEN: OpenSections = {
  details: true,
  availability: true,
  units: true,
  equipment: true,
};

const ALL_CLOSED: OpenSections = {
  details: false,
  availability: false,
  units: false,
  equipment: false,
};

type SectionsProps = ComponentProps<typeof RoomInfoSections>;
type HarnessProps = Omit<SectionsProps, 'onToggleSection'>;

/**
 * `openSections` is owned by `useRoomInfoController` in the real screen, so the
 * headers are inert without a state holder. `openSections` here is the initial
 * value and is re-synced when the arg changes, which is what lets a `play`
 * function open a section the story started with closed.
 */
const RoomInfoSectionsHarness = ({ openSections, ...rest }: HarnessProps) => {
  const [sections, setSections] = useState(openSections);
  const [prevSections, setPrevSections] = useState(openSections);
  if (prevSections !== openSections) {
    setPrevSections(openSections);
    setSections(openSections);
  }

  return (
    <RoomInfoSections
      {...rest}
      openSections={sections}
      onToggleSection={(section) =>
        setSections((current) => ({ ...current, [section]: !current[section] }))
      }
    />
  );
};

const meta = {
  title: 'Organization/RoomInfoSections',
  component: RoomInfoSectionsHarness,
  decorators: [
    (Story) => (
      <div className="flex h-[720px] w-[520px] flex-col">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The body of the room drawer: four collapsible sections - Details, Availability, Unit ' +
          'type, Equipments / Capabilities - inside one `overflow-y-auto` column.\n\n' +
          'This component is almost entirely gated surface. Every section body is behind ' +
          '`openSections[key] &&`, so a closed section contributes **nothing** to the DOM, and ' +
          '`openSections` is owned by `useRoomInfoController` several levels up - which means no ' +
          'static render of the drawer has ever contained the bodies at all.\n\n' +
          'Worse, each open section then forks again on `mode`. `details` renders either a ' +
          '`DetailRows` definition list (a `grid-cols-[1fr_1.2fr]` `<dl>` with right-aligned ' +
          'values, wrapped in a `rounded-2xl` bordered box) **or** a `grid-cols-1 sm:grid-cols-2` ' +
          'of live inputs and two portalled dropdowns. They share no markup. That is eight ' +
          'distinct bodies from one component, seven of which were never drawn.\n\n' +
          'Two of those bodies also swap on `supportsUnits`, which is derived from the room type ' +
          '(`ICU`, `INPATIENT`, `ISOLATION`, `BOARDING`): with it, availability gets a Total Units ' +
          'field and the units section gets an add button; without it, both are replaced by ' +
          'explanatory `rounded-2xl` paragraphs. So an exam room and an ICU bay are different ' +
          'layouts, not the same layout with a field hidden.\n\n' +
          'The edit bodies additionally carry five dropdowns whose panels `createPortal` to ' +
          '`document.body` - two more interactions deep again, and outside this subtree entirely. ' +
          'One of them is opened below.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    canEditRoom: true,
    customEquipmentName: '',
    equipmentLabel: 'Oxygen Tank, Heating Support',
    formData: ROOM,
    mode: 'view',
    openSections: ALL_CLOSED,
    roomTypeLabel: 'ICU',
    specialityLabel: 'Surgery',
    staffLabel: 'Dr. Lena Hartmann\nNurse Priya Raman',
    supportsUnits: true,
    totalUnits: 6,
    availabilityLabels: {
      days: 'Mon - Sat',
      species: 'Canine, Feline',
      time: '08:00 - 20:00',
    },
    options: OPTIONS,
    onAddCustomEquipment: fn(),
    onAddUnit: fn(),
    onAvailabilityToggle: fn(),
    onCustomEquipmentNameChange: fn(),
    onFormChange: fn(),
    onRoomTypeChange: fn(),
    onUpdateAvailability: fn(),
    onUpdateUnit: fn(),
  },
} satisfies Meta<typeof RoomInfoSectionsHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllCollapsed: Story = {
  name: 'All sections collapsed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Four headers, four bodies that do not exist. The chevron rotation is the
    // only thing on screen that differs between this and the open state.
    await expect(canvas.getByRole('button', { name: 'Details' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(canvas.queryByText('Room Code')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Assigned staff')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Oxygen Tank, Heating Support')).not.toBeInTheDocument();
    // The availability toggle lives in the header, so it survives the collapse.
    await expect(canvas.getByRole('switch', { name: 'Toggle room availability' })).toBeChecked();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer as it opens. Only the four headers, the "Available now" meta and the ' +
          'availability switch are rendered - everything else is unmounted.',
      },
    },
  },
};

export const OpenedByClicking: Story = {
  name: 'Opened one header at a time',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Details' }));
    // Assert the body mounted its rows, not just that aria-expanded flipped -
    // the weak check passes on an empty section.
    await expect(await canvas.findByText('Room Code')).toBeInTheDocument();
    await expect(canvas.getByText('ICU-A')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Availability' }));
    await expect(await canvas.findByText('Assigned staff')).toBeInTheDocument();
    await expect(canvas.getByText('Mon - Sat')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Unit type (2)' }));
    // Each unit name renders twice - once as the fieldset legend, once as the
    // "Name" row inside it - which is only apparent with the section open.
    await expect(await canvas.findAllByText('Small kennel')).toHaveLength(2);
    await expect(canvas.getAllByText('Oxygen cage')).toHaveLength(2);

    await userEvent.click(canvas.getByRole('button', { name: 'Equipments / Capabilities' }));
    await expect(await canvas.findByText('Oxygen Tank, Heating Support')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The disclosure path itself: each `SectionHeader` calls `onToggleSection(key)` and the ' +
          'controller flips one flag. Four clicks take the drawer from four headers to its full ' +
          'height, and every intermediate state is a real layout the user sees.',
      },
    },
  },
};

export const ViewExpanded: Story = {
  name: 'View mode, all open',
  args: { openSections: ALL_OPEN },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Room Code')).toBeInTheDocument();
    await expect(canvas.getByText('Speciality')).toBeInTheDocument();
    await expect(canvas.getByText('Days')).toBeInTheDocument();
    await expect(canvas.getByText('Total units')).toBeInTheDocument();
    // Each unit is its own <fieldset>/<legend> with a nested, unbordered DetailRows.
    await expect(canvas.getAllByRole('group')).toHaveLength(2);
    // "Name" is a dt in Details AND in both unit blocks - three of them.
    await expect(canvas.getAllByText('Name')).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'All four read bodies at once. The three top sections use the **bordered** `DetailRows` ' +
          'box; the unit blocks use the unbordered variant inside a `fieldset` with a `legend`, so ' +
          'the same `<dl>` appears with and without its own frame in one scroll. Assigned staff is ' +
          'the only value with `whitespace-pre-line`, so it is the only row that grows vertically.',
      },
    },
  },
};

export const EditExpanded: Story = {
  name: 'Edit mode, all open',
  args: { openSections: ALL_OPEN, mode: 'edit' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A completely different tree from the view bodies: live inputs everywhere.
    await expect(canvas.getByLabelText('Room code')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Room Type: ICU' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Speciality (optional): Surgery' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /^Start time/ })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Total Units')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add unit type' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Add equipment name')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add custom equipment' })).toBeInTheDocument();
    // One "Name" per unit editor plus the room's own.
    await expect(canvas.getAllByLabelText('Name')).toHaveLength(3);
    // The read-mode definition lists are gone entirely, not restyled.
    await expect(canvas.queryByText('Room Code')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The seven-editor tree behind `mode === "edit"`. The unit blocks switch from a ' +
          '`border-card-border` fieldset to a `border-blue-text` box, which is the only signal ' +
          'that they became editable; the equipment section grows an "add custom" row whose 48px ' +
          'square button has to bottom-align (`items-end`) with a field that carries a label above ' +
          'it. Nothing here is reachable without both `mode` and the section flag set.',
      },
    },
  },
};

export const RoomTypeDropdownOpen: Story = {
  name: 'Edit mode, room-type listbox open',
  args: { openSections: ALL_OPEN, mode: 'edit' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Room Type: ICU' }));
    // The panel portals to document.body, so it is outside the drawer's own
    // overflow-y-auto column - the reason it is not clipped by it.
    await waitFor(() =>
      expect(document.querySelector('[data-portal-dropdown]')).toBeInTheDocument()
    );
    const panel = document.querySelector('[data-portal-dropdown]') as HTMLElement;
    // Assert all thirteen room types rendered. An empty panel would satisfy the
    // trigger's aria-expanded just as well.
    await expect(within(panel).getAllByRole('button')).toHaveLength(13);
    await expect(within(panel).getByText('Boarding')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Thirteen room types in a panel capped at 200px, so it scrolls - and picking one of the ' +
          'four unit-capable types from it is what re-renders the two sections above into their ' +
          'other layout. This is the control that switches the whole drawer between the two ' +
          'shapes shown in the next story.',
      },
    },
  },
};

export const ExamRoomWithoutUnits: Story = {
  name: 'Edit mode, room type without units',
  args: {
    openSections: ALL_OPEN,
    mode: 'edit',
    formData: EXAM_ROOM,
    supportsUnits: false,
    roomTypeLabel: 'Exam room',
    totalUnits: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Both replacements, in two different sections, from one derived boolean.
    await expect(
      canvas.getByText('Units are available for ICU, Inpatient, Isolation, and Boarding rooms.')
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Select ICU, Inpatient, Isolation, or Boarding to configure unit types.')
    ).toBeInTheDocument();
    // The Total Units field and the add button are gone rather than disabled.
    await expect(canvas.queryByLabelText('Total Units')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Add unit type' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An exam room. `supportsUnits` false replaces the Total Units input with a `sm:col-span-2` ' +
          'explanatory paragraph - so the availability grid loses a cell and the Assigned Staff row ' +
          'moves up - and empties the unit section down to one line. Two sections change shape from ' +
          'one derived boolean, and neither change is visible unless both are open.',
      },
    },
  },
};

export const ReadOnlyAvailabilityToggle: Story = {
  name: 'Availability switch locked',
  args: { openSections: ALL_OPEN, canEditRoom: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'Toggle room availability' });
    // Genuinely disabled, not just dimmed: the switch keeps its role and state
    // so assistive tech still reports the room as available.
    await expect(toggle).toBeDisabled();
    await expect(toggle).toBeChecked();
  },
  parameters: {
    docs: {
      description: {
        story:
          'For a role without room-edit permission the switch is `disabled`, taking ' +
          '`cursor-not-allowed opacity-60`, while the section bodies stay fully readable. The ' +
          'toggle sits in the header, so this is the one control that is visible whether or not ' +
          'the section is open.',
      },
    },
  },
};
