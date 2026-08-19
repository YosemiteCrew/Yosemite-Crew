import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { Appointment, OrganisationRoom, RoomUnit } from '@yosemite-crew/types';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';

import ChangeRoom from './ChangeRoom';

const ORG_ID = 'org-storybook';
const CONSULT_1 = 'room-consult-1';
const CONSULT_2 = 'room-consult-2';
const WARD_A = 'room-ward-a';
const ISOLATION = 'room-isolation';
const UNIT_A1 = 'unit-kennel-a1';
const INPATIENT_APPOINTMENT_ID = 'appt-inpatient';

const room = (id: string, name: string, type: OrganisationRoom['type']): OrganisationRoom => ({
  id,
  name,
  organisationId: ORG_ID,
  code: id.toUpperCase(),
  type,
});

const ROOMS: OrganisationRoom[] = [
  room(CONSULT_1, 'Consult 1', 'CONSULTATION'),
  room(CONSULT_2, 'Consult 2', 'CONSULTATION'),
  room(WARD_A, 'Ward A', 'INPATIENT'),
  room(ISOLATION, 'Isolation', 'ISOLATION'),
];

const unit = (id: string, roomId: string, displayName: string, isOccupied: boolean): RoomUnit => ({
  id,
  organisationId: ORG_ID,
  roomId,
  code: id.toUpperCase(),
  displayName,
  isActive: true,
  isOccupied,
});

/**
 * Occupancy is the whole point of this fixture. A1 is occupied BY THIS PATIENT
 * (it is the encounter's current unit, so it must stay selectable), A2 is occupied
 * by someone else and must not be offered, A3 is free. Isolation's only unit is
 * taken, which is what removes the whole room from an in-patient's room list.
 */
const UNITS: RoomUnit[] = [
  unit(UNIT_A1, WARD_A, 'Kennel A1', true),
  unit('unit-kennel-a2', WARD_A, 'Kennel A2', true),
  unit('unit-kennel-a3', WARD_A, 'Kennel A3', false),
  unit('unit-isolation-1', ISOLATION, 'Isolation 1', true),
];

const appointment = (over: Partial<Appointment>): Appointment => ({
  id: 'appt-outpatient',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'vet-1', name: 'Dr. Weber' },
  room: { id: CONSULT_1, name: 'Consult 1' },
  appointmentType: {
    id: 'type-1',
    name: 'Annual check-up',
    speciality: { id: 'spec-1', name: 'General practice' },
  },
  appointmentKind: 'OUTPATIENT',
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'CHECKED_IN',
  ...over,
});

const OUTPATIENT = appointment({});

const INPATIENT = appointment({
  id: INPATIENT_APPOINTMENT_ID,
  encounterId: 'enc-1',
  appointmentKind: 'INPATIENT',
  room: { id: WARD_A, name: 'Ward A' },
  status: 'IN_PROGRESS',
});

/**
 * ChangeRoom refetches the room list on every open (`force: true`) and PATCHes the
 * appointment on Update, so without this every story would fire real requests out of
 * the preview iframe - and a 401 from a reachable API redirects the whole iframe to
 * /signin, taking the story with it. Axios uses the XHR adapter in a browser, so
 * holding `send` is enough to keep all of it off the wire:
 *
 * - `stalled` never settles. That is what makes the saving state reviewable at all:
 *   it exists only while a request is in flight, which is normally a few frames.
 * - `failing` rejects the way an unreachable API does (no response), which is the
 *   branch that falls back to the generic "Unable to update room" copy.
 *
 * The service module itself is untouched - the component, the store and
 * updateAppointment are all the real ones.
 */
const REAL_XHR_SEND = XMLHttpRequest.prototype.send;

const stubTransport = (mode: 'stalled' | 'failing') => {
  XMLHttpRequest.prototype.send = function stubbedSend(this: XMLHttpRequest) {
    if (mode === 'stalled') return;
    setTimeout(() => this.dispatchEvent(new ProgressEvent('error')), 0);
  };
  // Always restored to the module-level original rather than to whatever was
  // installed before, so a meta-level and a story-level stub cannot strand one
  // whichever order their cleanups run in.
  return () => {
    XMLHttpRequest.prototype.send = REAL_XHR_SEND;
  };
};

