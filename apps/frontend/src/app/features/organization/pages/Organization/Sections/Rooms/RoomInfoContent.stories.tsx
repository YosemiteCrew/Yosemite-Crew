import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { OrganisationRoom } from '@yosemite-crew/types';

import RoomInfoContent from './RoomInfoContent';
import type { ManagedRoom } from './RoomInfo.types';

const ACTIVE_ROOM: OrganisationRoom = {
  id: 'room-consult-1',
  name: 'Consult 1',
  organisationId: 'org-storybook',
  code: 'C1',
  type: 'EXAM_ROOM',
};

const FORM_DATA: ManagedRoom = {
  ...ACTIVE_ROOM,
  availability: {
    isAvailable: true,
    days: 'MON_FRI',
    startTime: '09:00',
    endTime: '17:30',
    species: ['dog', 'cat'],
    totalUnits: 0,
  },
  units: [],
  equipment: ['Otoscope', 'Digital scale'],
  assignedSpecialiteis: ['spec-derm'],
  assignedStaffs: ['staff-weber'],
};

const OPTIONS = {
  equipment: ['Otoscope', 'Digital scale', 'Ophthalmoscope'],
  specialities: [
    { label: 'Dermatology', value: 'spec-derm' },
    { label: 'Cardiology', value: 'spec-cardio' },
  ],
  team: [
    { label: 'Dr. Weber', value: 'staff-weber' },
    { label: 'Nurse Lindqvist', value: 'staff-lindqvist' },
  ],
};

/**
 * The component is fully controlled: every panel is opened by a `visibility.*`
 * flag whose setter lives in the page above it. Handing those setters plain
 * mocks makes the trash and pencil dead, so the nested confirms could only ever
 * be posed, never reached. This harness gives the flags somewhere to live so the
 * confirms open the way they do in the product.
 */
const RoomInfoHarness = (args: ComponentProps<typeof RoomInfoContent>) => {
  const [showModal, setShowModal] = useState(args.visibility.showModal);
  const [showDeleteModal, setShowDeleteModal] = useState(args.visibility.showDeleteModal);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(args.visibility.showDiscardConfirm);
  const [mode, setMode] = useState(args.mode);

  return (
    <RoomInfoContent
      {...args}
      mode={mode}
      setMode={setMode}
      visibility={{ showModal, showDeleteModal, showDiscardConfirm }}
      setShowModal={setShowModal}
      setShowDeleteModal={setShowDeleteModal}
      setShowDiscardConfirm={setShowDiscardConfirm}
    />
  );
};

/** Only `<dialog open>` is painted; the closed ones stay mounted and inert. */
const openDialogs = () => Array.from(document.querySelectorAll<HTMLElement>('dialog[open]'));

const findOpenDialogTitled = (title: string): HTMLElement => {
  const match = openDialogs().find((dialog) =>
    within(dialog).queryByRole('heading', { name: title })
  );
  if (!match) throw new Error(`No open dialog titled "${title}"`);
  return match;
};

