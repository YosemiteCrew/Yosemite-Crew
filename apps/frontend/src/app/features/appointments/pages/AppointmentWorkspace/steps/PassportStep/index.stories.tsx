import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, userEvent, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type {
  ClinicalExamDTO,
  ParasiteTreatmentDTO,
  PetPassportDTO,
  PetPassportIssuanceDTO,
  RabiesTitrationDTO,
  VaccinationDTO,
} from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import PassportStep from './index';

const ORG_ID = 'org-storybook-passport-step';
const COMPANION_ID = 'companion-poppy';
const ENCOUNTER_ID = 'enc-poppy-2026-03-12';

const RABIES: VaccinationDTO = {
  id: 'vac-rabies-2026',
  patientId: COMPANION_ID,
  vaccineType: 'RABIES',
  vaccineName: 'Nobivac Rabies',
  manufacturer: 'MSD Animal Health',
  batchNumber: 'A214-99C',
  dateAdministered: '2026-01-04',
  validFrom: '2026-01-25',
  validUntil: '2029-01-03',
  administeringVetName: 'Dr. Amara Weber',
  createdAt: '2026-01-04T10:12:00.000Z',
};

const LEPTO: VaccinationDTO = {
  id: 'vac-lepto-2025',
  patientId: COMPANION_ID,
  vaccineType: 'CORE',
  vaccineName: 'Nobivac L4',
  dateAdministered: '2025-11-18',
  nextDueDate: '2026-11-18',
  createdAt: '2025-11-18T09:40:00.000Z',
};

const TITRATION: RabiesTitrationDTO = {
  id: 'tit-2026-01',
  patientId: COMPANION_ID,
  approvedLab: 'Biobest Laboratories',
  sampleDate: '2026-01-25',
  resultIuMl: 1.8,
  createdAt: '2026-02-02T08:00:00.000Z',
};

const MILBEMAX: ParasiteTreatmentDTO = {
  id: 'par-2026-02',
  patientId: COMPANION_ID,
  treatmentType: 'ECHINOCOCCUS',
  productName: 'Milbemax',
  manufacturer: 'Elanco',
  treatedAt: '2026-02-02T16:45:00.000Z',
  createdAt: '2026-02-02T16:50:00.000Z',
};

const EXAM: ClinicalExamDTO = {
  id: 'exam-2026-02',
  patientId: COMPANION_ID,
  examinedAt: '2026-02-14T09:30:00.000Z',
  fitForTravel: true,
  findings: 'Bright, alert and responsive. No abnormalities on examination.',
  weightKg: 11.4,
  createdAt: '2026-02-14T09:45:00.000Z',
};

const ISSUANCE: PetPassportIssuanceDTO = {
  passportNumber: 'GB 826 1174 9930',
  issuingCountry: 'United Kingdom',
  issuingAuthority: 'DEFRA',
  issuingPractice: 'Harbourside Veterinary Group',
  issuingVetName: 'Dr. Amara Weber',
  issuingVetLicense: 'RCVS 7011482',
  issueDate: '2026-02-14',
};

const passport = (over: Partial<PetPassportDTO> = {}): PetPassportDTO => ({
  identity: {
    id: COMPANION_ID,
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    sex: 'female',
    colour: 'Tricolour',
  },
  // The rabies dose is surfaced separately AND listed in `vaccinations`; the
  // step folds it back in by id so it is not drawn twice.
  rabies: RABIES,
  vaccinations: [RABIES, LEPTO],
  parasiteTreatments: [MILBEMAX],
  rabiesTitrations: [TITRATION],
  clinicalExams: [EXAM],
  ...over,
});

const EMPTY_PASSPORT = passport({
  rabies: undefined,
  vaccinations: [],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [],
});

type PassportFixture =
  | { kind: 'resolves'; passport: PetPassportDTO }
  /** Held open on purpose: the only way to hold the loading line still. */
  | { kind: 'pending' }
  | { kind: 'rejects'; message: string };

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/**
 * The step reads the assembled passport on mount through `getPetPassport`, and
 * every capture POSTs to the same companion path. Both go through the shared
 * axios instance, so its adapter is the seam: the services, the org lookup in
 * `requireOrgId` and the component stay real, and nothing leaves the preview.
 *
 * A capture is echoed back as the record the backend would mint - the posted
 * body plus an id and a timestamp - so the DRAFT row the step draws is built
 * from exactly what the form submitted.
 */
const REAL_ADAPTER = api.defaults.adapter;

