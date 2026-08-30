import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Appointment } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import type { Team } from '@/app/features/organization/types/team';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';

import Reschedule from './Reschedule';

const ORG_ID = 'org-storybook';
const SERVICE_ID = 'service-consult';
const APPOINTMENT_ID = 'appt-reschedule';
const VET_WEBER = 'vet-weber';
const VET_OSEI = 'vet-osei';
const VET_MARSH = 'vet-marsh';

const BOOKABLE_SLOTS_ENDPOINT = '/fhir/v1/service/bookable-slots';
const UPDATE_ENDPOINT = `/fhir/v1/appointment/pms/${ORG_ID}/${APPOINTMENT_ID}`;

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

const TEAM: Team[] = [
  member(VET_WEBER, 'Dr. Weber'),
  member(VET_OSEI, 'Dr. Osei'),
  member(VET_MARSH, 'Dr. Marsh'),
];

/**
 * The 4th of NEXT month, not a hard-coded date. Slotpicker disables every day
 * before today, so a fixed literal quietly turns this dialog into a wall of
 * greyed-out days the moment it goes stale - and the story would still pass.
 * Early in the month on purpose: the strip auto-scrolls the selected day to its
 * centre, and day 4 needs almost none of it.
 */
const nextMonthFourth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 4, 9, 0, 0, 0));
};

const APPOINTMENT_START = nextMonthFourth();
const APPOINTMENT_END = new Date(APPOINTMENT_START.getTime() + 30 * 60_000);

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

/**
 * The first window is the one that matters: the loader auto-selects `slots[0]`,
 * so whoever is on it decides whether the dialog opens clean, opens with an
 * error, or quietly reassigns the lead.
 */
const SLOTS_TWO_VETS: SlotWindow[] = [
  slotWindow('09:00', '09:30', [VET_WEBER, VET_OSEI]),
  slotWindow('09:30', '10:00', [VET_MARSH]),
  slotWindow('10:00', '10:30', [VET_WEBER]),
];

const SLOTS_ONE_VET: SlotWindow[] = [
  slotWindow('09:00', '09:30', [VET_OSEI]),
  slotWindow('09:30', '10:00', [VET_MARSH]),
];

const appointment = (over: Partial<Appointment> = {}): Appointment => ({
  id: APPOINTMENT_ID,
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: VET_WEBER, name: 'Dr. Weber' },
  appointmentType: {
    id: SERVICE_ID,
    name: 'Annual check-up',
    speciality: { id: 'spec-1', name: 'General practice' },
  },
  appointmentKind: 'OUTPATIENT',
  organisationId: ORG_ID,
  appointmentDate: APPOINTMENT_START,
  startTime: APPOINTMENT_START,
  endTime: APPOINTMENT_END,
  timeSlot: '09:00 - 09:30',
  durationMinutes: 30,
  status: 'UPCOMING',
  ...over,
});

const UPCOMING = appointment();

/** Every request the dialog made, as `METHOD /path`. Reset by `prepare`. */
let apiCalls: string[] = [];

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse =>
  ({ data, status: 200, statusText: 'OK', headers: config.headers, config }) as AxiosResponse;

/**
 * Stubs the shared axios instance's adapter. The bookable-slots call has to
 * RESOLVE - the slot strip, the time field and the entire lead list are derived
 * from its answer, so a stalled or failed transport draws an empty dialog and
 * proves nothing. The save resolves into an empty envelope, which
 * `upsertFromResponse` treats as "no DTO came back" and falls through to the
 * payload it sent.
 *
 * A rejection is deliberately not offered: `updateAppointment` `console.error`s a
 * failed write, and the story verifier reads a console error as a broken story.
 */
const prepare = (windows: SlotWindow[]) => () => {
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
        respond(config, { success: true, data: { date: '', dayOfWeek: 'MONDAY', windows } })
      );
    }
    return Promise.resolve(respond(config, { data: {} }));
  }) as AxiosAdapter;

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

/** LabelDropdown portals its panel to body as well - a sibling of the dialog, not a child. */
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

/**
 * Waits for the date strip to stop moving. Slotpicker smooth-scrolls the selected
 * day into the centre on mount, and LabelDropdown dismisses itself on any scroll
 * outside its own panel - so opening the lead picker mid-animation closes it a
 * frame later and the play function reads a real option list as empty.
 */