const meta = {
  title: 'Organization/RoomInfoContent',
  component: RoomInfoContent,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The room detail drawer on the Organization > Rooms screen, and the two confirmation ' +
          'dialogs that open on top of it.\n\n' +
          'All three surfaces are gated, and the two confirms are gated **twice over** - the drawer ' +
          'has to be open before the pencil or the trash exists at all. None of them had ever been ' +
          'drawn.\n\n' +
          'They are also not siblings in the tree the way they look on screen. Every one of them ' +
          'goes through `ModalBase`, which `createPortal`s to `document.body`, so an open confirm is ' +
          "the drawer's DOM sibling rather than its child. That is load-bearing: `ModalBase` keeps a " +
          'module-level stack so only the topmost dialog answers Escape or a backdrop press, and ' +
          'ref-counts the body scroll lock so closing the confirm does not unlock the page behind ' +
          'the drawer that is still open. Neither behaviour is observable without two dialogs open ' +
          'at once, which is exactly what the stories below produce.\n\n' +
          'It also means the closed confirms are always in the DOM. They are `<dialog>` elements ' +
          'without `open`, marked `inert`, so a text query finds their headings whether or not they ' +
          'are visible - the assertions here filter on `dialog[open]` for that reason, and a story ' +
          'that merely asserted the heading exists would pass on a confirm that never opened.\n\n' +
          'Both confirms end in a `grid grid-cols-2` action pair that mounts only with the dialog. ' +
          'That is the same shape as the popover bug this work exists to catch - an invalid grid ' +
          'template is dropped by the browser and six children silently collapse into one column - ' +
          'so the delete story asserts the computed template really resolves to two tracks.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeRoom: ACTIVE_ROOM,
    availabilityLabels: {
      days: 'Mon - Fri',
      species: 'Dog, Cat',
      time: '09:00 - 17:30',
    },
    permissions: { canEditRoom: true },
    customEquipmentName: '',
    equipmentLabel: 'Otoscope, Digital scale',
    formData: FORM_DATA,
    state: { isDirty: true, saving: false, supportsUnits: false },
    mode: 'view',
    openSections: { details: true, availability: true, units: false, equipment: true },
    roomTypeLabel: 'Exam room',
    setMode: fn(),
    setShowDeleteModal: fn(),
    setShowDiscardConfirm: fn(),
    setShowModal: fn(),
    visibility: { showDeleteModal: false, showDiscardConfirm: false, showModal: true },
    specialityLabel: 'Dermatology',
    staffLabel: 'Dr. Weber',
    totalUnits: 0,
    options: OPTIONS,
    onAddCustomEquipment: fn(),
    onAddUnit: fn(),
    onAvailabilityToggle: fn(),
    onCloseDrawer: fn(),
    onCustomEquipmentNameChange: fn(),
    onDelete: fn(),
    onDiscardChanges: fn(),
    onFormChange: fn(),
    onRoomTypeChange: fn(),
    onSave: fn(),
    onToggleSection: fn(),
    onUpdateAvailability: fn(),
    onUpdateUnit: fn(),
  },
  render: (args) => <RoomInfoHarness {...args} />,
} satisfies Meta<typeof RoomInfoContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {
  name: 'Detail drawer (view)',
  play: async () => {
    // Exactly one painted dialog: the two confirms are mounted but closed.
    await expect(openDialogs()).toHaveLength(1);

    const drawer = findOpenDialogTitled('Consult 1');
    await expect(within(drawer).getByText('Room')).toBeInTheDocument();
    // The room type appears twice on purpose - as the header meta line and again
    // as a Details row - so this is getAllByText, not getByText.
    await expect(within(drawer).getAllByText('Exam room')).toHaveLength(2);
    await expect(within(drawer).getByText('Dermatology')).toBeInTheDocument();
    // The view mode is detail rows, not inputs - a form here would mean the
    // mode branch leaked.
    await expect(within(drawer).queryByRole('textbox')).toBeNull();
    await expect(within(drawer).getByRole('button', { name: 'Edit room' })).toBeInTheDocument();
    await expect(within(drawer).getByRole('button', { name: 'Delete room' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting drawer: a "Room" eyebrow over the room name, the type as meta, then the ' +
          'Details / Availability / Unit type / Equipment sections as bordered label-value lists. ' +
          'No footer, because there is nothing to save yet.',
      },
    },
  },
};

export const DeleteConfirm: Story = {
  name: 'Nested confirm: Delete room?',
  play: async () => {
    const drawer = findOpenDialogTitled('Consult 1');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Delete room' }));

    // Two painted dialogs now - the confirm is a SIBLING of the drawer on
    // document.body, not a child of it.
    await expect(openDialogs()).toHaveLength(2);

    const confirm = findOpenDialogTitled('Delete room?');
    // Assert the confirm has its content, not merely that a flag flipped: the
    // closed confirm is in the DOM too, so the weak check always passes.
    await expect(within(confirm).getByText('Consult 1')).toBeInTheDocument();
    const cancel = within(confirm).getByRole('button', { name: 'Cancel' });
    await expect(within(confirm).getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    /* The action pair is a `grid grid-cols-2` that only mounts with the dialog.
       Assert the computed template really resolves to two tracks - a dropped or
       malformed template collapses both buttons into one column and still looks
       deliberate. */
    const actions = cancel.parentElement as HTMLElement;
    await expect(getComputedStyle(actions).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(actions.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          "The destructive confirm, opened from the drawer's trash chip. It names the room in bold " +
          'inside the sentence rather than in its title, and pairs a neutral Cancel against the ' +
          '`--danger-strong` Delete. This is the only render where the drawer and a confirm are ' +
          'composited together.',
      },
    },
  },
};

export const DiscardConfirm: Story = {
  name: 'Nested confirm: Discard changes?',
  args: { mode: 'edit' },
  play: async () => {
    // The discard confirm has no trigger of its own. It is raised by `canClose`
    // refusing to dismiss a dirty edit - so Escape on the drawer is the path.
    await userEvent.keyboard('{Escape}');

    await expect(openDialogs()).toHaveLength(2);
    const confirm = findOpenDialogTitled('Discard changes?');
    await expect(within(confirm).getByText(/You have unsaved room changes/)).toBeInTheDocument();
    await expect(within(confirm).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument();
    await expect(within(confirm).getByRole('button', { name: 'Discard' })).toBeInTheDocument();

    // The drawer must still be open behind it - refusing to close is the whole
    // point of the guard.
    await expect(findOpenDialogTitled('Edit room')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reached by pressing Escape while the drawer is in edit mode with unsaved changes. ' +
          '`canClose` returns `false`, which both blocks the dismissal and raises this dialog, so ' +
          'the confirm and the drawer it is protecting are on screen together. There is no prop or ' +
          'button that opens it directly.',
      },
    },
  },
};

export const EditMode: Story = {
  name: 'Edit mode',
  args: { mode: 'edit' },
  play: async () => {
    const drawer = findOpenDialogTitled('Edit room');
    // The title changes and the detail rows become editors.
    await expect(within(drawer).getAllByRole('textbox').length).toBeGreaterThan(0);
    await expect(within(drawer).getByRole('button', { name: 'Save' })).toBeInTheDocument();
    await expect(within(drawer).getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    // The pencil is gone - you are already editing - but the trash stays.
    await expect(within(drawer).queryByRole('button', { name: 'Edit room' })).toBeNull();
    await expect(within(drawer).getByRole('button', { name: 'Delete room' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every section swaps its label-value rows for inputs, the header title becomes "Edit ' +
          'room", and a footer appears with Discard and Save. The pencil is dropped rather than ' +
          'disabled, so the header actions re-flow - which is only visible against the view story.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Edit mode (saving)',
  args: { mode: 'edit', state: { isDirty: true, saving: true, supportsUnits: false } },
  play: async () => {
    const drawer = findOpenDialogTitled('Edit room');
    await expect(within(drawer).getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'While a save is in flight the primary relabels to "Saving..." but keeps its check icon ' +
          'and stays pressable - the guard is upstream, not here.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { permissions: { canEditRoom: false } },
  play: async () => {
    const drawer = findOpenDialogTitled('Consult 1');
    // Both header chips are dropped, not disabled, so there is no affordance
    // suggesting an edit that cannot happen - and the delete confirm is
    // unreachable from this render at all.
    await expect(within(drawer).queryByRole('button', { name: 'Edit room' })).toBeNull();
    await expect(within(drawer).queryByRole('button', { name: 'Delete room' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A member without room-edit permission gets the same detail drawer with an empty actions ' +
          'slot, so the close button sits alone against the title.',
      },
    },
  },
};

export const SupportsUnits: Story = {
  name: 'Ward room with units',
  args: {
    activeRoom: { ...ACTIVE_ROOM, id: 'room-icu', name: 'ICU ward', code: 'ICU', type: 'ICU' },
    formData: {
      ...FORM_DATA,
      id: 'room-icu',
      name: 'ICU ward',
      code: 'ICU',
      type: 'ICU',
      availability: { ...FORM_DATA.availability, totalUnits: 3 },
      units: [
        { id: 'unit-1', name: 'Kennel A', size: 'Large', count: 1, occupied: true },
        { id: 'unit-2', name: 'Kennel B', size: 'Medium', count: 2 },
      ],
    },
    state: { isDirty: false, saving: false, supportsUnits: true },
    openSections: { details: true, availability: true, units: true, equipment: true },
    roomTypeLabel: 'ICU',
    totalUnits: 3,
  },
  play: async () => {
    const drawer = findOpenDialogTitled('ICU ward');
    // The units section only has content for ICU/Inpatient/Isolation/Boarding;
    // every other type shows a "select one of these" note instead.
    await expect(within(drawer).getByText('Unit type (2)')).toBeInTheDocument();
    /* Each unit name renders twice on purpose - once as the fieldset's legend
       and again as the "Name" row inside that same fieldset - so this is
       getAllByText. Two fieldsets means two pairs. */
    await expect(within(drawer).getAllByText('Kennel A')).toHaveLength(2);
    await expect(within(drawer).getAllByText('Kennel B')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only room types that carry units are ICU, Inpatient, Isolation and Boarding. Each ' +
          'unit renders as a `<fieldset>` with its name as the legend, which is a different box ' +
          'from every other section in the drawer.',
      },
    },
  },
};
