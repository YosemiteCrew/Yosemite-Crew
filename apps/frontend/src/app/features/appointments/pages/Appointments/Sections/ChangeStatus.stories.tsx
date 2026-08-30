import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Appointment } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import type { Team } from '@/app/features/organization/types/team';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';

import ChangeStatus from './ChangeStatus';

const ORG_ID = 'org-storybook';
const SERVICE_ID = 'service-consult';
const APPOINTMENT_ID = 'appt-requested';
const VET_WEBER = 'vet-weber';
const VET_OSEI = 'vet-osei';
const VET_MARSH = 'vet-marsh';

const BOOKABLE_SLOTS_ENDPOINT = '/fhir/v1/service/bookable-slots';
const ACCEPT_ENDPOINT = `/fhir/v1/appointment/pms/${ORG_ID}/${APPOINTMENT_ID}/accept`;
const NO_LEAD_MESSAGE =
  'No lead is available for this slot. Reschedule the appointment to accept it.';

const member = (id: string, name: string): Team => ({
  _id: `team-${id}`,
  practionerId: id,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

/**
 * Three vets, only two of whom the bookable-slots API reports as free on the
 * appointment's own slot. Dr. Marsh exists purely to prove the lead list is
 * filtered by slot availability and the support list is not.
 */
const TEAM: Team[] = [
  member(VET_WEBER, 'Dr. Weber'),
  member(VET_OSEI, 'Dr. Osei'),
  member(VET_MARSH, 'Dr. Marsh'),
];

/**
 * A UTC literal is the right fixture here, unusually: the slot matcher compares
 * `Date.UTC(...)` built off the appointment's UTC calendar day against the
 * appointment instant itself, both converted through the same preferred-timezone
 * lookup. The two sides cancel out, so '09:00' matches a 09:00Z appointment in
 * every timezone the runner might sit in - and 08:30 / 09:30 miss in every one.
 */
const APPOINTMENT_START = new Date('2027-05-18T09:00:00.000Z');

type SlotWindow = {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  vetIds: string[];
};

const slotWindow = (startTime: string, endTime: string, vetIds: string[]): SlotWindow => ({
  startTime,
  endTime,
  isAvailable: true,
  vetIds,
});

const SLOTS_TWO_VETS: SlotWindow[] = [
  slotWindow('08:30', '09:00', [VET_WEBER]),
  slotWindow('09:00', '09:30', [VET_WEBER, VET_OSEI]),
  slotWindow('09:30', '10:00', [VET_MARSH]),
];

/** The appointment's own slot, with nobody left on it. */
const SLOTS_NO_VET: SlotWindow[] = [slotWindow('09:00', '09:30', [])];

const appointment = (over: Partial<Appointment> = {}): Appointment => ({
  id: APPOINTMENT_ID,
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  supportStaff: [{ id: VET_OSEI, name: 'Dr. Osei' }],
  appointmentType: {
    id: SERVICE_ID,
    name: 'Annual check-up',
    speciality: { id: 'spec-1', name: 'General practice' },
  },
  appointmentKind: 'OUTPATIENT',
  organisationId: ORG_ID,
  appointmentDate: APPOINTMENT_START,
  startTime: APPOINTMENT_START,
  endTime: new Date('2027-05-18T09:30:00.000Z'),
  timeSlot: '09:00 - 09:30',
  durationMinutes: 30,
  status: 'REQUESTED',
  ...over,
});

const REQUESTED = appointment();
const COMPLETED = appointment({ status: 'COMPLETED', lead: { id: VET_WEBER, name: 'Dr. Weber' } });

/**
 * Every request the dialog made, newest last, as `METHOD /path`. Reset by
 * `prepare`, so a play function can assert on an ABSENCE - "the write never went
 * out" is the whole point of the validation stories, and it is invisible from the
 * DOM.
 */
let apiCalls: string[] = [];

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse =>
  ({ data, status: 200, statusText: 'OK', headers: config.headers, config }) as AxiosResponse;

/**
 * Stubs the shared axios instance's ADAPTER rather than the service module.
 * Storybook cannot mock `appointmentService` here, and holding `XMLHttpRequest`
 * (the trick ChangeRoom.stories uses) can only stall or fail a request - these
 * stories need the bookable-slots call to actually RESOLVE, because the lead list
 * is derived from its answer. Everything above the transport is the real code:
 * the component, both stores, `getSlotsForServiceAndDateForPrimaryOrg` and
 * `changeAppointmentStatus` with its accept/reject routing.
 *
 * `save: 'stall'` returns a promise that never settles, which is the only way to
 * hold the saving frame still. It is deliberately not a REJECTION: the service
 * `console.error`s a failed write, and the story verifier reads a console error
 * as a broken story.
 */
const prepare =
  (windows: SlotWindow[], save: 'ok' | 'stall' = 'ok') =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const teamSnapshot = useTeamStore.getState();
    const appointmentSnapshot = useAppointmentStore.getState();
    const originalAdapter = api.defaults.adapter;

    apiCalls = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      const url = String(config.url ?? '');
      apiCalls.push(`${String(config.method ?? 'get').toUpperCase()} ${url}`);
      if (url.includes(BOOKABLE_SLOTS_ENDPOINT)) {
        return Promise.resolve(
          respond(config, {
            success: true,
            data: { date: '2027-05-18', dayOfWeek: 'TUESDAY', windows },
          })
        );
      }
      if (save === 'stall') return new Promise<AxiosResponse>(() => {});
      // An empty envelope: `upsertFromResponse` finds no DTO and falls back to
      // the payload it sent, so no fabricated FHIR is needed to close the write.
      return Promise.resolve(respond(config, { data: {} }));
    }) as AxiosAdapter;

    // Seeding `teamIdsByOrgId` for the org is also what stops `useLoadTeam` from
    // firing its own fetch - it skips any org already present in the map.
    useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
    useTeamStore.setState({
      teamsById: Object.fromEntries(TEAM.map((item) => [item._id, item])),
      teamIdsByOrgId: { [ORG_ID]: TEAM.map((item) => item._id) },
      status: 'loaded',
    });

    return () => {
      api.defaults.adapter = originalAdapter;
      useAppointmentStore.setState(appointmentSnapshot);
      useTeamStore.setState(teamSnapshot);
      useOrgStore.setState(orgSnapshot);
    };
  };