const withPassportApi = (fixture: PassportFixture) => () => {
  clearInFlightGetRequests();
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();
    if (!url.includes('/v1/pet-passport/')) {
      return Promise.reject(new Error(`Unstubbed request in PassportStep.stories: ${url}`));
    }

    if (method === 'post') {
      const body =
        typeof config.data === 'string' && config.data
          ? (JSON.parse(config.data) as Record<string, unknown>)
          : {};
      const { encounterId: _encounterId, ...record } = body;
      return Promise.resolve(
        respond(config, {
          id: `draft-${Date.now()}`,
          patientId: COMPANION_ID,
          createdAt: new Date().toISOString(),
          ...record,
        })
      );
    }

    if (fixture.kind === 'pending') return new Promise<never>(() => {});
    if (fixture.kind === 'rejects') {
      return Promise.reject(
        Object.assign(new Error('Request failed with status code 403'), {
          isAxiosError: true,
          config,
          response: {
            status: 403,
            statusText: 'Forbidden',
            data: { message: fixture.message },
            headers: {},
            config,
          },
        })
      );
    }
    return Promise.resolve(respond(config, fixture.passport));
  };
  api.defaults.adapter = adapter;
  return () => {
    api.defaults.adapter = REAL_ADAPTER;
    clearInFlightGetRequests();
  };
};

/** `requireOrgId` reads the active org off the store; without it every call throws. */
const seedOrg = () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  return () => {
    useOrgStore.setState({ primaryOrgId: snapshot.primaryOrgId, status: snapshot.status });
  };
};