const settleDateStrip = async (dialog: HTMLElement) => {
  const scrollLeftButton = dialog.querySelector('[aria-label="Scroll dates left"]');
  const strip = scrollLeftButton?.nextElementSibling as HTMLElement | null;
  expect(strip).not.toBeNull();
  let previous = Number.NaN;
  await waitFor(
    () => {
      const current = (strip as HTMLElement).scrollLeft;
      const settled = current === previous;
      previous = current;
      expect(settled).toBe(true);
    },
    { interval: 100 }
  );
};

/** The slot chips, which are the only unlabelled buttons in the picker's slot list. */
const slotChips = (dialog: HTMLElement) => {
  const list = dialog.querySelector<HTMLElement>('.flex-wrap');
  return list ? Array.from(list.querySelectorAll('button')) : [];
};

const dropdownTriggers = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('button[aria-haspopup="listbox"]'));

/**
 * The toasts on screen, read off the container rather than through a text query:
 * the docs page mounts one container per story, so a single `notify` can render
 * more than once and `findByText` would throw on the duplicates.
 */
const toastText = () =>
  [...document.querySelectorAll('.Toastify__toast')]
    .map((node) => node.textContent ?? '')
    .join(' | ');

const meta = {
  title: 'Appointments/Reschedule',
  component: Reschedule,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Reschedule" dialog: a day strip, the slots free on that day, a read-only date and ' +
          'time pair, and a lead picker. None of it is static - the slots come from the ' +
          'bookable-slots API on every day change, and the lead list is recomputed from whichever ' +
          'slot is selected.\n\n' +
          'The dialog does more to the appointment than it looks like it does. It auto-selects the ' +
          'first slot of the day on load, and then reconciles the booked lead against that slot: if ' +
          'exactly one vet is free it silently reassigns the appointment to them, if several are ' +
          'free and the booked one is not among them it clears the lead and asks, and if none is ' +
          'free it throws the slot selection away too. Three different outcomes, none of them ' +
          'requested by the reader, and only the middle one says anything.\n\n' +
          'Validation is per field and lands under the control that failed - except for the ' +
          'duration check, which is computed into the same error object and then never rendered ' +
          'anywhere.\n\n' +
          'Reschedule is also refused outright for anything past Upcoming, and that refusal is a ' +
          'corner toast fired as the dialog closes rather than anything inside it.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <>
        <ToastProvider />
        <Story />
      </>
    ),
  ],
  args: {
    showModal: true,
    setShowModal: fn(),
    activeAppointment: UPCOMING,
  },
  beforeEach: prepare(SLOTS_TWO_VETS),
} satisfies Meta<typeof Reschedule>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Day loaded, booked lead still free',
  play: async () => {
    const panel = await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    await expect(panel.getByRole('heading', { level: 2, name: 'Reschedule' })).toBeInTheDocument();

    // One dropdown, not two: this call site passes `showSupportStaff={false}`, so
    // the shared picker section must not draw its Support field here.
    await waitFor(() => expect(dropdownTriggers(dialog)).toHaveLength(1));
    await expect(panel.queryByText('Support')).not.toBeInTheDocument();

    // Three windows came back, so three chips - and the first is auto-selected.
    await waitFor(() => expect(slotChips(dialog)).toHaveLength(3));

    /* The time field is filled from that auto-selection, and it must not be the
       raw "09:00" the API sent: the slot clock is UTC and the field is the
       reader's own clock. Matching the SHAPE rather than a literal keeps this
       honest wherever the runner sits. */
    const time = panel.getByLabelText('Time') as HTMLInputElement;
    await waitFor(() => expect(time.value).not.toBe(''));
    await expect(time.value).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i);
    await expect(time.value).not.toBe('09:00');
    // Both fields are display-only; the day strip and the chips are the controls.
    await expect(time).toHaveAttribute('readonly');
    await expect(panel.getByLabelText('Date')).toHaveAttribute('readonly');
    await expect(time).toHaveAttribute('aria-invalid', 'false');

    await settleDateStrip(dialog);
    const lead = panel.getByRole('button', { name: 'Lead: Dr. Weber' });
    await userEvent.click(lead);
    /* Only the vets on the SELECTED window. Dr. Marsh is free at 09:30 and is
       correctly absent - offering her would let the desk rebook onto a vet the
       slots API says is busy at 09:00. */
    expect(await menuOptionLabels()).toEqual(['Dr. Weber', 'Dr. Osei']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The healthy open. The booked lead is free on the auto-selected slot, so nothing is ' +
          'reassigned and no message appears - which makes this the frame to compare the other ' +
          'three against.',
      },
    },
  },
};