const prepare =
  (mode: 'stalled' | 'failing' = 'stalled') =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const roomSnapshot = useOrganisationRoomStore.getState();
    const workspaceSnapshot = useAppointmentWorkspaceStore.getState();
    const restoreTransport = stubTransport(mode);

    useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
    useOrganisationRoomStore.setState({
      roomsById: Object.fromEntries(ROOMS.map((item) => [item.id, item])),
      roomIdsByOrgId: { [ORG_ID]: ROOMS.map((item) => item.id) },
      roomUnitsById: Object.fromEntries(UNITS.map((item) => [item.id, item])),
      roomUnitIdsByRoomId: {
        [WARD_A]: UNITS.filter((item) => item.roomId === WARD_A).map((item) => item.id),
        [ISOLATION]: UNITS.filter((item) => item.roomId === ISOLATION).map((item) => item.id),
      },
      status: 'loaded',
    });

    // The in-patient's current unit lives on the encounter, not on the appointment,
    // and it is read through the store on every render - so it is seeded through the
    // real actions rather than hand-built.
    const workspace = useAppointmentWorkspaceStore.getState();
    workspace.initEncounter(INPATIENT_APPOINTMENT_ID, 'INPATIENT', {
      leadId: 'vet-1',
      leadName: 'Dr. Weber',
    });
    workspace.setRoomUnit(INPATIENT_APPOINTMENT_ID, WARD_A, UNIT_A1);

    return () => {
      restoreTransport();
      useAppointmentWorkspaceStore.setState(workspaceSnapshot);
      useOrganisationRoomStore.setState(roomSnapshot);
      useOrgStore.setState(orgSnapshot);
    };
  };

/** ModalBase portals to document.body, so nothing here is inside `canvasElement`. */
const openDialog = () => document.querySelector<HTMLElement>('dialog[open]');

/**
 * LabelDropdown portals its panel to document.body too - and to body, not into the
 * dialog, so it is not even a descendant of the modal. Querying the dialog for the
 * options finds nothing and passes as "closed".
 */
const openMenu = () => document.querySelector<HTMLElement>('[data-portal-dropdown]');

const dialogQueries = async () => {
  await waitFor(() => expect(openDialog()).not.toBeNull());
  return within(openDialog() as HTMLElement);
};

const menuOptionLabels = async () => {
  await waitFor(() => expect(openMenu()).not.toBeNull());
  return within(openMenu() as HTMLElement)
    .getAllByRole('button')
    .map((option) => option.textContent);
};

/**
 * The dialog's fields, in DOM order. Keyed on `aria-haspopup` rather than on a
 * label, so counting them says how many fields the dialog HAS - which is the one
 * structural difference between the out-patient and in-patient forms.
 */
const dropdownTriggers = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('button[aria-haspopup="listbox"]'));

/** The `saving` wrapper around one LabelDropdown, which is what the flex gap separates. */
const fieldWrapperOf = (trigger: HTMLElement) =>
  trigger.closest<HTMLElement>('div.flex.flex-col.w-full')?.parentElement as HTMLElement;

const meta = {
  title: 'Appointments/ChangeRoom',
  component: ChangeRoom,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Assign room" dialog, opened from the appointment card rail and the calendar ' +
          'context menu. It had no story, so nothing below the header had ever been drawn: not ' +
          'the second dropdown, not the failure line, not the in-flight state.\n\n' +
          'It is two different dialogs depending on `appointmentKind`. An out-patient picks a ' +
          'room and that is the whole form. An in-patient picks a room AND a unit, because the ' +
          'unit is the thing that is actually occupied - it lives on the encounter in the ' +
          'workspace store, not on the appointment, and the assignment is a second request ' +
          '(`assignEncounterUnit`) after the appointment PATCH.\n\n' +
          'Which rooms are offered is derived, and the derivation is easy to get wrong in both ' +
          'directions. For an in-patient a room is dropped when it models units and every one of ' +
          'them is occupied - but the unit the patient is in right now counts as assignable, or ' +
          'the dialog would refuse to show the room the patient is already in. A room with no ' +
          'units modelled at all is always offered, on the assumption that an unmodelled room is ' +
          'not tracked rather than full. The fixtures here have one of each, so the room list ' +
          'is four long for an out-patient and three for an in-patient.\n\n' +
          'Saving locks the form but does not dim it: the two field wrappers only get ' +
          '`pointer-events-none`, while the buttons get the usual disabled 60% - worth a look ' +
          'side by side, since a locked-but-bright field reads as interactive.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    activeAppointment: OUTPATIENT,
  },
  beforeEach: prepare(),
} satisfies Meta<typeof ChangeRoom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outpatient: Story = {
  name: 'Out-patient (room only)',
  play: async () => {
    const panel = await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    await expect(panel.getByRole('heading', { name: 'Assign room' })).toBeInTheDocument();

    /* ONE field, not two, and the assertion is the count rather than the absence
       of a label: the unit picker is in-patient-only, and a stray second
       dropdown is the exact regression the in-patient story cannot catch. */
    const triggers = dropdownTriggers(dialog);
    await expect(triggers.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Select room: Consult 1',
    ]);
    // The trigger paints the room NAME, not the id it is keyed on.
    await expect(triggers[0]).toHaveTextContent('Consult 1');
    await expect(panel.queryByText('Select unit')).not.toBeInTheDocument();

    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    await expect(panel.getByRole('button', { name: 'Update' })).toBeEnabled();
    // The baseline for the saving story: nothing is locked at rest.
    await expect(getComputedStyle(triggers[0]).pointerEvents).toBe('auto');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dialog as it opens on a checked-in out-patient. Nothing here is a placeholder: ' +
          'the trigger is pre-filled from `activeAppointment.room`, so the assigned room is the ' +
          'selected value rather than an empty field - reassigning is a change, never a first choice.',
      },
    },
  },
};

