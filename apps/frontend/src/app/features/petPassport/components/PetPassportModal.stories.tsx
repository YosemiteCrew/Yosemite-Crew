import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { PetPassportDTO } from '@yosemite-crew/types';

import PetPassportModal from './PetPassportModal';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';

const ORG_ID = 'org-storybook';
const COMPANION_ID = 'companion-luna';

/** A passport with every section populated, so the whole card is under review. */
const PASSPORT: PetPassportDTO = {
  identity: {
    id: COMPANION_ID,
    name: 'Luna',
    species: 'dog',
    breed: 'Beagle',
    sex: 'female',
    dateOfBirth: '2021-03-14',
    colour: 'Tricolour',
    distinguishingMarks: 'White blaze, notch in left ear',
  },
  owner: {
    name: 'Marta Ferreira',
    email: 'marta.ferreira@example.com',
    phone: '+351 912 000 111',
  },
  microchip: {
    number: '941000024681357',
    implantedAt: '2021-05-02',
    location: 'Left side of neck',
  },
  passportNumber: 'PT-2026-004417',
  rabies: {
    id: 'vac-rabies',
    patientId: COMPANION_ID,
    vaccineType: 'RABIES',
    vaccineName: 'Nobivac Rabies',
    manufacturer: 'MSD Animal Health',
    batchNumber: 'RB-2025-118',
    dateAdministered: '2025-06-11T09:00:00.000Z',
    validFrom: '2025-07-02T00:00:00.000Z',
    validUntil: '2028-06-11T00:00:00.000Z',
    nextDueDate: '2028-05-11T00:00:00.000Z',
    administeringVetName: 'Dr. Elena Marsh',
    createdAt: '2025-06-11T09:05:00.000Z',
  },
  vaccinations: [
    {
      id: 'vac-dhpp',
      patientId: COMPANION_ID,
      vaccineType: 'CORE',
      vaccineName: 'Nobivac DHPPi',
      batchNumber: 'DH-2026-044',
      dateAdministered: '2026-01-19T10:30:00.000Z',
      nextDueDate: '2027-01-19T00:00:00.000Z',
      createdAt: '2026-01-19T10:35:00.000Z',
    },
  ],
  parasiteTreatments: [
    {
      id: 'par-1',
      patientId: COMPANION_ID,
      treatmentType: 'ECHINOCOCCUS',
      productName: 'Milbemax',
      treatedAt: '2026-02-10T16:20:00.000Z',
      administeringVetName: 'Dr. Elena Marsh',
      createdAt: '2026-02-10T16:25:00.000Z',
    },
  ],
  rabiesTitrations: [
    {
      id: 'tit-1',
      patientId: COMPANION_ID,
      approvedLab: 'ANSES Nancy',
      sampleDate: '2025-08-04T00:00:00.000Z',
      resultIuMl: 1.8,
      createdAt: '2025-08-20T00:00:00.000Z',
    },
  ],
  clinicalExams: [
    {
      id: 'exam-1',
      patientId: COMPANION_ID,
      examinedAt: '2026-02-12T08:45:00.000Z',
      fitForTravel: true,
      findings: 'Bright, alert, responsive',
      weightKg: 11.4,
      temperatureC: 38.5,
      examiningVetName: 'Dr. Elena Marsh',
      createdAt: '2026-02-12T08:50:00.000Z',
    },
  ],
  issuance: {
    passportNumber: 'PT-2026-004417',
    issuingCountry: 'Portugal',
    issuingAuthority: 'DGAV',
    issuingPractice: 'Harbourside Veterinary Group',
    issuingVetName: 'Dr. Elena Marsh',
    issuingVetLicense: 'PT-VET-8842',
    issueDate: '2026-02-12T09:00:00.000Z',
  },
  publicShareActive: true,
};

const withoutIssuance = (): PetPassportDTO => {
  const { issuance: _issuance, ...rest } = PASSPORT;
  return { ...rest, publicShareActive: false };
};

const ok = <T,>(config: InternalAxiosRequestConfig, data: T): Promise<AxiosResponse<T>> =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });

const fail = (
  config: InternalAxiosRequestConfig,
  status: number,
  message: string
): Promise<AxiosResponse> =>
  Promise.reject(
    new AxiosError(message, String(status), config, undefined, {
      data: { message },
      status,
      statusText: message,
      headers: {},
      config,
    })
  );

/** A request that never settles - which is what "still in flight" actually is. */
const neverSettles = (): Promise<AxiosResponse> => new Promise<AxiosResponse>(() => {});

/**
 * A transport failure: the passport service never answered at all.
 *
 * This is what the error story cans, and it is deliberately NOT the 500 it reads
 * like. `services/axios.ts` retries idempotent 429/5xx three times with
 * exponential backoff, so a canned 500 does not reach this panel's `catch` for
 * roughly five seconds - the modal holds "Loading passport..." for the whole
 * ladder, and the error copy that the story is about only lands on the fourth
 * request. A response-less failure is not retryable, so the panel draws the
 * error on the first attempt. Same copy, different number of requests behind it.
 */
const noResponse = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
  Promise.reject(
    new AxiosError('The passport service did not respond.', AxiosError.ERR_NETWORK, config)
  );

type Handlers = {
  /** Answer for the passport read. Defaults to the fully populated passport above. */
  onPassport?: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
  /** Answer for the Apple `.pkpass` fetch. Defaults to a request left in flight. */
  onApple?: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
  /** Answer for the Google save-URL fetch. Defaults to a request left in flight. */
  onGoogle?: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
};

/**
 * One canned API for the whole panel, so no story can reach the network however far
 * its interactions drive it.
 *
 * Both wallet legs default to a request that never settles, and that is deliberate
 * rather than lazy: a resolved Apple response makes `downloadApplePass` build a blob
 * URL and click a real anchor, which saves a file out of the Storybook tab, and a
 * resolved Google response makes the component call `window.open`. Neither belongs in
 * a story, so the only wallet states drawn here are "in flight" and "failed".
 */
const buildAdapter = ({ onPassport, onApple, onGoogle }: Handlers = {}): AxiosAdapter => {
  return (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    if (url.endsWith('/passport')) {
      return (onPassport ?? ((request) => ok(request, PASSPORT)))(config);
    }
    if (url.endsWith('/wallet/apple')) return (onApple ?? neverSettles)(config);
    if (url.endsWith('/wallet/google')) return (onGoogle ?? neverSettles)(config);
    return fail(config, 404, `No canned response for ${url}`);
  };
};

/**
 * The org store is seeded because every PMS passport route is org-scoped through
 * `requireOrgId`, which throws when no organisation is active - without it the panel
 * would only ever draw its error state. The adapter swap and the store are both put
 * back on unmount; `clearInFlightGetRequests` is part of that teardown because the
 * loading story's request never settles and would otherwise sit in the GET dedupe
 * cache for the next story to await forever.
 */
const withApi = (handlers: Handlers = {}) => {
  return () => {
    const snapshot = useOrgStore.getState();
    const previousAdapter = api.defaults.adapter;

    useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
    api.defaults.adapter = buildAdapter(handlers);

    return () => {
      useOrgStore.setState(snapshot);
      api.defaults.adapter = previousAdapter;
      clearInFlightGetRequests();
    };
  };
};

/**
 * The panel portals to `document.body`, so every query starts from the dialog rather
 * than from `canvasElement` - nothing it renders is inside the canvas at all. It is
 * also matched on `dialog[open]` rather than on the element: a closed ModalBase stays
 * mounted and only drops the `open` attribute, so an absence assertion against the
 * node itself would pass while the panel was still on screen.
 */
const dialog = () => document.querySelector('dialog[open]');

/**
 * The card `PetPassportView` draws, reached through its content rather than by
 * class. `[class*="gap-5"]` would have worked today and broken silently the day a
 * utility moved - and "silently" is the problem, because a `querySelector` that
 * misses returns null and the very next `.children` read throws somewhere
 * unrelated. Every section is a child of this root, so the one section a passport
 * always has identifies it: `Description` renders unconditionally, unlike Owner,
 * Identification or Issued by.
 */