/** ModalBase portals to document.body, so nothing here is inside `canvasElement`. */
const openDialog = () => document.querySelector<HTMLElement>('dialog[open]');

/**
 * The dropdown panels portal to body too, as siblings of the dialog rather than
 * descendants - querying the dialog for options finds nothing and reads as
 * "closed". The LAST one is taken because a panel from an earlier interaction can
 * still be unmounting.
 */
const openMenu = () => {
  const panels = document.querySelectorAll<HTMLElement>('[data-portal-dropdown]');
  return panels.length > 0 ? panels[panels.length - 1] : null;
};

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

const chooseFromMenu = async (label: string) => {
  await waitFor(() => expect(openMenu()).not.toBeNull());
  await userEvent.click(within(openMenu() as HTMLElement).getByRole('button', { name: label }));
};

/**
 * The dialog's fields in DOM order. Keyed on `aria-haspopup` rather than on a
 * label, so the COUNT says how many fields the dialog has - and the lead and
 * support pickers exist only for one status pair, which is the structural thing
 * worth pinning.
 */
const dropdownTriggers = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('button[aria-haspopup="listbox"]'));

const meta = {
  title: 'Appointments/ChangeStatus',
  component: ChangeStatus,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The appointment "Change status" dialog. It is a thin wrapper over the shared ' +
          '`ChangeStatusModal`, and everything it adds is conditional, so a single snapshot of it ' +
          'shows almost nothing: which statuses are even offered, and whether a second and third ' +
          'field appear underneath the picker.\n\n' +
          'The status list is computed from the transition table, not fixed. A requested ' +
          'appointment is offered Requested / Upcoming / Cancelled and nothing else; a completed ' +
          'one is offered only Completed, which is a dialog with no way out of it. That also means ' +
          "the modal's illegal-transition toast is unreachable from this consumer - the dropdown " +
          'never contains a status the table would refuse.\n\n' +
          'Accepting (Requested -> Upcoming) is the branch with real machinery. It asks the ' +
          "bookable-slots API which vets are free on this appointment's own slot and offers only " +
          'those as lead, so the lead list is narrower than the team. The support list is not ' +
          'filtered that way - anyone on the team can assist - and choosing someone as lead pulls ' +
          'them back out of the support selection, because one person cannot be both.\n\n' +
          'When the slot has nobody free the dialog says so twice: once inline under the picker, ' +
          "and again in the modal's own error slot when Update is pressed. Same sentence, two " +
          'places.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    activeAppointment: REQUESTED,
  },
  beforeEach: prepare(SLOTS_TWO_VETS),
} satisfies Meta<typeof ChangeStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RequestedTransitions: Story = {
  name: 'Requested: what it will let you pick',
  play: async () => {
    const panel = await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    await expect(
      panel.getByRole('heading', { level: 2, name: 'Change status' })
    ).toBeInTheDocument();

    /* ONE field. The lead and support pickers hang off the SELECTED status, not
       off the current one, so they are absent until Upcoming is chosen - and a
       stray extra dropdown here is exactly what the accepting stories below
       cannot catch. */
    await expect(dropdownTriggers(dialog)).toHaveLength(1);

    const trigger = panel.getByRole('button', { name: 'Appointment status: Requested' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    /* The whole transition table, rendered. Asserted as an exact list rather than
       as "Completed is missing": the options are filtered from a shared
       `AppointmentStatusOptions` array, so a widened table leaks statuses in
       silently and every one of them looks plausible in the menu. */
    expect(await menuOptionLabels()).toEqual(['Requested', 'Upcoming', 'Cancelled']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dialog as the appointment card opens it. The current status is preselected rather ' +
          "than a placeholder, so the reader's first move is always a change away from where they " +
          'are - and the only two places they can go are Upcoming and Cancelled.',
      },
    },
  },
};

export const AcceptingWithLead: Story = {
  name: 'Accepting: leads narrowed to the slot',
  args: { preferredStatus: 'UPCOMING' },
  play: async () => {
    await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    /* `preferredStatus` is how the card's Accept button opens this dialog: it
       lands on Upcoming, so the lead and support fields are already on screen.
       The order is asserted along with the count - the support picker sitting
       above the lead picker would be a silent layout regression. */
    const triggers = await waitFor(() => {
      const found = dropdownTriggers(dialog);
      expect(found).toHaveLength(3);
      return found;
    });
    await expect(triggers.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Appointment status: Upcoming',
      'Select lead',
      'Select support staff (optional): Dr. Osei',
    ]);

    await userEvent.click(triggers[1]);
    /* Two of the three team members. Dr. Marsh is on the 09:30 window, not on
       this appointment's 09:00 one, and offering her would let the desk accept an
       appointment onto a vet the slots API says is busy. */
    expect(await menuOptionLabels()).toEqual(['Dr. Weber', 'Dr. Osei']);

    await chooseFromMenu('Dr. Osei');
    await waitFor(() =>
      expect(triggers[1].getAttribute('aria-label')).toBe('Select lead: Dr. Osei')
    );

    /* The appointment arrived with Dr. Osei as support. Making her the lead has
       to take her out of that selection, or the write sends the same practitioner
       as both lead and support. Nothing on screen announces the removal, which is
       why it is asserted on the trigger's own accessible name. */
    await waitFor(() =>
      expect(triggers[2].getAttribute('aria-label')).toBe('Select support staff (optional)')
    );

    await userEvent.click(triggers[2]);
    /* And support is NOT narrowed by the slot: Dr. Marsh is offered here even
       though she was withheld as a lead. Only the lead has to be free. */
    expect(await menuOptionLabels()).toEqual(['Dr. Weber', 'Dr. Marsh']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The accept flow. The lead field opens empty rather than guessing, because the ' +
          'appointment was requested without one - and it stays empty if the only lead on record ' +
          'turns out not to be free on the slot.',
      },
    },
  },
};

