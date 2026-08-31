import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, Service, Speciality } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import type { Team } from '@/app/features/organization/types/team';
import type { BillingCounter, BillingSubscription } from '@/app/features/billing/types/billing';
import type {
  CompanionParent,
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import { useCounterStore } from '@/app/stores/counterStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useServiceStore } from '@/app/stores/serviceStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTeamStore } from '@/app/stores/teamStore';

import BookAppointment from './BookAppointment';

const ORG_ID = 'org-book-appointment-story';
const SPECIALITY_ID = 'spec-general';
const SERVICE_ID = 'svc-annual';
const VET_WEBER = 'vet-weber';
const VET_OSEI = 'vet-osei';
const VET_MARSH = 'vet-marsh';

const BOOKABLE_SLOTS_ENDPOINT = '/fhir/v1/service/bookable-slots';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary',
  type: 'BOARDER',
  phoneNo: '+49 30 555 0134',
  taxId: 'TAX-0001',
};

const COMPANION: StoredCompanion = {
  id: 'companion-1',
  organisationId: ORG_ID,
  parentId: 'parent-1',
  name: 'Poppy',
  type: 'dog',
  breed: 'Beagle',
  // Local-time constructor, never a UTC literal: a `...T00:00:00.000Z` fixture
  // slides a day either side of the runner's offset.
  dateOfBirth: new Date(2021, 3, 18),
  gender: 'female',
  isneutered: true,
  isInsured: false,
  status: 'active',
};