const passportView = (root: HTMLElement): HTMLElement => {
  const section = within(root).getByText('Description').parentElement;
  return section?.parentElement as HTMLElement;
};

const SECTIONS = [
  'Owner',
  'Description',
  'Identification',
  'Rabies vaccination',
  'Other vaccinations',
  'Parasite treatments',
  'Rabies titration',
  'Clinical examination',
  'Issued by',
] as const;

const meta = {
  title: 'Pet Passport/PetPassportModal',
  component: PetPassportModal,
  parameters: {
    // No `autodocs`: the panel portals to document.body over a fixed, blurred
    // backdrop, so on a docs page every story would stack on top of the page
    // instead of rendering in its own block.
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "The staff-side view of a companion's Digital Pet Passport, and the **ready state** in " +
          'particular - the one the modal spends its life in, and the one nothing had ever drawn ' +
          'because it only exists after a fetch resolves.\n\n' +
          'Every story stubs the API client at the axios adapter, so nothing here reaches the ' +
          'network. That is what makes the ready state reachable at all: the load state lives inside ' +
          '`PetPassportModalContent`, which is mounted keyed by companion and unmounted on close, so ' +
          'there is no store to seed and no flag to flip - only the response.\n\n' +
          'The footer is the part worth reviewing. A wallet pass embeds a public share link in its ' +
          'QR, and staff cannot mint that link - it is an owner credential created from the pet ' +
          'parent app. So there are three distinct footers, not two: buttons when the passport is ' +
          'issued AND shared, and a different sentence for each of the two gaps, each naming the ' +
          'thing that is actually missing rather than offering an action that would 409.',
      },
    },
  },
  args: {
    open: true,
    companionId: COMPANION_ID,
    companionName: 'Luna Ferreira',
    onClose: fn(),
  },
  beforeEach: withApi(),
} satisfies Meta<typeof PetPassportModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  name: 'Ready - issued and shareable',
  play: async () => {
    await waitFor(() => expect(dialog()).not.toBeNull());
    const open = within(dialog() as HTMLElement);

    /* The header is built from the FIRST word of the companion name, not the whole
       one: "Luna Ferreira" gives "Luna's passport". A record card titled with the
       family name would read as the owner's document rather than the pet's. */
    await expect(open.getByRole('heading', { name: "Luna's passport" })).toBeInTheDocument();

    /* Gate on something only the ready state renders. The header above is NOT that
       signal - it is drawn from the prop while the fetch is still out, so a story
       that waited on it would read the structure below off the loading state and
       find nothing. */
    expect(await open.findByText('Issued by')).toBeInTheDocument();

    /* Nine sections, plus the identity header and the closing disclaimer: eleven
       children. Each section renders only when its data is present, so the count is
       the assertion that a populated passport draws all of them - a section silently
       dropped by a renamed DTO field looks exactly like a pet with no records. */
    const view = passportView(dialog() as HTMLElement);
    await expect(getComputedStyle(view).flexDirection).toBe('column');
    await expect(view.children).toHaveLength(11);
    for (const section of SECTIONS) {
      await expect(open.getByText(section)).toBeInTheDocument();
    }

    // Identity and description rows.
    await expect(open.getByText('Luna')).toBeInTheDocument();
    await expect(open.getByText('Beagle / Canine')).toBeInTheDocument();
    // The raw Prisma value is `female`; printing it unmapped is the bug this label
    // helper exists to prevent.
    await expect(open.getByText('Female')).toBeInTheDocument();
    await expect(open.getByText('White blaze, notch in left ear')).toBeInTheDocument();
    await expect(open.getByText('PT-2026-004417')).toBeInTheDocument();
    await expect(open.getByText('941000024681357')).toBeInTheDocument();

    // Clinical content: the rabies dose with its batch, the titration result, and
    // the travel verdict a border officer is actually looking for.
    await expect(open.getByText('Nobivac Rabies')).toBeInTheDocument();
    await expect(open.getByText(/Batch RB-2025-118$/)).toBeInTheDocument();
    await expect(open.getByText(/^1\.8 IU\/ml · /)).toBeInTheDocument();
    await expect(open.getByText('Fit to travel')).toBeInTheDocument();
    await expect(
      open.getByText('Dr. Elena Marsh · 11.4 kg · 38.5°C · Bright, alert, responsive')
    ).toBeInTheDocument();

    // Both wallet actions, because the passport is issued and the share link is live.
    await expect(open.getByRole('button', { name: 'Add to Apple Wallet' })).toBeEnabled();
    await expect(open.getByRole('button', { name: 'Add to Google Wallet' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A fully populated passport: every section this view can draw is present at once, which is ' +
          'the only configuration that shows the reading order a border officer works down - identity, ' +
          'then owner, then description, chip, rabies, other jabs, parasites, titration, exam, and the ' +
          'issuing practice last. Each section is conditional on its own data, so the eleven-child ' +
          'count is what proves none of them dropped out; a renamed DTO field removes a whole block and ' +
          'looks exactly like a pet with no records.',
      },
    },
  },
};