export const NoLeadForSlot: Story = {
  name: 'No lead free on the slot',
  args: { preferredStatus: 'UPCOMING' },
  beforeEach: prepare(SLOTS_NO_VET),
  play: async () => {
    const panel = await dialogQueries();

    const warning = await panel.findByText(NO_LEAD_MESSAGE);
    await expect(warning.tagName).toBe('P');

    await userEvent.click(panel.getByRole('button', { name: 'Update' }));

    /* The same sentence lands a second time, in the modal's own error slot under
       the fields, because `validateBeforeSave` repeats the inline copy verbatim.
       Worth pinning as a count: it is the kind of duplication a reader reports as
       a bug, and it would otherwise change without anyone noticing. */
    await waitFor(() => expect(panel.getAllByText(NO_LEAD_MESSAGE)).toHaveLength(2));

    /* The assertion that matters. Nothing about the DOM says whether the write
       went out, and an accept sent with no lead is a corrupt appointment the desk
       cannot see. Only the slot lookup may have happened. */
    await expect(apiCalls.some((call) => call.includes('/appointment/'))).toBe(false);
    await expect(apiCalls.every((call) => call.includes(BOOKABLE_SLOTS_ENDPOINT))).toBe(true);

    // The picker itself carries the refusal too, in place of "No options".
    await userEvent.click(panel.getByRole('button', { name: 'Select lead' }));
    await waitFor(() => expect(openMenu()).not.toBeNull());
    await expect(openMenu()).toHaveTextContent('No lead is available for this slot');
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the desk sees when the slot has been filled since the request came in. The dialog ' +
          'does not disable Update - it lets the press happen and then refuses it - so the reader ' +
          'gets the sentence twice and no way forward except Reschedule.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Saving (every field locked)',
  args: { preferredStatus: 'UPCOMING' },
  beforeEach: prepare(SLOTS_TWO_VETS, 'stall'),
  play: async () => {
    const panel = await dialogQueries();

    await userEvent.click(await panel.findByRole('button', { name: 'Select lead' }));
    await chooseFromMenu('Dr. Weber');
    const leadTrigger = await panel.findByRole('button', { name: 'Select lead: Dr. Weber' });

    await userEvent.click(panel.getByRole('button', { name: 'Update' }));

    const saving = await panel.findByRole('button', { name: 'Saving...' });
    await expect(saving).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    /* Requested -> Upcoming is NOT a status PATCH, it is the `accept` action, and
       the two write to different endpoints. Nothing in the dialog distinguishes
       them, so this is the only place the routing is visible. */
    await waitFor(() => expect(apiCalls).toContain(`PATCH ${ACCEPT_ENDPOINT}`));

    /* Both blocks take `pointer-events-none` while the write is out: the status
       picker from the modal, the lead and support fields from this component's
       extra content. Read off the computed style of the controls themselves,
       because inheritance is the part that actually stops the click - and neither
       field is disabled or dimmed, so a locked field looks exactly like a live
       one. */
    await waitFor(() => expect(getComputedStyle(leadTrigger).pointerEvents).toBe('none'));
    const statusTrigger = panel.getByRole('button', { name: 'Appointment status: Upcoming' });
    await expect(getComputedStyle(statusTrigger).pointerEvents).toBe('none');
    await expect(leadTrigger).toBeEnabled();

    // The dialog stays put behind the write - closing is the save's job.
    await expect(openDialog()).not.toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Held open by a request that never settles, which in the app lasts one round trip. Put ' +
          'it beside the accepting story above: apart from the button label the two frames are ' +
          'identical, and yet none of the three fields answers a click here.',
      },
    },
  },
};

