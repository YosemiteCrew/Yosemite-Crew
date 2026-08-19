import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { RoomFormData } from './AddRoom';
import {
  AvailabilitySection,
  BasicDetailsSection,
  EquipmentSection,
  type OpenSections,
  UnitsSection,
} from './AddRoomSections';

const ORG_ID = 'org-storybook-rooms';

const EMPTY_ROOM: RoomFormData = {
  id: '',
  organisationId: ORG_ID,
  name: '',
  code: '',
  type: '',
  assignedSpecialiteis: [],
  assignedStaffs: [],
  availability: {
    isAvailable: true,
    days: 'MON_SAT',
    startTime: '10:00',
    endTime: '20:00',
    species: [],
    totalUnits: 0,
  },
  units: [],
  unitCount: 0,
  equipment: [],
};

const ICU_ROOM: RoomFormData = {
  ...EMPTY_ROOM,
  name: 'ICU Bay A',
  code: 'ICU-A',
  type: 'ICU',
  assignedSpecialiteis: ['spec-surgery'],
  assignedStaffs: ['staff-1'],
  availability: {
    ...EMPTY_ROOM.availability,
    species: ['CANINE', 'FELINE'],
    totalUnits: 6,
  },
  units: [
    { id: 'unit-1', name: 'Small kennel', size: 'Small', count: 4 },
    { id: 'unit-2', name: 'Oxygen cage', size: 'Large', count: 2 },
  ],
  unitCount: 6,
  equipment: ['Oxygen Tank', 'Heating Support'],
};

const EXAM_ROOM: RoomFormData = {
  ...EMPTY_ROOM,
  name: 'Exam 2',
  code: 'EX-02',
  type: 'EXAM_ROOM',
};

const SPECIALITY_OPTIONS = [
  { label: 'Surgery', value: 'spec-surgery' },
  { label: 'Internal medicine', value: 'spec-internal' },
];

const TEAM_OPTIONS = [
  { label: 'Dr. Lena Hartmann', value: 'staff-1' },
  { label: 'Nurse Priya Raman', value: 'staff-2' },
];

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

/** Hoisted so the harness does not mint a new mock on every render. */
const noop = fn();

type HarnessProps = {
  formData: RoomFormData;
  formDataErrors: { name?: string; code?: string; type?: string };
  openSections: OpenSections;
  supportsUnits: boolean;
  customEquipmentName: string;
};

/**
 * `openSections` lives in `AddRoom`, so the four headers are inert without a
 * state holder. The prop is the initial value and is re-synced when the arg
 * changes, which is what lets a play function open a section that started closed.
 */