const PARENT: StoredParent = {
  id: 'parent-1',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  phoneNumber: '+49 30 901820',
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

const ACTIVE_COMPANION: CompanionParent = { companion: COMPANION, parent: PARENT };

const SPECIALITY: Speciality = {
  _id: SPECIALITY_ID,
  organisationId: ORG_ID,
  name: 'General practice',
  isActive: true,
};

/**
 * A legacy `useServiceStore` entry rather than a revamp-catalogue one. The hook
 * merges both sources, and the revamp side is fetched over the network the
 * moment a speciality is picked - so the catalogue is marked already-loaded in
 * `prepare` below and the legacy row is the only service on offer.
 */
const SERVICE: Service = {
  id: SERVICE_ID,
  organisationId: ORG_ID,
  name: 'Annual check-up',
  description: 'Nose-to-tail examination with vaccination review.',
  durationMinutes: 30,
  cost: 82,
  maxDiscount: 12,
  specialityId: SPECIALITY_ID,
  isActive: true,
};

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

type SlotWindow = {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  vetIds: string[];
};

/**
 * Two vets on the first window on purpose. `useAppointmentForm` auto-assigns the
 * lead when exactly ONE vet is free on the selected slot, so a single-vet first
 * window would silently fill the Lead field and hide the choice this drawer is
 * supposed to offer.
 */
const SLOT_WINDOWS: SlotWindow[] = [
  { startTime: '09:00', endTime: '09:30', isAvailable: true, vetIds: [VET_WEBER, VET_OSEI] },
  { startTime: '09:30', endTime: '10:00', isAvailable: true, vetIds: [VET_MARSH] },
  { startTime: '10:00', endTime: '10:30', isAvailable: true, vetIds: [VET_WEBER] },
];

const subscription = (over: Partial<BillingSubscription> = {}): BillingSubscription => ({
  orgId: ORG_ID,
  plan: 'business',
  currency: 'USD',
  subscriptionStatus: 'active',
  ...over,
});

const counter = (over: Partial<BillingCounter> = {}): BillingCounter => ({
  orgId: ORG_ID,
  freeAppointmentsLimit: 50,
  appointmentsUsed: 3,
  ...over,
});

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse =>
  ({ data, status: 200, statusText: 'OK', headers: config.headers, config }) as AxiosResponse;

type PrepareOptions = {
  /** Omit to leave the org with no subscription at all, which is its own branch. */
  billing?: { subscription: BillingSubscription; counter: BillingCounter } | null;
};

/**
 * Everything `useAppointmentForm` reads, seeded in one place.
 *
 * The hook is the whole engine behind this drawer and it cannot be module-mocked
 * in this Storybook, so each of its inputs is supplied through the real store or
 * the real transport instead:
 *
 * - the shared axios adapter answers `bookable-slots` with `SLOT_WINDOWS` and
 *   every other request with an empty envelope, so nothing reaches the network
 *   and no service logs a console error the verifier would read as a break;
 * - `loadedSpecialityIds` is pre-stamped so `loadSpecialityCatalog` returns
 *   without fetching when a speciality is picked;
 * - billing decides the footer error, because `validateForm` writes
 *   `errors.booking` from `useCanMoreForPrimaryOrg` before it looks at a field.
 */
const prepare =
  ({ billing = { subscription: subscription(), counter: counter() } }: PrepareOptions = {}) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const teamSnapshot = useTeamStore.getState();
    const specialitySnapshot = useSpecialityStore.getState();
    const serviceSnapshot = useServiceStore.getState();
    const catalogSnapshot = useRevampCatalogStore.getState();
    const subscriptionSnapshot = useSubscriptionStore.getState();
    const counterSnapshot = useCounterStore.getState();
    const originalAdapter = api.defaults.adapter;

    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (String(config.url ?? '').includes(BOOKABLE_SLOTS_ENDPOINT)) {
        return Promise.resolve(
          respond(config, {
            success: true,
            data: { date: '', dayOfWeek: 'MONDAY', windows: SLOT_WINDOWS },
          })
        );
      }
      return Promise.resolve(respond(config, { data: {} }));
    }) as AxiosAdapter;

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: ORG },
      status: 'loaded',
    });
    useTeamStore.setState({
      teamsById: Object.fromEntries(TEAM.map((item) => [item._id, item])),
      teamIdsByOrgId: { [ORG_ID]: TEAM.map((item) => item._id) },
      status: 'loaded',
    });
    useSpecialityStore.setState({
      specialitiesById: { [SPECIALITY_ID]: SPECIALITY },
      specialityIdsByOrgId: { [ORG_ID]: [SPECIALITY_ID] },
      status: 'loaded',
    });
    useServiceStore.setState({
      servicesById: { [SERVICE_ID]: SERVICE },
      serviceIdsByOrgId: { [ORG_ID]: [SERVICE_ID] },
      serviceIdsBySpecialityId: { [SPECIALITY_ID]: [SERVICE_ID] },
    });
    useRevampCatalogStore.setState({
      services: [],
      packages: [],
      loadedSpecialityIds: [`${SPECIALITY_ID}:active`],
    });
    useSubscriptionStore.setState({
      subscriptionByOrgId: billing ? { [ORG_ID]: billing.subscription } : {},
      status: 'loaded',
    });
    useCounterStore.setState({
      countersByOrgId: billing ? { [ORG_ID]: billing.counter } : {},
      status: 'loaded',
    });

    return () => {
      api.defaults.adapter = originalAdapter;
      useCounterStore.setState(counterSnapshot);
      useSubscriptionStore.setState(subscriptionSnapshot);
      useRevampCatalogStore.setState(catalogSnapshot);
      useServiceStore.setState(serviceSnapshot);
      useSpecialityStore.setState(specialitySnapshot);
      useTeamStore.setState(teamSnapshot);
      useOrgStore.setState(orgSnapshot);
    };
  };

/** `ModalBase` portals to document.body, so nothing here lives in `canvasElement`. */
const openDialog = (): HTMLElement | null =>
  globalThis.document.querySelector('dialog[open]') as HTMLElement | null;

const liveDialog = async (): Promise<HTMLElement> =>
  waitFor(() => {
    const dialog = openDialog();
    expect(dialog).not.toBeNull();
    return dialog as HTMLElement;
  });

/** Every `LabelDropdown` / `MultiSelectDropdown` trigger currently mounted. */
const listboxTriggers = (root: HTMLElement): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('[aria-haspopup="listbox"]'),
];

const triggerNames = (root: HTMLElement): string[] =>
  listboxTriggers(root).map((node) => (node.getAttribute('aria-label') ?? '').split(':')[0].trim());

/**
 * The option panel. Both dropdown flavours `createPortal` it onto document.body,
 * so it is a sibling of the dialog rather than a descendant; the LAST one is
 * taken because a panel an earlier story left open is still in the body.
 */
const openPanel = async (trigger: HTMLElement): Promise<HTMLElement> => {
  await userEvent.click(trigger);
  return waitFor(() => {
    const panels = globalThis.document.querySelectorAll<HTMLElement>('[data-portal-dropdown]');
    expect(panels.length).toBeGreaterThan(0);
    return panels[panels.length - 1];
  });
};