export const OutpatientRoomMenu: Story = {
  name: 'Out-patient: room menu open',
  play: async () => {
    const panel = await dialogQueries();
    const trigger = panel.getByRole('button', { name: 'Select room: Consult 1' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // All four rooms, in store order: an out-patient assignment ignores units
    // entirely, so Isolation is offered here even though its only unit is taken.
    expect(await menuOptionLabels()).toEqual(['Consult 1', 'Consult 2', 'Ward A', 'Isolation']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The menu is portalled to `document.body` and positioned from the trigger rect, which ' +
          'is why the modal has to whitelist `[data-portal-dropdown]` in its outside-click check ' +
          '- without that, choosing a room would dismiss the dialog underneath it.',
      },
    },
  },
};

export const Inpatient: Story = {
  name: 'In-patient (room and unit)',
  args: { activeAppointment: INPATIENT },
  play: async () => {
    await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    /* Two fields, in this order, both carrying a RESOLVED value. If the
       encounter seed is missing, the second trigger reads a bare "Select unit"
       and the story still renders a plausible dialog - which is precisely the
       silent case, so the labels are asserted rather than the elements. */
    const triggers = dropdownTriggers(dialog);
    await expect(triggers.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Select room: Ward A',
      'Select unit: Kennel A1',
    ]);
    await expect(triggers.map((item) => item.textContent)).toEqual(['Ward A', 'Kennel A1']);

    /* The design's 44px field height and 16px stack gap, measured off the border
       box. `getComputedStyle().height` reads 41 here, not 44: these triggers
       carry a 1.5px border, and the computed value is the CONTENT box. */
    await expect(triggers.map((item) => Math.round(item.getBoundingClientRect().height))).toEqual([
      44, 44,
    ]);
    const [roomField, unitField] = triggers.map(fieldWrapperOf);
    const gap = unitField.getBoundingClientRect().top - roomField.getBoundingClientRect().bottom;
    await expect(Math.round(gap)).toBe(16);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both fields stack at the same 44px height with a 16px gap, asserted here off the ' +
          "border box. The unit label is the unit's `displayName`, falling back to its `code` - " +
          'a unit created without a display name shows as "WARD-A-03" rather than blank.',
      },
    },
  },
};

export const InpatientUnitMenu: Story = {
  name: 'In-patient: unit menu open',
  args: { activeAppointment: INPATIENT },
  play: async () => {
    const panel = await dialogQueries();

    await userEvent.click(panel.getByRole('button', { name: 'Select unit: Kennel A1' }));

    /* Two of the ward's three units. A2 is occupied by another patient and is
       gone; A1 is occupied too - by this patient - and survives because it is the
       encounter's current unit. Drop that exception and the dialog stops offering
       the unit the animal is lying in. */
    expect(await menuOptionLabels()).toEqual(['Kennel A1', 'Kennel A3']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The unit list is recomputed from the selected room, so changing the room above resets ' +
          'this to the first assignable unit in the new room rather than leaving a stale one selected.',
      },
    },
  },
};

export const InpatientRoomMenu: Story = {
  name: 'In-patient: room menu drops full rooms',
  args: { activeAppointment: INPATIENT },
  play: async () => {
    const panel = await dialogQueries();

    await userEvent.click(panel.getByRole('button', { name: 'Select room: Ward A' }));

    const labels = await menuOptionLabels();
    // Three, not four: Isolation models one unit and it is occupied by someone else.
    await expect(labels).toEqual(['Consult 1', 'Consult 2', 'Ward A']);
    await expect(labels).not.toContain('Isolation');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The two consult rooms model no units at all and are still offered: an unmodelled room ' +
          'is treated as untracked, not as full. Only a room that declares units and has none ' +
          'free is withheld.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Saving (fields locked)',
  play: async () => {
    const panel = await dialogQueries();

    await userEvent.click(panel.getByRole('button', { name: 'Select room: Consult 1' }));
    await waitFor(() => expect(openMenu()).not.toBeNull());
    await userEvent.click(
      within(openMenu() as HTMLElement).getByRole('button', { name: 'Consult 2' })
    );
    // Saving short-circuits when nothing changed, so the room has to actually move.
    const trigger = panel.getByRole('button', { name: 'Select room: Consult 2' });
    await expect(trigger).toBeInTheDocument();

    await userEvent.click(panel.getByRole('button', { name: 'Update' }));

    const update = await panel.findByRole('button', { name: 'Saving...' });
    await expect(update).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    /* `pointer-events` is inherited, so reading it off the trigger proves the
       wrapper's lock actually reached the control - which is the only thing that
       stops a second room being chosen mid-save, since the dropdown itself is
       never disabled and still looks live. */
    await waitFor(() => {
      expect(getComputedStyle(trigger).pointerEvents).toBe('none');
    });
    await expect(
      panel.queryByText('Unable to update room. Please try again.')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Held open by stalling the request. In the app this window is a few hundred ' +
          'milliseconds, which is long enough to double-submit and far too short to review - the ' +
          'reason the label change (Update -> Saving...) and the field lock had never been seen ' +
          'together.',
      },
    },
  },
};