const AddRoomSectionsHarness = ({
  formData,
  formDataErrors,
  openSections,
  supportsUnits,
  customEquipmentName,
}: HarnessProps) => {
  const [sections, setSections] = useState(openSections);
  const [prevSections, setPrevSections] = useState(openSections);
  if (prevSections !== openSections) {
    setPrevSections(openSections);
    setSections(openSections);
  }
  const toggle = (key: keyof OpenSections) =>
    setSections((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="flex flex-col gap-6">
      <BasicDetailsSection
        formData={formData}
        formDataErrors={formDataErrors}
        open={sections.details}
        specialitiesOptions={SPECIALITY_OPTIONS}
        onToggle={() => toggle('details')}
        onChange={noop}
        onRoomTypeChange={noop}
      />
      <AvailabilitySection
        formData={formData}
        open={sections.availability}
        supportsUnits={supportsUnits}
        teamOptions={TEAM_OPTIONS}
        onToggle={() => toggle('availability')}
        onAvailabilityChange={noop}
        onChange={noop}
      />
      <UnitsSection
        formData={formData}
        open={sections.units}
        supportsUnits={supportsUnits}
        onAddUnit={noop}
        onToggle={() => toggle('units')}
        onUpdateUnit={noop}
      />
      <EquipmentSection
        customEquipmentName={customEquipmentName}
        formData={formData}
        open={sections.equipment}
        onAddCustomEquipment={noop}
        onCustomEquipmentNameChange={noop}
        onToggle={() => toggle('equipment')}
        onChange={noop}
      />
    </div>
  );
};

const meta = {
  title: 'Organization/AddRoomSections',
  component: AddRoomSectionsHarness,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The scrolling body of the "Adding new room" drawer: four collapsible sections built ' +
          'from the same `SectionHeader` and nothing else.\n\n' +
          'All four bodies sit behind `{open && ...}`, so a collapsed section contributes ' +
          '**nothing** to the DOM - not a hidden node, not a zero-height box - and `openSections` ' +
          'is owned by `AddRoom` two levels up. No static render of the drawer has ever included ' +
          'them.\n\n' +
          'What survives a collapse is the part worth knowing: the availability **switch** and ' +
          'the units **add** button live in their headers, not their bodies, so both stay ' +
          'operable with the section shut. A reviewer looking for "everything disappears when ' +
          'collapsed" would be wrong about two of the four sections.\n\n' +
          'Two sections then fork again on `supportsUnits`, derived from the room type (ICU, ' +
          'Inpatient, Isolation, Boarding). With it, Availability grows a Total Units field and ' +
          'Units grows an add button; without it, both are replaced by explanatory bordered ' +
          'paragraphs. An exam room and an ICU bay are two different layouts, not one layout ' +
          'with a field hidden - and the empty-units line is a third state again, shown only ' +
          'when the type supports units but none have been added yet.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    formData: ICU_ROOM,
    formDataErrors: {},
    openSections: ALL_OPEN,
    supportsUnits: true,
    customEquipmentName: '',
  },
  decorators: [
    (Story) => (
      <div className="flex w-[520px] max-w-full flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddRoomSectionsHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllCollapsed: Story = {
  name: 'All four sections collapsed',
  args: { openSections: ALL_CLOSED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Basic details' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    // Four bodies that do not exist - one probe per section, so a single
    // section that failed to collapse cannot hide behind the others.
    await expect(canvas.queryByLabelText('Room code')).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText('Total Units')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Draft unit type')).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText('Add equipment name')).not.toBeInTheDocument();

    /* The two header-level controls SURVIVE the collapse, because they are
       header `action`/`meta` slots rather than body content. This is the pair a
       "collapsed means empty" assumption gets wrong. */
    await expect(canvas.getByRole('switch', { name: 'Toggle room availability' })).toBeChecked();
    await expect(canvas.getByRole('button', { name: 'Add unit type' })).toBeInTheDocument();
    // The units header also keeps its count while shut.
    await expect(canvas.getByRole('button', { name: 'Unit type (2)' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer body reduced to four header rows. Only the chevron rotation, the ' +
          '"Available now" meta and the two header controls are on screen.',
      },
    },
  },
};

export const OpenedByClicking: Story = {
  name: 'Opened one header at a time',
  args: { openSections: ALL_CLOSED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Basic details' }));
    // Assert the body mounted its fields, not merely that aria-expanded flipped -
    // the weak check passes on an empty section.
    expect(await canvas.findByLabelText('Room code')).toHaveValue('ICU-A');
    await expect(
      canvas.getByText(
        'Assign a specialty if this room is dedicated to a specific speciality or service.'
      )
    ).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Availability' }));
    expect(await canvas.findByLabelText('Total Units')).toHaveValue(6);

    await userEvent.click(canvas.getByRole('button', { name: 'Unit type (2)' }));
    expect(await canvas.findAllByText('Draft unit type')).toHaveLength(2);

    await userEvent.click(canvas.getByRole('button', { name: 'Equipments / Capabilities' }));
    expect(await canvas.findByLabelText('Add equipment name')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The disclosure path itself. Four clicks take the drawer from four rows to its full ' +
          'height, and every intermediate height is a real layout someone sees while filling ' +
          'the form in.',
      },
    },
  },
};

export const AllOpenUnitCapable: Story = {
  name: 'All open, unit-capable room',
  /* The details grid splits on `sm:` (Tailwind's 640px VIEWPORT breakpoint), not
     on a container query, so its track count is decided by the panel width rather
     than by the 520px decorator. Pinned as a global - `parameters.viewport` was
     removed in Storybook 10 and would be inert - so the two-track assertion below
     is deterministic instead of depending on how wide the docs panel happens to be. */
  globals: { viewport: { value: 'laptop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Basic details: two text fields plus two portalled selects.
    await expect(canvas.getAllByLabelText('Name')[0]).toHaveValue('ICU Bay A');
    await expect(canvas.getByLabelText('Room code')).toHaveValue('ICU-A');
    await expect(canvas.getByRole('button', { name: 'Room Type: ICU' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Speciality (optional): Surgery' })
    ).toBeInTheDocument();

    /* The details grid is two tracks over FIVE children at this width: Name and
       Room code take one cell each, and the room type, the speciality picker and
       the hint paragraph each sit in a `sm:col-span-2` wrapper that spans both.
       Assert the track count AND the child count - a template with fewer tracks
       than a child expects silently reflows the row instead of failing, and the
       five children are easy to miscount because three of them are wrappers
       rather than fields. */
    const grid = canvas.getByLabelText('Room code').closest('.grid') as HTMLElement;
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(grid.children).toHaveLength(5);

    // Availability: two timepickers, two selects, the unit-capable field.
    await expect(canvas.getByRole('button', { name: /^Start time/ })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /^End time/ })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Days: Mon - Sat' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Total Units')).toHaveValue(6);
    await expect(
      canvas.getByRole('button', { name: 'Assigned Staff (optional): Dr. Lena Hartmann' })
    ).toBeInTheDocument();

    // Units: one bordered editor per draft, each with its own Name/Size/Units.
    await expect(canvas.getAllByText('Draft unit type')).toHaveLength(2);
    // Three "Name" fields in the whole body: the room's, plus one per unit.
    await expect(canvas.getAllByLabelText('Name')).toHaveLength(3);
    await expect(canvas.getAllByLabelText('Units')).toHaveLength(2);
    await expect(canvas.getByRole('button', { name: 'Size: Small' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Size: Large' })).toBeInTheDocument();

    // Equipment: the select carries the room's own values merged into the
    // standard list, so a custom entry survives a re-render of the options.
    await expect(
      canvas.getByRole('button', { name: 'Equipment: Oxygen Tank, Heating Support' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add custom equipment' })).toBeInTheDocument();

    // The two "not supported" paragraphs must be absent, not merely unstyled.
    await expect(
      canvas.queryByText('Units are available for ICU, Inpatient, Isolation, and Boarding rooms.')
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByText('Select ICU, Inpatient, Isolation, or Boarding to configure unit types.')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full drawer body for an ICU bay: the tallest state the form ever reaches, and the ' +
          'one that decides whether the drawer scrolls sensibly. Every unit draft is its own ' +
          '`border-blue-text` box captioned "Draft unit type", which is the only signal that it ' +
          'has not been saved yet.',
      },
    },
  },
};

export const NoUnitsYet: Story = {
  name: 'Unit-capable room with no units',
  args: { formData: { ...ICU_ROOM, units: [], unitCount: 0 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The count in the header title is the array length, so it drops to zero.
    await expect(canvas.getByRole('button', { name: 'Unit type (0)' })).toBeInTheDocument();
    // The add affordance is still there - this state is reachable, not a dead end.
    await expect(canvas.getByRole('button', { name: 'Add unit type' })).toBeInTheDocument();
    await expect(
      canvas.getByText('Add unit types when this room contains kennels, wards, pods, or bays.')
    ).toBeInTheDocument();
    await expect(canvas.queryAllByText('Draft unit type')).toHaveLength(0);
    // This is the "supported but empty" line, NOT the "type does not support
    // units" line - two different sentences that are easy to confuse.
    await expect(
      canvas.queryByText('Select ICU, Inpatient, Isolation, or Boarding to configure unit types.')
    ).not.toBeInTheDocument();
    /* Total Units is bound to `availability.totalUnits`, the units list to
       `formData.units`, and nothing reconciles them - so this room reads "6" in
       Availability while its Unit type header reads "(0)". That divergence is
       the reason this state is worth drawing rather than a bug in the fixture. */
    await expect(canvas.getByLabelText('Total Units')).toHaveValue(6);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state a new ICU room opens in once its type is chosen: units are supported, none ' +
          'exist yet. The copy names the things a unit actually is - kennels, wards, pods, bays - ' +
          'rather than telling the user to press the button next to it.',
      },
    },
  },
};

export const RoomTypeWithoutUnits: Story = {
  name: 'Room type without units',
  args: { formData: EXAM_ROOM, supportsUnits: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // One derived boolean, two replacements, in two different sections.
    await expect(
      canvas.getByText('Units are available for ICU, Inpatient, Isolation, and Boarding rooms.')
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Select ICU, Inpatient, Isolation, or Boarding to configure unit types.')
    ).toBeInTheDocument();
    // Both controls are gone rather than disabled, so there is nothing to click
    // into a state the room type cannot hold.
    await expect(canvas.queryByLabelText('Total Units')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Add unit type' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Room Type: Exam room' })).toBeInTheDocument();
    /* Only the unit-bearing parts are replaced. The rest of Availability is
       outside the `supportsUnits` fork and keeps its values, and the Units header
       keeps its count - so the section is reduced, not removed. */
    await expect(canvas.getByRole('button', { name: 'Days: Mon - Sat' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Unit type (0)' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Room code')).toHaveValue('EX-02');
  },
  parameters: {
    docs: {
      description: {
        story:
          'An exam room. `supportsUnits` is derived from the type rather than stored, so picking ' +
          'a non-unit type in Basic details rewrites two sections below it in the same render - ' +
          'and `handleRoomTypeChange` in `AddRoom` also empties any units already drafted, so ' +
          'this is not a reversible view toggle.',
      },
    },
  },
};

export const EmptyDraft: Story = {
  name: 'Empty draft, no type chosen',
  args: { formData: EMPTY_ROOM, supportsUnits: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // No type yet, so the trigger shows the bare placeholder rather than a value.
    await expect(canvas.getByRole('button', { name: 'Room Type' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Room code')).toHaveValue('');
    await expect(canvas.getByRole('button', { name: 'Unit type (0)' })).toBeInTheDocument();
    // Availability still opens with real defaults - 10:00 to 20:00, Mon - Sat -
    // so an untouched draft is already a saveable schedule.
    await expect(canvas.getByRole('button', { name: 'Days: Mon - Sat' })).toBeInTheDocument();
    await expect(canvas.getByRole('switch', { name: 'Toggle room availability' })).toBeChecked();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the drawer body looks like the instant it opens, before a single field is ' +
          'touched. Availability is the only section that is not blank: it ships defaults, which ' +
          'is why a room can be added with a name and a type alone.',
      },
    },
  },
};