export const NoSlotsForTheDay: Story = {
  name: 'No slots for the day',
  args: { activeAppointment: appointment({ durationMinutes: 0 }) },
  beforeEach: prepare([]),
  play: async () => {
    const panel = await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    await waitFor(() => expect(slotChips(dialog)).toHaveLength(0));
    await expect(panel.getByText('No slot available')).toBeInTheDocument();
    // Nothing selected means nothing to show, so the time field is blank rather
    // than holding the time the appointment currently has.
    await expect((panel.getByLabelText('Time') as HTMLInputElement).value).toBe('');

    await userEvent.click(panel.getByRole('button', { name: 'Send request' }));

    /* The failure is wired to the Time field, not dropped into a banner: the
       input goes aria-invalid and points at the alert that carries the sentence.
       Both halves matter - a red border with no `aria-describedby` is a failure
       a screen reader never hears. */
    const alert = await panel.findByRole('alert');
    await expect(alert).toHaveTextContent('Please select a slot');
    const time = panel.getByLabelText('Time');
    await expect(time).toHaveAttribute('aria-invalid', 'true');
    await expect(time.getAttribute('aria-describedby')).toBe(alert.id);

    /* This appointment also has no duration, so the reducer holds a SECOND error
       - and there is nowhere on screen for it to go: `formDataErrors.duration` is
       computed on every save and never passed to the picker section. Pinned here
       so the day someone wires it up, this assertion is what tells them. */
    await expect(panel.queryByText('Please select a duration')).not.toBeInTheDocument();
    await expect(panel.getAllByRole('alert')).toHaveLength(1);

    await expect(apiCalls.some((call) => call.startsWith('PATCH'))).toBe(false);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A fully booked day. Send request is never disabled - the dialog takes the press and ' +
          'then refuses it - so the only thing standing between the reader and a confused retry is ' +
          'one line under the Time field.',
      },
    },
  },
};

export const LeadMustBeChosen: Story = {
  name: 'Booked lead is not free: choose again',
  args: { activeAppointment: appointment({ lead: { id: VET_MARSH, name: 'Dr. Marsh' } }) },
  play: async () => {
    const panel = await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    /* Dr. Marsh is not on the auto-selected 09:00 window, so the dialog CLEARS
       the appointment's own lead and asks. The clearing is the silent half: the
       field reads as an untouched placeholder, not as "the vet you booked is
       gone", so the trigger's accessible name is what proves it happened. */
    const lead = await waitFor(() => panel.getByRole('button', { name: 'Lead' }));
    await expect(
      panel.getByText('Multiple leads are available. Please choose a lead.')
    ).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Lead: Dr. Marsh' })).not.toBeInTheDocument();

    await settleDateStrip(dialog);
    await userEvent.click(lead);
    expect(await menuOptionLabels()).toEqual(['Dr. Weber', 'Dr. Osei']);
    await userEvent.click(
      within(openMenu() as HTMLElement).getByRole('button', { name: 'Dr. Osei' })
    );

    await waitFor(() =>
      expect(panel.getByRole('button', { name: 'Lead: Dr. Osei' })).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        panel.queryByText('Multiple leads are available. Please choose a lead.')
      ).not.toBeInTheDocument()
    );

    await userEvent.click(panel.getByRole('button', { name: 'Send request' }));

    /* The write, and its endpoint. Reschedule goes out as a plain appointment
       PATCH rather than through any status action, and nothing in the dialog
       shows which one was used. */
    await waitFor(() => expect(apiCalls).toContain(`PATCH ${UPDATE_ENDPOINT}`));
  },
  parameters: {
    docs: {
      description: {
        story:
          'Several vets are free on the new slot and the booked one is not among them, so the ' +
          'dialog refuses to guess. This is the only one of the three reconciliation outcomes that ' +
          'tells the reader anything.',
      },
    },
  },
};