const expand = async (dialog: HTMLElement, title: string) => {
  const header = within(dialog).getByRole('button', { name: title });
  if (header.getAttribute('aria-expanded') !== 'true') await userEvent.click(header);
  await waitFor(() => expect(header).toHaveAttribute('aria-expanded', 'true'));
};

const chooseFromDropdown = async (dialog: HTMLElement, placeholder: string, option: string) => {
  const trigger = within(dialog).getByRole('button', { name: placeholder });
  const panel = await openPanel(trigger);
  await userEvent.click(within(panel).getByRole('button', { name: option }));
  await waitFor(() =>
    expect(
      within(dialog).getByRole('button', { name: `${placeholder}: ${option}` })
    ).toBeInTheDocument()
  );
};

/** The Slotpicker's three sibling blocks, read off the DOM order they render in. */
const slotpickerParts = (dialog: HTMLElement) => {
  const scrollLeft = dialog.querySelector<HTMLElement>('[aria-label="Scroll dates left"]');
  if (!scrollLeft) throw new Error('the Slotpicker is not mounted');
  const strip = scrollLeft.nextElementSibling as HTMLElement;
  const stripRow = strip.parentElement as HTMLElement;
  return { strip, slotList: stripRow.nextElementSibling as HTMLElement };
};

/**
 * Waits for the date strip to stop moving. Slotpicker smooth-scrolls the selected
 * day into the centre, and LabelDropdown dismisses itself on any scroll outside
 * its own panel - so opening the Lead picker mid-animation closes it a frame
 * later and the play function reads a real option list as empty.
 */
const settleDateStrip = async (strip: HTMLElement) => {
  let previous = Number.NaN;
  await waitFor(
    () => {
      const current = strip.scrollLeft;
      const settled = current === previous;
      previous = current;
      expect(settled).toBe(true);
    },
    { interval: 100 }
  );
};

/**
 * Picks the 15th of NEXT month. Not today: the slot loader drops every window
 * that has already started when the selected day IS today, so a story that
 * asserted a chip count on today would pass in the morning and fail after lunch.
 */
const selectFutureDay = async (dialog: HTMLElement) => {
  await userEvent.click(within(dialog).getByRole('button', { name: 'Next month' }));
  const { strip } = slotpickerParts(dialog);
  const days = [...strip.querySelectorAll('button')];
  const fifteenth = days[14];
  await expect(fifteenth).toBeEnabled();
  await userEvent.click(fifteenth);
};