export const SaveFailure: Story = {
  name: 'Save failed',
  beforeEach: prepare('failing'),
  play: async () => {
    const panel = await dialogQueries();

    await userEvent.click(panel.getByRole('button', { name: 'Select room: Consult 1' }));
    await waitFor(() => expect(openMenu()).not.toBeNull());
    await userEvent.click(
      within(openMenu() as HTMLElement).getByRole('button', { name: 'Consult 2' })
    );

    await userEvent.click(panel.getByRole('button', { name: 'Update' }));

    /* The generic copy, not the API's. A transport failure carries no response
       body, so the `response.data.message` path cannot fire and this fallback is
       the only thing the user sees - the sentence itself is the surface. */
    expect(await panel.findByText('Unable to update room. Please try again.')).toBeInTheDocument();

    /* Still open, and asserted against `dialog[open]` rather than against the
       node: ModalBase leaves a dismissed dialog MOUNTED and only drops the
       `open` attribute, so querying for the element finds a closed dialog and
       reads as success. */
    await expect(openDialog()).not.toBeNull();

    // Both actions come back, so a retry is one click away.
    await expect(panel.getByRole('button', { name: 'Update' })).toBeEnabled();
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    await expect(panel.queryByRole('button', { name: 'Saving...' })).not.toBeInTheDocument();
    // The chosen room is kept, not rolled back to the appointment's current room.
    await expect(panel.getByRole('button', { name: 'Select room: Consult 2' })).toBeInTheDocument();
    // Exactly one error line, not one per attempt.
    await expect(panel.getAllByText('Unable to update room. Please try again.')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The error is a plain line under the fields, above the buttons, in `--danger-text`. It ' +
          'is cleared on the next attempt and on cancel, so it never outlives the request that ' +
          'produced it.',
      },
    },
  },
};

export const InpatientOnPhone: Story = {
  name: 'In-patient at 375',
  args: { activeAppointment: INPATIENT },
  /* Storybook 10 removed the pre-10 viewport parameters. They are not errors,
     they are INERT - a story pinned the old way renders at the full panel width
     and its play function still passes, proving nothing. Selection is a GLOBAL,
     and the value has to name a key registered in `.storybook/preview.ts`. */
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    /* Guards the pin itself before anything is measured. CenterModal is
       `w-[90%] sm:w-[500px]`, so every assertion below only describes the phone
       branch while the viewport is under the 640px `sm` breakpoint. If the pin
       ever goes inert this fails here instead of quietly measuring the desktop
       dialog and calling it a phone. */
    await waitFor(() => expect(globalThis.window.innerWidth).toBeLessThan(640));

    const dialogWidth = dialog.getBoundingClientRect().width;
    await expect(dialogWidth).toBeLessThan(400);
    await expect(dialogWidth).toBeGreaterThan(300);

    /* The footer is `flex-wrap` with two `min-w-[120px]` actions. 248px of
       button inside a ~313px content box still fits on one line, so the two
       share a row rather than stacking - the thing worth checking at the
       narrowest width the app supports. */
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const update = within(dialog).getByRole('button', { name: 'Update' });
    await expect(Math.round(cancel.getBoundingClientRect().top)).toBe(
      Math.round(update.getBoundingClientRect().top)
    );

    // Both fields still span the dialog, and nothing pushes it sideways.
    const triggers = dropdownTriggers(dialog);
    await expect(triggers).toHaveLength(2);
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + 1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same in-patient dialog at 375. It is the only width where the modal is not a fixed ' +
          '500px box: below `sm` it takes 90% of the viewport, which leaves roughly 313px of ' +
          'content once the 12px padding is off. Worth looking at whether the two 120px actions ' +
          'and the two full-width fields still read as a form at that size.',
      },
    },
  },
};