export const NotIssued: Story = {
  name: 'Ready - passport not issued yet',
  beforeEach: withApi({
    onPassport: (config) =>
      ok(config, {
        ...withoutIssuance(),
        passportNumber: undefined,
      } satisfies PetPassportDTO),
  }),
  play: async () => {
    await waitFor(() => expect(dialog()).not.toBeNull());
    const open = within(dialog() as HTMLElement);

    expect(
      await open.findByText('Wallet passes become available once a vet issues this passport.')
    ).toBeInTheDocument();
    await expect(
      open.queryByRole('button', { name: 'Add to Apple Wallet' })
    ).not.toBeInTheDocument();

    // The record itself is complete and readable - only the issuance section and the
    // passport number are missing, which is precisely what the sentence says.
    await expect(open.getByText('Nobivac Rabies')).toBeInTheDocument();
    await expect(open.queryByText('Issued by')).not.toBeInTheDocument();
    const view = passportView(dialog() as HTMLElement);
    await expect(view.children).toHaveLength(10);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The common state on a pet whose records exist but whose passport has not been issued. ' +
          'Nothing is disabled and nothing is hidden behind a tooltip: the actions are simply absent, ' +
          'and the sentence in their place names the step that unlocks them.',
      },
    },
  },
};

export const NoShareLink: Story = {
  name: 'Ready - issued, no share link',
  beforeEach: withApi({
    onPassport: (config) => ok(config, { ...PASSPORT, publicShareActive: false }),
  }),
  play: async () => {
    await waitFor(() => expect(dialog()).not.toBeNull());
    const open = within(dialog() as HTMLElement);

    expect(
      await open.findByText(
        'The owner needs to create a share link in the Yosemite Crew app before this passport can be added to a wallet.'
      )
    ).toBeInTheDocument();
    await expect(
      open.queryByRole('button', { name: 'Add to Google Wallet' })
    ).not.toBeInTheDocument();
    // Issued, so the issuance section IS drawn - the gap is the share link, not the
    // passport, and the two states are only distinguishable by this sentence.
    await expect(open.getByText('Issued by')).toBeInTheDocument();
    await expect(open.getByText('Harbourside Veterinary Group')).toBeInTheDocument();
    // All eleven blocks, same as the shareable state: this story differs from
    // `Ready` in the footer alone, and the count is what says so rather than the
    // prose below claiming it.
    await expect(passportView(dialog() as HTMLElement).children).toHaveLength(11);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second gap, and the one that is easy to mistake for a bug: the passport is issued, the ' +
          'card is complete, and the wallet actions are still gone. The QR on a wallet pass points at ' +
          'the public share link, which only the pet parent can create, so a staff member cannot ' +
          'resolve this from PIMS at all - the copy asks them to tell the owner rather than to retry.',
      },
    },
  },
};