const meta = {
  title: 'Companions/BookAppointment',
  component: BookAppointment,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Add appointment" drawer opened from a companion row. It is a 530px `Modal` drawer ' +
          'over five composed sections, and none of it had ever been drawn.\n\n' +
          '**It opens almost entirely collapsed.** Only the companion accordion passes ' +
          '`defaultOpen`; "Appointment details", "Select date & time" and "Billable services" all ' +
          "fall through to `Accordion`'s `defaultOpen = false`, and a closed `Accordion` does not " +
          "render its children at all. So the drawer's resting state contains zero form controls " +
          '- the reader has to open three sections before they can answer anything.\n\n' +
          '**That turns validation into a trap.** Pressing "Book appointment" fills ' +
          '`formDataErrors`, but the speciality, service, slot and lead messages are all inside ' +
          'sections that are still shut, so they are not merely off-screen, they are absent from ' +
          'the DOM. The only thing that moves is the footer strip, which carries the ' +
          '**booking-level** error rather than any field.\n\n' +
          '**Two of the computed errors have no home at all.** `validateForm` writes ' +
          '`errors.concern` ("Please describe the concern") and `errors.duration` ("Please select ' +
          'a duration"), but the drawer passes no `concernError` to `AppointmentDetailsSection` ' +
          'and renders nothing for duration - so those two are unreachable at every width, with ' +
          'every section open.\n\n' +
          '**The footer error is a billing check.** It is written before any field is inspected: ' +
          'no subscription on the org produces "We couldn\'t verify your booking limit right now", ' +
          'and a free plan at its limit produces the upgrade sentence. Both are drawn below.\n\n' +
          'The one thing the drawer fills in for itself is the companion: an effect stamps the ' +
          'row it was opened from onto the form, which is why the header accordion is titled and ' +
          'open while everything under it is empty. `handleCreate` is deliberately never reached ' +
          'in these stories - it posts a real appointment - so every submit below is steered ' +
          'through a validation failure.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    activeCompanion: ACTIVE_COMPANION,
  },
  beforeEach: prepare(),
} satisfies Meta<typeof BookAppointment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {
  name: 'Open on a companion record',
  play: async () => {
    const dialog = await liveDialog();
    const panel = within(dialog);

    await expect(panel.getByRole('heading', { level: 2, name: 'Add appointment' })).toBeVisible();

    /* The panel has a visible title and no programmatic one. `ModalHeader` takes
       a `titleId` and `Modal` forwards `aria-labelledby`, and this caller passes
       neither - so the dialog is announced as an unnamed dialog. Pinned rather
       than fixed here, because fixing it belongs in the component. */
    await expect(dialog.getAttribute('aria-label')).toBeNull();
    await expect(dialog.getAttribute('aria-labelledby')).toBeNull();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    /* Companion first, already open and titled by the shared name formatter -
       companion, a middle dot, the owner's LAST name. Not "Poppy (Hartmann)" and
       not the first name: every other companion surface uses this exact form. */
    const companionSection = panel.getByRole('button', { name: 'Poppy · Hartmann' });
    await expect(companionSection).toHaveAttribute('aria-expanded', 'true');

    /* Four read-only rows, and the species one prints the RAW enum. The
       directory table title-cases the same field through `SPECIES_LABEL`, so the
       drawer says "dog" where the row it was opened from says "Dog". */
    for (const [label, value] of [
      ['Name', 'Poppy'],
      ['Parent name', 'Lena'],
      ['Breed', 'Beagle'],
      ['Species', 'dog'],
    ]) {
      const row = panel.getByText(label).parentElement as HTMLElement;
      await expect(row.textContent).toBe(`${label}${value}`);
    }
    // Parent name is the FIRST name only, so the accordion title (last name) and
    // the row inside it (first name) never agree.
    await expect(panel.queryByText('Hartmann', { exact: true })).not.toBeInTheDocument();

    /* The other three sections are shut, and a shut Accordion renders no
       children - so the drawer's resting state has no field in it whatsoever.
       Counting the dropdown triggers is the durable version of that: all four
       (Speciality, Services / Packages, Lead, Support) live inside those
       sections. */
    for (const title of ['Appointment details', 'Select date & time', 'Billable services']) {
      await expect(panel.getByRole('button', { name: title })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
    }
    await expect(listboxTriggers(dialog)).toHaveLength(0);
    await expect(panel.queryByRole('textbox')).not.toBeInTheDocument();

    // Every section is handed `isEditing` with `showEditIcon={false}`, so no
    // pencil is offered for a mode these sections do not have.
    await expect(panel.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();

    // The emergency checkbox and the CTA are the only two controls outside the
    // accordions, and `href="#"` collapses to a real <button> in BaseButton.
    await expect(panel.getByRole('checkbox')).not.toBeChecked();
    await expect(panel.getByRole('button', { name: 'Book appointment' }).tagName).toBe('BUTTON');

    // 530px: the drawer default (`lg`), not the 470px `md` the task drawer uses.
    // Border box, so getBoundingClientRect - the computed width reads 529.
    await expect(Math.round(dialog.getBoundingClientRect().width)).toBe(530);
  },
};

export const SubmitWithEverythingCollapsed: Story = {
  name: 'Submit with the sections shut',
  beforeEach: prepare({ billing: null }),
  play: async () => {
    const dialog = await liveDialog();
    const panel = within(dialog);

    await userEvent.click(panel.getByRole('button', { name: 'Book appointment' }));

    /* The billing sentence, not a field message. `validateForm` writes
       `errors.booking` from `useCanMoreForPrimaryOrg` before it inspects a single
       field, and with no subscription on the org the reason is `no_subscription`
       rather than `limit_reached` - which is the wording below. */
    const strip = await panel.findByText(
      "We couldn't verify your booking limit right now. Please try again."
    );
    await expect(strip).toBeVisible();

    /* And it is the ONLY thing that moved. Speciality, service, slot and lead all
       failed too, but their messages render inside accordions that are still
       shut, and a shut Accordion does not render its children - so they are
       absent from the DOM rather than merely below the fold. */
    for (const message of [
      'Please select a speciality',
      'Please select a service',
      'Please select a slot',
    ]) {
      await expect(panel.queryByText(message)).not.toBeInTheDocument();
    }
    for (const title of ['Appointment details', 'Select date & time']) {
      await expect(panel.getByRole('button', { name: title })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
    }

    /* Opening the section is what surfaces them - a second press is not needed,
       because the errors were already in state. */
    await expand(dialog, 'Appointment details');
    await expect(await panel.findByText('Please select a speciality')).toBeVisible();
    await expect(panel.getByText('Please select a service')).toBeVisible();

    /* Two computed errors have nowhere to go. The concern message is never passed
       down (`AppointmentDetailsSection` takes a `concernError` this caller omits)
       and the duration message is not rendered anywhere at all, so a reader who
       fixes everything visible can still be refused with nothing new on screen. */
    await expect(panel.getByRole('textbox', { name: 'Describe concern' })).toHaveValue('');
    await expect(panel.queryByText('Please describe the concern')).not.toBeInTheDocument();
    await expect(panel.queryByText('Please select a duration')).not.toBeInTheDocument();
  },
};

export const FreeLimitReached: Story = {
  name: 'Free appointment limit reached',
  beforeEach: prepare({
    billing: {
      subscription: subscription({ plan: 'free' }),
      counter: counter({ freeAppointmentsLimit: 20, appointmentsUsed: 20 }),
    },
  }),
  play: async () => {
    const dialog = await liveDialog();
    const panel = within(dialog);

    await userEvent.click(panel.getByRole('button', { name: 'Book appointment' }));

    /* The second of the two booking sentences. Same slot, same strip, different
       reason - and the only difference upstream is the counter, so this is the
       assertion that keeps `limit_reached` from silently collapsing into the
       generic "couldn't verify" wording. */
    await expect(
      await panel.findByText(
        "You've reached your free appointment limit. Please upgrade to book more."
      )
    ).toBeVisible();
    await expect(
      panel.queryByText("We couldn't verify your booking limit right now. Please try again.")
    ).not.toBeInTheDocument();

    // The drawer stays open on a refused booking, so the press can be repeated
    // once the plan is upgraded.
    await expect(openDialog()).not.toBeNull();
  },
};

export const ServiceChosen: Story = {
  name: 'Speciality and service chosen',
  play: async () => {
    const dialog = await liveDialog();
    const panel = within(dialog);

    await expand(dialog, 'Appointment details');
    /* Two dropdowns here and two more further down, all four sharing the same
       trigger shape - so they are read off `aria-label`, which `LabelDropdown`
       writes as "<placeholder>: <selection>" once answered. */
    await expect(triggerNames(dialog)).toEqual(['Speciality', 'Services / Packages']);

    await chooseFromDropdown(dialog, 'Speciality', 'General practice');
    await chooseFromDropdown(dialog, 'Services / Packages', 'Annual check-up');

    /* "Billable services" is the section that answers itself. Before a service is
       picked it holds one sentence; after, it holds the catalogue figures for the
       chosen service, which is the only place the desk sees the price it is about
       to commit the parent to. */
    await expand(dialog, 'Billable services');
    await expect(await panel.findByRole('button', { name: 'Annual check-up' })).toBeInTheDocument();
    for (const [label, value] of [
      ['Duration (mins)', '30'],
      // The currency comes from the subscription, not from a hard-coded '$'.
      ['Cost (USD)', '82'],
      ['Max discount', '12'],
    ]) {
      const row = panel.getByText(label).parentElement as HTMLElement;
      await expect(row.textContent).toBe(`${label}${value}`);
    }
    await expect(
      panel.queryByText('Select a service to view billable details.')
    ).not.toBeInTheDocument();
  },
};

export const SlotAndLead: Story = {
  name: 'A slot picked, leads scoped to it',
  play: async () => {
    const dialog = await liveDialog();
    const panel = within(dialog);

    await expand(dialog, 'Appointment details');
    await chooseFromDropdown(dialog, 'Speciality', 'General practice');
    await chooseFromDropdown(dialog, 'Services / Packages', 'Annual check-up');
    await expand(dialog, 'Select date & time');

    // Support is drawn here. Reschedule passes `showSupportStaff={false}` to the
    // same shared section, so this call site is the one that keeps it.
    await expect(triggerNames(dialog)).toEqual([
      'Speciality',
      'Services / Packages',
      'Lead',
      'Support',
    ]);

    await selectFutureDay(dialog);

    /* Three windows came back, so three chips - and `getNextSelectedSlot` selects
       the first of them, because the day click cleared the previous selection. */
    const { strip, slotList } = slotpickerParts(dialog);
    await waitFor(() => expect(slotList.querySelectorAll('button')).toHaveLength(3));
    await expect(panel.queryByText('No slot available')).not.toBeInTheDocument();

    /* The Time field fills from that auto-selection, and it must not be the raw
       "09:00" the API sent: the slot clock is UTC and the field is the reader's
       own. Matching the SHAPE keeps this honest wherever the runner sits. */
    const time = panel.getByLabelText('Time') as HTMLInputElement;
    await waitFor(() => expect(time.value).not.toBe(''));
    await expect(time.value).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i);
    await expect(time.value).not.toBe('09:00');
    // Both fields are display-only; the strip and the chips are the controls.
    await expect(time).toHaveAttribute('readonly');
    await expect(panel.getByLabelText('Date')).toHaveAttribute('readonly');

    await settleDateStrip(strip);

    /* Only the vets free on the SELECTED window. Dr. Marsh is free at 09:30 and
       is correctly absent - offering her would let the desk book a vet the slots
       API says is busy at 09:00. */
    const leadPanel = await openPanel(within(dialog).getByRole('button', { name: 'Lead' }));
    await expect(
      within(leadPanel)
        .getAllByRole('button')
        .map((option) => option.textContent)
    ).toEqual(['Dr. Weber', 'Dr. Osei']);
    await userEvent.click(within(leadPanel).getByRole('button', { name: 'Dr. Osei' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Lead: Dr. Osei' })).toBeVisible()
    );

    /* Two vets means no auto-assignment: the hook only stamps a lead when exactly
       one is free, so this pick had to be made by hand. Support stays empty - it
       is a separate field and choosing a lead must not fill it. */
    await expect(within(dialog).getByRole('button', { name: 'Support' })).toBeInTheDocument();
  },
};

export const Emergency: Story = {
  name: 'Marked as an emergency',
  play: async () => {
    const dialog = await liveDialog();
    const panel = within(dialog);

    const checkbox = panel.getByRole('checkbox');
    await expect(checkbox).not.toBeChecked();

    /* The accessible name is the visible sentence, because the component names the
       input through its <label> and carries no `aria-label` to override it. An
       aria-label here would fail WCAG 2.5.3: speech control could not act on the
       words the reader can actually see. */
    await expect(checkbox).toHaveAccessibleName('I confirm this is an emergency.');
    const label = panel.getByText('I confirm this is an emergency.');
    await expect(label).toHaveAttribute('for', checkbox.id);

    // The `useId` pairing is what names the box AND what makes the sentence a hit
    // target, so clicking the words has to toggle it.
    await userEvent.click(label);
    await expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).not.toBeChecked();
  },
};

export const Closed: Story = {
  name: 'Closed',
  args: { showModal: false },
  play: async () => {
    /* Closed does not mean unmounted: `Modal` always renders its dialog and only
       toggles `open`, so the closed frame has to prove the panel is INERT rather
       than absent. Without that its fields stay in the tab order behind the
       directory. */
    const dialog = await waitFor(() => {
      const node = globalThis.document.querySelector('dialog.yc-modal-dialog');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    await expect(openDialog()).toBeNull();
    await expect(dialog).toHaveAttribute('inert');
    await expect(dialog.getAttribute('aria-modal')).toBeNull();

    // Closing also runs `resetForm`, and the second effect re-stamps the
    // companion only when the drawer is open - so a shut drawer holds no
    // companion at all and the header accordion is gone with it.
    await expect(within(dialog).queryByText('Poppy · Hartmann')).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: the drawer goes full-screen',
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert, so the wrong spelling here silently draws the
  // 530px desktop drawer instead.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768px `Modal` re-forms the drawer into a full-screen panel (a `centered` modal ' +
          'would become a bottom sheet instead). The caller passes nothing for this, so the phone ' +
          'form of the booking drawer only exists here.\n\n' +
          'Deliberately without a play function. The swap is driven by `useIsPhone`, which reads a ' +
          'real `matchMedia` query rather than a CSS breakpoint, so it needs the manager to resize ' +
          'the preview iframe - a headless run that loads `iframe.html` directly keeps the ' +
          'desktop window width and would assert the desktop panel while claiming to check the ' +
          'phone one. What the frame is for is visible: a full-screen panel whose entire content ' +
          'is one read-only accordion and a CTA, because the three form sections are still shut.',
      },
    },
  },
};