export const LeadSilentlyReassigned: Story = {
  name: 'One vet free: reassigned without asking',
  beforeEach: prepare(SLOTS_ONE_VET),
  play: async () => {
    const panel = await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    /* The appointment is booked to Dr. Weber. Exactly one vet is free on the
       auto-selected slot, so the dialog swaps the lead to Dr. Osei on its own -
       no prompt, no message, and the reader never touched the field. That silent
       swap is the whole point of this story. */
    await waitFor(() =>
      expect(panel.getByRole('button', { name: 'Lead: Dr. Osei' })).toBeInTheDocument()
    );
    await expect(panel.queryByRole('button', { name: 'Lead: Dr. Weber' })).not.toBeInTheDocument();
    await expect(
      panel.queryByText('Multiple leads are available. Please choose a lead.')
    ).not.toBeInTheDocument();
    await expect(panel.queryAllByRole('alert')).toHaveLength(0);

    await settleDateStrip(dialog);
    await userEvent.click(panel.getByRole('button', { name: 'Lead: Dr. Osei' }));
    // And there is genuinely no one else to pick, so the swap is not reversible here.
    expect(await menuOptionLabels()).toEqual(['Dr. Osei']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The reassignment costs nothing to miss and changes who the client sees. Worth deciding ' +
          'whether a one-vet slot should still say so rather than just filling the field in.',
      },
    },
  },
};

export const RescheduleBlocked: Story = {
  name: 'Blocked by status (toast, dialog closes)',
  args: { activeAppointment: appointment({ status: 'COMPLETED' }) },
  play: async ({ args }) => {
    const panel = await dialogQueries();

    /* The dialog renders in full for a completed appointment - day strip, slots,
       lead - and only refuses at the press. Nothing warns beforehand, which is
       why the refusal is worth a frame of its own. */
    await userEvent.click(panel.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(toastText()).toContain('Reschedule blocked'));
    await expect(toastText()).toContain(
      'Only requested and upcoming appointments can be rescheduled.'
    );

    // It closes on the refusal rather than staying open on the error, so the
    // toast is the only trace - and no write went out.
    await expect(args.setShowModal).toHaveBeenCalledWith(false);
    await expect(apiCalls.some((call) => call.startsWith('PATCH'))).toBe(false);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The guard fires before any validation, so none of the fields ever go red. `allowReschedule` ' +
          'admits only requested and upcoming appointments; everything from checked-in onwards ' +
          'lands here.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'At 375',
  /* Selection is a GLOBAL in Storybook 10 - the pre-10 `parameters.viewport`
     spelling is inert and renders at full panel width while still passing. The
     pin only takes effect in the Storybook UI, so nothing below is a width
     measurement dressed up as a phone assertion. */
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The dialog at the narrowest width the app supports. Below `sm` CenterModal drops from a ' +
          'fixed 500px box to 90% of the viewport, and the date strip, the two half-width fields ' +
          'and the wrapping slot chips all have to survive roughly 313px of content box.',
      },
    },
  },
  play: async () => {
    const panel = await dialogQueries();
    const dialog = openDialog() as HTMLElement;

    await waitFor(() => expect(slotChips(dialog)).toHaveLength(3));

    /* The Date/Time pair is a `grid-cols-2`, so the two must share a row at every
       width and split it evenly - the pair collapsing to one column is the thing
       that would go unnoticed, because each field still looks correct alone. */
    const date = panel.getByLabelText('Date').getBoundingClientRect();
    const time = panel.getByLabelText('Time').getBoundingClientRect();
    await expect(Math.round(date.top)).toBe(Math.round(time.top));
    await expect(Math.round(date.width)).toBe(Math.round(time.width));
    await expect(date.right).toBeLessThanOrEqual(time.left + 1);

    // Design's 44px field height, off the border box - the computed height reads
    // 41 because these carry a 1.5px border and that value is the content box.
    await expect(Math.round(date.height)).toBe(44);
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + 1);
  },
};