export const AddingToAppleWallet: Story = {
  name: 'Busy - building the Apple pass',
  play: async () => {
    await waitFor(() => expect(dialog()).not.toBeNull());
    const open = within(dialog() as HTMLElement);

    await userEvent.click(await open.findByRole('button', { name: 'Add to Apple Wallet' }));

    /* One `busy` value covers both buttons, so the pressed action reports progress
       in its own label and the other goes inert - a second wallet request while the
       first is still building would race two downloads at the same tab. */
    expect(await open.findByRole('button', { name: 'Adding to Apple Wallet...' })).toBeDisabled();
    await expect(open.getByRole('button', { name: 'Add to Google Wallet' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The `.pkpass` is fetched over the authenticated channel rather than followed as a link, ' +
          'because the route needs session cookies - so there is a real wait here, and it is the only ' +
          'moment either button is disabled.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Loading',
  beforeEach: withApi({ onPassport: neverSettles }),
  play: async () => {
    await waitFor(() => expect(dialog()).not.toBeNull());
    const open = within(dialog() as HTMLElement);

    // The header is not gated on the response: the panel names the pet from the prop
    // immediately, so the modal never opens as an untitled box.
    await expect(open.getByRole('heading', { name: "Luna's passport" })).toBeInTheDocument();
    await expect(open.getByText('Loading passport...')).toBeInTheDocument();
    /* Nothing downstream of the response is drawn: not the card, and not the
       wallet footer either. The footer is worth naming separately because its
       default branch is `not-issued`, so a footer rendered before the passport
       arrived would show the "once a vet issues this passport" sentence about a
       passport that may well be issued. */
    await expect(open.queryByText('Description')).not.toBeInTheDocument();
    await expect(
      open.queryByRole('button', { name: 'Add to Apple Wallet' })
    ).not.toBeInTheDocument();
    await expect(
      open.queryByText('Wallet passes become available once a vet issues this passport.')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The wait. It is short in practice and it is still worth drawing, because the modal opens ' +
          'before the fetch resolves and the header is filled from the prop rather than the response - ' +
          'so the panel is named from the moment it appears instead of growing a title a beat later.',
      },
    },
  },
};

/** Passport reads the panel actually issued, reset by the story's own `beforeEach`. */
const passportReads = { count: 0 };

export const LoadFailed: Story = {
  name: 'Error - passport could not be loaded',
  beforeEach: () => {
    passportReads.count = 0;
    return withApi({
      onPassport: (config) => {
        passportReads.count += 1;
        return noResponse(config);
      },
    })();
  },
  play: async () => {
    await waitFor(() => expect(dialog()).not.toBeNull());
    const open = within(dialog() as HTMLElement);

    expect(await open.findByText('This passport could not be loaded.')).toBeInTheDocument();
    await expect(open.queryByText('Loading passport...')).not.toBeInTheDocument();
    await expect(
      open.queryByRole('button', { name: 'Add to Apple Wallet' })
    ).not.toBeInTheDocument();

    /* One request, not four - which is the whole reason this story cans a
       response-less failure rather than a 500. The panel has no retrying state
       of its own, so the client's transient-retry ladder is invisible from the
       screen and this count is the only place it is pinned: canned as a 5xx,
       the identical copy arrives four requests and about five seconds later,
       with "Loading passport..." on screen throughout. */
    await expect(passportReads.count).toBe(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A failed read says so in the panel as well as in a toast, because the toast is gone in ' +
          'four seconds and the open modal is not. The failure does not latch: the state lives in the ' +
          'content component, which is unmounted on close and re-keyed per companion, so re-opening ' +
          'the same pet retries rather than replaying this.\n\n' +
          'The failure canned here is a transport one - no response at all. A 5xx reaches the same ' +
          'copy by a much slower road: the shared axios client retries idempotent 429/5xx three ' +
          'times with exponential backoff, so a passport read that 500s leaves this modal on ' +
          '"Loading passport..." for around five seconds with nothing on screen saying it is still ' +
          'trying. Worth deciding whether the panel should say so.',
      },
    },
  },
};