/**
 * A refused read is logged by the axios wrapper on its way to the step's own
 * catch, and the render check treats a console error as a broken story. Only
 * that line is dropped; anything else still reaches the console.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some((arg) => typeof arg === 'string' && arg.includes('API getData error'));
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const withStep = (fixture: PassportFixture) => [seedOrg, withPassportApi(fixture)];

const meta = {
  title: 'Workspace/PassportStep',
  component: PassportStep,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Passport step of the appointment workspace: issuance of the Digital Pet ' +
          'Passport (opt-in, defaulting to "No"), a segmented picker for the four record kinds ' +
          'a passport is assembled from, the capture form for the chosen kind, and the ' +
          'records list underneath.\n\n' +
          'The list mixes two provenances and says so on every row. What the assembled ' +
          'passport already carries arrives SIGNED from `getPetPassport`; what this visit ' +
          'captures is unshifted on top as a DRAFT, saved against the encounter and off the ' +
          'passport until a veterinarian attests it - an act this step deliberately does not ' +
          'offer. The rabies dose is surfaced by the passport twice (as `rabies` and inside ' +
          '`vaccinations`) and folded back in by id, so it is listed once.\n\n' +
          'A capture needs an encounter. With none passed in and none resolvable the save ' +
          'fails with the check-in message rather than posting an orphan record, which is the ' +
          'one error a front desk can act on. A locked visit swaps the picker and form for a ' +
          'single sentence and keeps the list.\n\n' +
          'The stories answer the passport endpoint from the shared axios adapter: the read is ' +
          'fixture data, and a capture is echoed back as the record the backend would mint.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    companionId: COMPANION_ID,
    companionName: 'Poppy',
    encounterId: ENCOUNTER_ID,
  },
  decorators: [
    (Story) => (
      <div className="min-h-[720px] max-w-[880px] bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: withStep({ kind: 'resolves', passport: passport() }),
} satisfies Meta<typeof PassportStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedRecords: Story = {
  name: 'Passport with signed records',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // findBy, not getBy: the first paint is the loading line until the read lands.
    await expect(await canvas.findByText('Nobivac Rabies')).toBeInTheDocument();
    await expect(canvas.getByText('Nobivac L4')).toBeInTheDocument();
    await expect(canvas.getByText('1.8 IU/ml')).toBeInTheDocument();
    await expect(canvas.getByText('Milbemax')).toBeInTheDocument();
    await expect(canvas.getByText('Fit for travel')).toBeInTheDocument();
    /* Five rows, five Signed pills - and exactly five: the rabies dose is in the
       passport twice and must be drawn once. */
    await expect(canvas.getAllByText('Signed')).toHaveLength(5);
    await expect(canvas.queryByText('Draft')).not.toBeInTheDocument();

    // Issuance defaults to No; the picker opens on Vaccination.
    await expect(canvas.getByRole('button', { name: 'No' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const picker = canvas.getByRole('group', { name: 'Record to capture' });
    await expect(within(picker).getByRole('button', { name: 'Vaccination' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(canvas.getByRole('button', { name: 'Save vaccination' })).toBeInTheDocument();
  },
};

export const CaptureVaccination: Story = {
  name: 'Capturing a vaccination adds a draft',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Nobivac Rabies');

    fireEvent.change(canvas.getByLabelText('Vaccine name'), {
      target: { value: 'Nobivac DHPPi' },
    });
    fireEvent.change(canvas.getByLabelText('Date administered'), {
      target: { value: '2026-03-12' },
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Save vaccination' }));

    /* The new row lands at the TOP as a DRAFT, above every signed record: the
       list is captured-first, and a draft is the only state a capture can have. */
    const draftTitle = await canvas.findByText('Nobivac DHPPi');
    await expect(canvas.getAllByText('Draft')).toHaveLength(1);
    await expect(draftTitle.getBoundingClientRect().top).toBeLessThan(
      canvas.getByText('Nobivac Rabies').getBoundingClientRect().top
    );
    await expect(canvas.getAllByText('Signed')).toHaveLength(5);
  },
};

export const EmptyPassport: Story = {
  name: 'Nothing on the passport yet',
  beforeEach: withStep({ kind: 'resolves', passport: EMPTY_PASSPORT }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No passport records for this companion yet.')
    ).toBeInTheDocument();
    await expect(canvas.queryByText('Signed')).not.toBeInTheDocument();
    // Capture is still offered - an empty passport is where most travel visits start.
    await expect(canvas.getByRole('group', { name: 'Record to capture' })).toBeInTheDocument();
  },
};

export const Loading: Story = {
  name: 'Loading the passport',
  beforeEach: withStep({ kind: 'pending' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Loading passport records...')).toBeInTheDocument();
    /* Only the body swaps: the explanatory copy and the capture form are already
       on screen, so the card does not change height when the read lands. */
    await expect(canvas.getByText(/Only signed records count towards the passport/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Save vaccination' })).toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'Passport read refused',
  beforeEach: [
    ...withStep({ kind: 'rejects', message: 'Passport access is restricted to clinical staff.' }),
    muteExpectedFailureLogs,
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    // The server's own wording, not the generic fallback.
    await expect(alert).toHaveTextContent('Passport access is restricted to clinical staff.');
    await expect(alert).not.toHaveTextContent('Unable to load the passport for this companion.');
    // The list settles empty beneath the alert rather than staying on the loading line.
    await expect(canvas.getByText('No passport records for this companion yet.')).toBeVisible();
  },
};

export const ReadOnly: Story = {
  name: 'Locked visit',
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        'This visit is locked, so no further passport records can be captured against it.'
      )
    ).toBeInTheDocument();
    // The picker and every capture form are gone, not disabled.
    await expect(
      canvas.queryByRole('group', { name: 'Record to capture' })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Save vaccination' })
    ).not.toBeInTheDocument();
    // The passport itself is still readable.
    await expect(await canvas.findByText('Nobivac Rabies')).toBeInTheDocument();
  },
};

export const AlreadyIssued: Story = {
  name: 'Passport already issued',
  beforeEach: withStep({ kind: 'resolves', passport: passport({ issuance: ISSUANCE }) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('GB 826 1174 9930')).toBeInTheDocument();
    await expect(canvas.getByText('Issued')).toBeInTheDocument();
    // The opt-in question never appears once a passport exists.
    await expect(canvas.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
    await expect(canvas.getByText('Dr. Amara Weber')).toBeInTheDocument();
  },
};

export const MissingEncounter: Story = {
  name: 'Capture refused without an encounter',
  args: { encounterId: undefined, ensureEncounterId: () => Promise.resolve(undefined) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Nobivac Rabies');

    fireEvent.change(canvas.getByLabelText('Vaccine name'), {
      target: { value: 'Nobivac DHPPi' },
    });
    fireEvent.change(canvas.getByLabelText('Date administered'), {
      target: { value: '2026-03-12' },
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Save vaccination' }));

    /* The step refuses before any request: a record with no encounter would be
       an orphan, and the message names the fix a front desk can actually do. */
    await expect(
      await canvas.findByText(
        'This appointment does not have an encounter yet. Check the patient in, then try again.'
      )
    ).toBeInTheDocument();
    await expect(canvas.queryByText('Draft')).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: picker wraps',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Nobivac Rabies');
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await expect(canvas.getByRole('group', { name: 'Record to capture' })).toBeVisible();
  },
};