export const TerminalStatus: Story = {
  name: 'Completed: nowhere to go',
  args: { activeAppointment: COMPLETED },
  play: async ({ args }) => {
    const panel = await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    const trigger = panel.getByRole('button', { name: 'Appointment status: Completed' });
    await userEvent.click(trigger);
    /* One option, and it is the status the appointment already has. Completed has
       an empty transition list, so the dialog opens as a dead end rather than
       refusing a choice after it is made - which is why the modal's
       illegal-transition toast never fires from this consumer. */
    expect(await menuOptionLabels()).toEqual(['Completed']);
    await chooseFromMenu('Completed');

    // No lead picker either: the extra content is bound to Requested -> Upcoming.
    await expect(dropdownTriggers(dialog)).toHaveLength(1);

    await userEvent.click(panel.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(args.setShowModal).toHaveBeenCalledWith(false));

    /* Nothing at all reached the network - not the write, and not the slot
       lookup, which is gated on the appointment still being Requested. Opening
       this dialog on a finished appointment has to be free. */
    await expect(apiCalls).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The terminal case. Pressing Update on an unchanged status short-circuits before the ' +
          'transition check and before the write, so the dialog simply closes - indistinguishable ' +
          'from a successful save at the call site.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Accepting at 375',
  args: { preferredStatus: 'UPCOMING' },
  /* Selection is a GLOBAL in Storybook 10; the pre-10 `parameters.viewport`
     spelling is inert and a story pinned that way silently renders at full panel
     width. Note the pin only applies in the Storybook UI - a direct `iframe.html`
     load has no manager to resize it - so the assertions below are deliberately
     width-independent rather than measurements that would pass at any size. */
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The accept form at the narrowest width the app supports. Below the `sm` breakpoint ' +
          'CenterModal drops from a fixed 500px box to 90% of the viewport, which leaves roughly ' +
          '313px of content once the padding is off - three full-width 44px fields and a two-button ' +
          'footer that has to stay on one line.',
      },
    },
  },
  play: async () => {
    await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    const triggers = await waitFor(() => {
      const found = dropdownTriggers(dialog);
      expect(found).toHaveLength(3);
      return found;
    });

    /* The design's 44px field height, measured off the border box - the computed
       height reads 41 because these triggers carry a 1.5px border and
       `getComputedStyle` returns the CONTENT box. */
    await expect(triggers.map((item) => Math.round(item.getBoundingClientRect().height))).toEqual([
      44, 44, 44,
    ]);

    // All three span the same content column, and nothing pushes the dialog sideways.
    const widths = triggers.map((item) => Math.round(item.getBoundingClientRect().width));
    await expect(new Set(widths).size).toBe(1);
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + 1);

    // The footer stays a single row: both actions share a top edge.
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const update = within(dialog).getByRole('button', { name: 'Update' });
    await expect(Math.round(cancel.getBoundingClientRect().top)).toBe(
      Math.round(update.getBoundingClientRect().top)
    );
  },
};
