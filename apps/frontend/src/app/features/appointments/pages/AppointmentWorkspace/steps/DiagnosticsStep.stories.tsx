import type { Meta, StoryObj } from '@storybook/react';
import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type {
  CensusEntry,
  IdexxTest,
  IvlsDevice,
  LabOrder,
  LabResult,
  OrgIntegration,
} from '@/app/features/integrations/services/types';
import type {
  AppointmentEncounter,
  DiagnosticOrder,
} from '@/app/features/appointments/types/workspace';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useOrgStore } from '@/app/stores/orgStore';

import DiagnosticsStep from './DiagnosticsStep';

const ORG_ID = 'org-storybook-diagnostics';
const INTEGRATION_ID = 'int-idexx-workspace';
const COMPANION_ID = 'companion-diagnostics-1';
const APPOINTMENT_ID = 'appt-diagnostics-1';
const ORDER_ID = 'IDX-100244';
const PAST_ORDER_ID = 'IDX-100109';
const RESULT_ID = 'res-9001';

// Local Date parts, not a UTC literal: the order and result rows render through
// `formatDateTimeLocal`, so a `Z` string slides by the runner's offset and the
// story would read differently in two timezones.
const at = (hour: number, minute: number) => new Date(2026, 2, 12, hour, minute);

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: {
    id: COMPANION_ID,
    name: 'Rosie',
    species: 'dog',
    breed: 'Cocker Spaniel',
    parent: { id: 'parent-diagnostics-1', name: 'Marta Cole' },
  },
  /* `companion`, not `patient`, is what `useLabTests` reads for the patient id.
     An appointment missing it leaves `companionId` undefined, which silently
     disables ordering while every section still renders. */
  companion: {
    id: COMPANION_ID,
    name: 'Rosie',
    species: 'dog',
    breed: 'Cocker Spaniel',
    parent: { id: 'parent-diagnostics-1', name: 'Marta Cole' },
  },
  lead: { id: 'vet-1', name: 'Dr Aisha Rahman' },
  supportStaff: [{ id: 'tech-1', name: 'Sam Okoro' }],
  // Read straight off the appointment (not the org store) by "Print all Results".
  organisationId: ORG_ID,
  appointmentDate: at(9, 30),
  startTime: at(9, 30),
  endTime: at(10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

const TESTS: IdexxTest[] = [
  {
    _id: 'idexx-test-1',
    code: 'CBC',
    display: 'Complete Blood Count',
    type: 'PROFILE',
    meta: {
      listPrice: '38.50',
      currencyCode: 'USD',
      turnaround: '24 hours',
      specimen: 'EDTA whole blood',
    },
  },
  // No price, no turnaround, no specimen: each falls back to a sentence rather
  // than an empty pill on the queue card.
  { _id: 'idexx-test-2', code: 'T4', display: 'Total T4', type: 'ASSAY' },
];

const DEVICES: IvlsDevice[] = [
  {
    deviceSerialNumber: 'IVLS-7781',
    displayName: 'Catalyst One',
    vcpActivatedStatus: 'ACTIVATED',
    lastPolledCloudTime: '2026-03-12T08:00:00.000Z',
  },
];

const SUBMITTED_ORDER: LabOrder = {
  _id: 'order-2',
  organisationId: ORG_ID,
  provider: 'IDEXX',
  companionId: COMPANION_ID,
  parentId: 'parent-diagnostics-1',
  appointmentId: APPOINTMENT_ID,
  patientName: 'Rosie',
  status: 'SUBMITTED',
  modality: 'REFERENCE_LAB',
  idexxOrderId: ORDER_ID,
  uiUrl: 'https://www.vetconnectplus.com/orders/IDX-100244',
  pdfUrl: 'https://www.vetconnectplus.com/orders/IDX-100244/acknowledgment.pdf',
  tests: ['CBC'],
  veterinarian: 'Dr Aisha Rahman',
  technician: 'Sam Okoro',
  // Order-level notes: IDEXX has no per-test notes, and these have to survive a
  // reload (bug #1973), which is why the row renders them at all.
  notes: 'Fasted sample, collected from the left jugular.',
  createdAt: at(9, 40).toISOString(),
  updatedAt: at(10, 5).toISOString(),
};

/**
 * Deliberately carries a `uiUrl` on a host that is NOT idexx.com or
 * vetconnectplus.com, and no acknowledgement at all. `getSafeIdexxIframeUrl`
 * rejects the host, which is what leaves both of this row's actions inert.
 */
const PAST_ORDER: LabOrder = {
  _id: 'order-1',
  organisationId: ORG_ID,
  provider: 'IDEXX',
  companionId: COMPANION_ID,
  appointmentId: APPOINTMENT_ID,
  patientName: 'Rosie',
  status: 'CREATED',
  modality: 'INHOUSE',
  idexxOrderId: PAST_ORDER_ID,
  uiUrl: 'https://orders.partner-lab.example.com/IDX-100109',
  pdfUrl: null,
  tests: ['T4'],
  createdAt: new Date(2026, 2, 11, 8, 0).toISOString(),
  updatedAt: new Date(2026, 2, 11, 8, 15).toISOString(),
};

const IN_PROGRESS_RESULT: LabResult = {
  _id: 'result-partial',
  provider: 'IDEXX',
  resultId: 'res-8800',
  orderId: ORDER_ID,
  patientId: COMPANION_ID,
  status: 'PARTIAL',
  statusDetail: 'PARTIAL',
  createdAt: at(10, 20).toISOString(),
  updatedAt: at(10, 20).toISOString(),
  rawPayload: { categories: [] },
};

const FINAL_RESULT: LabResult = {
  _id: 'result-final',
  provider: 'IDEXX',
  resultId: RESULT_ID,
  orderId: ORDER_ID,
  patientId: COMPANION_ID,
  status: 'FINAL',
  statusDetail: 'FINAL',
  createdAt: at(11, 5).toISOString(),
  updatedAt: at(11, 20).toISOString(),
  rawPayload: {
    categories: [
      {
        name: 'Chemistry',
        tests: [
          // Dead centre of its range: the marker must land on the middle of the track.
          { name: 'Glucose', result: '7', units: 'mmol/L', referenceRange: '5 - 9' },
          // 14 in a 5-9 range is 225% along, so this one only stays inside the
          // card because the percentage is clamped.
          {
            name: 'Creatinine',
            result: '14',
            units: 'mg/dL',
            referenceRange: '5 - 9',
            outOfRange: true,
          },
        ],
      },
    ],
  },
};

/** A second finalised result, so "Print all Results" has more than one id to merge. */
const SECOND_RESULT: LabResult = {
  ...FINAL_RESULT,
  _id: 'result-final-2',
  resultId: 'res-9002',
  createdAt: at(11, 30).toISOString(),
  updatedAt: at(11, 40).toISOString(),
  rawPayload: { categories: [] },
};

const CONFIRMED_CENSUS: CensusEntry = {
  id: 4020,
  patient: { patientId: COMPANION_ID, name: 'Rosie' },
  veterinarian: 'Dr Aisha Rahman',
  ivls: [{ serialNumber: 'IVLS-7781', displayName: 'Catalyst One' }],
  confirmedBy: ['IVLS-7781'],
  confirmed: true,
};

/**
 * The backend's diagnostic read-model for this appointment. Only `PROVIDER_TEST`
 * items are diagnostics preloaded from services and packages; the other two
 * kinds are the orders and results the lab tables already draw, so a row of
 * either kind leaking into the preloaded list is a duplicate the clinician
 * would try to order twice.
 */
const DIAGNOSTIC_QUEUE: DiagnosticOrder[] = [
  {
    id: 'preload-1',
    orderCode: 'CBC',
    createdAt: at(9, 30).toISOString(),
    status: 'CREATED',
    kind: 'PROVIDER_TEST',
    provider: 'IDEXX',
    name: 'Complete Blood Count',
    sourceKind: 'PRODUCT_ITEM',
  },
  {
    // No `name`: the row falls back to the order code rather than rendering blank.
    id: 'preload-2',
    orderCode: 'SA-PANEL',
    createdAt: at(9, 30).toISOString(),
    status: 'CREATED',
    kind: 'PROVIDER_TEST',
    provider: 'IDEXX',
    sourceKind: 'PACKAGE_ITEM',
  },
  {
    id: 'queued-order',
    orderCode: ORDER_ID,
    createdAt: at(9, 40).toISOString(),
    status: 'SUBMITTED',
    kind: 'LAB_ORDER',
    provider: 'IDEXX',
    name: 'Chemistry 17 Panel',
  },
];

const encounter = (diagnosticOrders: DiagnosticOrder[]): AppointmentEncounter => ({
  appointmentId: APPOINTMENT_ID,
  mode: 'OUTPATIENT',
  consultationType: 'Outpatient consult',
  alerts: [],
  soap: [],
  soapTemplates: [],
  vitals: [],
  observations: [],
  diagnosticTests: [],
  diagnosticOrders,
  services: [],
  prescription: [],
  schedule: [],
  invoiceLineItems: [],
  pastInvoices: [],
  depositCents: 0,
  currency: 'USD',
  withdrawDeposit: false,
  taxPercent: 0,
  overallDiscountPercent: 0,
  dischargeSummary: '',
  documents: [],
  readyForBilling: { value: false },
  readyForDischarge: { value: false },
  stepStatus: {
    SOAP: 'DONE',
    DIAGNOSTICS: 'IN_PROGRESS',
    TREATMENT: 'EMPTY',
    PASSPORT: 'EMPTY',
    INVOICE: 'EMPTY',
    SUMMARY: 'EMPTY',
  },
  viewOnly: false,
});

// A byte-for-byte tiny PDF. The overlay frames a blob: URL built from whatever
// the service returns, so this keeps the story entirely local - no vendor host
// is ever contacted.
const PDF_BYTES = new TextEncoder().encode(
  [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj',
    'trailer<</Root 1 0 R>>',
    '%%EOF',
  ].join('\n')
);

type StoryFixtures = {
  /** Omit the IDEXX record from the integration store entirely. */
  connected?: boolean;
  /** Hold the IVLS device request open, which is what pins the loading frame. */
  holdDevices?: boolean;
  devices?: IvlsDevice[];
  tests?: IdexxTest[];
  census?: CensusEntry[];
  orders?: LabOrder[];
  results?: LabResult[];
  failOrderSearch?: boolean;
  /** Seeded onto the workspace store as this appointment's diagnostic read-model. */
  diagnosticOrders?: DiagnosticOrder[];
};

/**
 * A genuine `AxiosError`: a custom adapter has to REJECT for a non-2xx, because
 * axios only applies `validateStatus` inside its own built-in adapters.
 *
 * 404 rather than 500 for two reasons: the service layer logs every rejection
 * with `console.error` on its way up and the story verifier treats a console
 * error as a broken story unless it is an API 404, and 500 is on the axios
 * wrapper's transient-retry list, so it would be re-sent three times with
 * backoff before the step ever showed the message.
 */
const notFound = (config: Parameters<AxiosAdapter>[0]) =>
  Promise.reject(
    new AxiosError('Request failed with status code 404', 'ERR_BAD_REQUEST', config, undefined, {
      data: { message: 'Not Found' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config,
    } as AxiosResponse)
  );

/** Every PDF request the step made this story, with the params it carried. */
const pdfRequests: Array<{ url: string; resultIds?: string }> = [];

/**
 * Answers every IDEXX endpoint this step touches, at the adapter seam of the
 * shared axios instance.
 *
 * The adapter rather than `fetch`: `@/app/services/axios` is one instance with a
 * request interceptor that stamps the org header, an in-flight GET cache and a
 * 401 handler that signs the user out. Replacing `defaults.adapter` leaves all
 * of that in the path and stops only at the wire.
 */
const installIdexxApi = (fixtures: StoryFixtures) => {
  const previous = api.defaults.adapter;
  pdfRequests.length = 0;

  const adapter: AxiosAdapter = (config) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();
    const ok = (data: unknown) =>
      Promise.resolve({
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse);

    /* Results live under an UPPERCASE /IDEXX/ segment while everything else is
       lowercase. Matching the wrong case answers nothing and the step looks
       empty for no visible reason. `/pdf` is tested first because both the
       single-result and the combined-results endpoints end in it. */
    if (url.endsWith('/pdf')) {
      const params = config.params as { resultIds?: string } | undefined;
      pdfRequests.push({ url, resultIds: params?.resultIds });
      return ok(new Blob([PDF_BYTES], { type: 'application/pdf' }));
    }
    if (url.endsWith('/IDEXX/results')) {
      return ok(fixtures.results ?? []);
    }
    if (url.endsWith('/idexx/ivls/devices')) {
      if (fixtures.holdDevices) return new Promise<AxiosResponse>(() => {});
      return ok({ ivlsDeviceList: fixtures.devices ?? [] });
    }
    if (url.endsWith('/idexx/tests')) {
      return ok({ tests: fixtures.tests ?? [] });
    }
    if (url.endsWith('/idexx/census')) {
      if (method !== 'post') return ok([...(fixtures.census ?? [])]);
      return ok(fixtures.census?.[0] ?? null);
    }
    if (url.endsWith('/idexx/orders/search')) {
      return fixtures.failOrderSearch ? notFound(config) : ok(fixtures.orders ?? []);
    }
    // Anything else is an endpoint these stories did not think about. Failing it
    // beats inventing a shape the backend does not return.
    return notFound(config);
  };

  api.defaults.adapter = adapter;
  // `getData` dedupes in-flight GETs by key, so a pending read from the previous
  // story would otherwise be handed to this one, adapter swap and all.
  clearInFlightGetRequests();

  return () => {
    api.defaults.adapter = previous;
    clearInFlightGetRequests();
  };
};

const idexxIntegration = (status: OrgIntegration['status']): OrgIntegration => ({
  id: INTEGRATION_ID,
  organisationId: ORG_ID,
  provider: 'IDEXX',
  status,
  source: 'backend',
});

/**
 * Seeds the org, integration and workspace stores and installs the API stub.
 *
 * `useIntegrationByProviderForPrimaryOrg` is a pure read off `integrationStore`,
 * so seeding the store is the whole of "IDEXX is connected" - no request decides
 * it. All three stores are snapshotted and put back on unmount so neighbouring
 * stories are unaffected.
 */
const seed = (fixtures: StoryFixtures = {}) => {
  return () => {
    const orgSnapshot = useOrgStore.getState();
    const integrationSnapshot = useIntegrationStore.getState();
    const workspaceSnapshot = useAppointmentWorkspaceStore.getState();
    const connected = fixtures.connected ?? true;

    useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
    useIntegrationStore.setState({
      integrationsById: connected ? { [INTEGRATION_ID]: idexxIntegration('enabled') } : {},
      integrationIdsByOrgId: { [ORG_ID]: connected ? [INTEGRATION_ID] : [] },
      status: 'loaded',
    });
    useAppointmentWorkspaceStore.setState({
      encountersById: fixtures.diagnosticOrders
        ? { [APPOINTMENT_ID]: encounter(fixtures.diagnosticOrders) }
        : {},
    });

    const restoreApi = installIdexxApi(fixtures);

    return () => {
      restoreApi();
      useOrgStore.setState(orgSnapshot);
      useIntegrationStore.setState(integrationSnapshot);
      useAppointmentWorkspaceStore.setState(workspaceSnapshot);
    };
  };
};

const BASE: StoryFixtures = { devices: DEVICES, tests: TESTS, census: [CONFIRMED_CENSUS] };

const WITH_RESULTS: StoryFixtures = {
  ...BASE,
  orders: [SUBMITTED_ORDER],
  results: [FINAL_RESULT],
};

/**
 * `handlePrintAllResults` falls back to `window.print()` whenever the combined
 * PDF cannot be built. A print dialog in a headless runner has no way to be
 * dismissed, so the story that clicks that button neutralises it rather than
 * leaving a regression free to hang the suite.
 */
const seedWithoutPrintDialog = (fixtures: StoryFixtures) => {
  const install = seed(fixtures);
  return () => {
    const realPrint = globalThis.window.print;
    globalThis.window.print = () => {};
    const restoreStores = install();
    return () => {
      globalThis.window.print = realPrint;
      restoreStores();
    };
  };
};

/** The overlays portal onto <body>, so they are NOT inside `canvasElement`. */
const overlay = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);

/**
 * One `SectionContainer` card, scoped by its heading.
 *
 * Not optional: Order Status and Results number their rows with the same
 * `"{n}. Order {id}"` string, so an order that has a result puts the identical
 * text in two places and an unscoped `getByText` throws - or, worse, a future
 * regression that dropped one table would still satisfy a query that found the
 * other.
 */
const sectionOf = (canvas: ReturnType<typeof within>, title: string) =>
  within(canvas.getByText(title).closest('.rounded-2xl') as HTMLElement);

/** The meter track and its marker for one result row. */
const meterOf = (row: HTMLElement) => {
  const cells = row.querySelectorAll('td');
  const track = cells[cells.length - 1].firstElementChild as HTMLElement;
  const marker = track.firstElementChild as HTMLElement;
  return { track: track.getBoundingClientRect(), marker: marker.getBoundingClientRect() };
};

const meta = {
  title: 'Workspace/DiagnosticsStep',
  component: DiagnosticsStep,
  parameters: {
    layout: 'padded',
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/appointments/workspace' },
    },
    docs: {
      description: {
        component:
          'The workspace Diagnostics step: the provider pills, the IDEXX order builder, the test ' +
          'queue, the order and result tables, and the two PDF overlays - all of it the shared ' +
          '`useLabTests` hook rendered through the workspace layout rather than the appointment ' +
          'drawer.\n\n' +
          '**The provider row is not a switch yet.** IDEXX is the only selectable provider and it ' +
          'is always the selected one; RadAnalyzer is a disabled pill carrying its reason in ' +
          '`title`. `selectedProvider` therefore never changes, and nothing below the pills reads ' +
          'it - the IDEXX section renders unconditionally.\n\n' +
          '**Queueing here needs two steps.** Picking a search result only STAGES the test in a ' +
          'confirmation card; "Add to queue" is what puts it in the queue (bug #1973). The ' +
          'appointment-drawer panel at `Appointments/LabTests` queues on pick, so the same hook ' +
          'behaves differently in the two surfaces.\n\n' +
          'Every IDEXX endpoint is answered by an axios adapter stub, and the PDFs are locally ' +
          'built blobs. Two actions are left unclicked on purpose: **Create Lab Order** opens the ' +
          'vendor ordering iframe against a live vetconnectplus URL the moment the POST returns, ' +
          'and **Follow up / Continue** does the same, so the stories assert the enabled/disabled ' +
          'contract around those buttons instead of firing them.\n\n' +
          'Read the states from the Canvas rather than the Docs page: every example shares one ' +
          'org store and one axios adapter, so on Docs the last story to mount wins.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: APPOINTMENT,
    onOpenTreatment: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(BASE),
} satisfies Meta<typeof DiagnosticsStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoOrdersYet: Story = {
  name: 'Connected, nothing ordered yet',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The four sections the step is assembled from, in order down the page.
    await expect(await canvas.findByText('Order Builder')).toBeInTheDocument();
    await expect(canvas.getByText('Test Queue')).toBeInTheDocument();
    await expect(canvas.getByText('Order Status')).toBeInTheDocument();
    await expect(canvas.getByText('Results')).toBeInTheDocument();

    // Three empty states, and each says something different about WHY it is
    // empty - the queue points at the builder above it, the other two are facts.
    await expect(
      canvas.getByText('No tests selected yet. Search and add tests from the Order Builder.')
    ).toBeInTheDocument();
    await expect(
      await canvas.findByText('No lab orders for this appointment yet.')
    ).toBeInTheDocument();
    await expect(canvas.getByText('No results available yet.')).toBeInTheDocument();

    // Ordering nothing is not an order: the CTA stays disabled until the queue
    // has something in it.
    await expect(canvas.getByRole('button', { name: 'Create Lab Order' })).toBeDisabled();

    /* The two practitioner fields are pre-filled from the booking: the lead
       becomes the veterinarian and the first support member who is NOT the lead
       becomes the technician. Both fall back to a bare placeholder if that
       derivation breaks, which reads as "not recorded" rather than as a bug. */
    await expect(
      canvas.getByRole('button', { name: 'Veterinarian: Dr Aisha Rahman' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Technician: Sam Okoro' })).toBeInTheDocument();
    // Reference lab is the default modality, so the builder is the search form
    // rather than the in-house census panel.
    await expect(
      canvas.getByRole('button', { name: 'Test Type: Reference lab' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Search for lab tests' })).toBeInTheDocument();

    // Nothing preloaded means the section is absent, not an empty card.
    await expect(canvas.queryByText('Preloaded from Services & Packages')).toBeNull();

    // The footer's exit into the treatment plan is a handler, not a link - it
    // moves the workspace step rather than navigating.
    await userEvent.click(canvas.getByRole('button', { name: 'Treatment Plan' }));
    await expect(args.onOpenTreatment).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('link', { name: 'Open labs workspace' })).toHaveAttribute(
      'href',
      '/appointments/idexx-workspace'
    );
  },
};

export const ProviderPills: Story = {
  name: 'RadAnalyzer is present but unreachable',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* IDEXX is icon-and-logo only, so its `aria-label` is its ONLY name - the
       logo's alt text is inside an <Image> that may never load. */
    const idexx = canvas.getByRole('button', { name: 'Open the IDEXX workspace' });
    await expect(idexx).toHaveAttribute('aria-pressed', 'true');
    await expect(idexx).toBeEnabled();

    /* RadAnalyzer has no `workspaceHref`, so it gets no aria-label and is named
       by its own content instead. It is disabled, which means `onSelect` can
       never fire for it: the provider row cannot actually be switched. */
    const rad = canvas.getByRole('button', { name: 'RadAnalyzer Coming soon' });
    await expect(rad).toBeDisabled();
    await expect(rad).toHaveAttribute('aria-pressed', 'false');

    /* The reason lives in `title` and nowhere else on screen - "Coming soon" on
       its own does not say for how long or why. Losing the title leaves a dead
       pill with no explanation, and nothing else in the tree would change. */
    await expect(rad).toHaveAttribute(
      'title',
      'RadAnalyzer diagnostics are coming soon for the appointment workspace.'
    );

    // The pills do not gate what is under them: the IDEXX section renders
    // regardless of which pill is pressed.
    await expect(await canvas.findByText('Order Builder')).toBeInTheDocument();
  },
};

export const QueueingATest: Story = {
  name: 'Staging a test, then queueing it',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByRole('textbox', { name: 'Search for lab tests' });

    // `minChars` is 0, so focus alone opens the catalogue - there is nothing to
    // type for a clinician who just wants to browse it.
    await userEvent.click(search);
    // The list sits behind a 300ms debounce on the tests request.
    await userEvent.click(await canvas.findByText('Complete Blood Count'));

    /* Picking STAGES the test, it does not queue it. This is the whole of bug
       #1973: the appointment-drawer panel queues on pick, and a change that made
       this one do the same would look like an improvement while quietly removing
       the confirmation step. */
    const pending = await canvas.findByTestId('pending-test-confirmation');
    // Regex rather than the exact string: the price is formatted through
    // `toLocaleString`, so pinning "$38.50" would pin the runner's locale too.
    await expect(within(pending).getByText(/^Code: CBC · /)).toBeInTheDocument();
    await expect(
      canvas.getByText('No tests selected yet. Search and add tests from the Order Builder.')
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Create Lab Order' })).toBeDisabled();

    await userEvent.click(within(pending).getByRole('button', { name: 'Add to queue' }));

    /* Now it is a queue card, and only now can an order be placed. The card
       carries the code and the price the clinician is committing to. */
    await expect(canvas.queryByTestId('pending-test-confirmation')).toBeNull();
    await expect(canvas.getByRole('heading', { name: 'Complete Blood Count' })).toBeInTheDocument();
    await expect(canvas.getByText('Code: CBC')).toBeInTheDocument();
    await expect(canvas.getByText('24 hours')).toBeInTheDocument();
    await expect(canvas.getByText('EDTA whole blood')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Create Lab Order' })).toBeEnabled();

    /* Removing it puts the CTA back: a stale enabled button posts an order with
       no tests on it. The remove control is icon-only, so its name is its only
       handle - and it names the test, because a queue holds several. */
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Complete Blood Count' }));
    await expect(
      await canvas.findByText('No tests selected yet. Search and add tests from the Order Builder.')
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Create Lab Order' })).toBeDisabled();
  },
};

export const OrderPlaced: Story = {
  name: 'Order placed, results in process',
  beforeEach: seed({
    ...BASE,
    orders: [SUBMITTED_ORDER, PAST_ORDER],
    results: [IN_PROGRESS_RESULT],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Waiting on the pill rather than on a row: the pill only reads "In process"
       once BOTH the orders and the results have landed, and the row text is
       ambiguous until the section scope below is applied. */
    await canvas.findByTitle('In process');
    const orders = sectionOf(canvas, 'Order Status');

    // Rows are numbered in the newest-first order the hook normalises to, so the
    // submitted order leads and the previous day's order follows.
    await expect(orders.getByText(`1. Order ${ORDER_ID}`)).toBeInTheDocument();
    await expect(orders.getByText(`2. Order ${PAST_ORDER_ID}`)).toBeInTheDocument();

    /* The pill reads RESULT progress rather than order status, so a submitted
       order IDEXX is still running says "In process" instead of the misleading
       "Submitted". StatusPill mirrors its label into `title`, which is the least
       ambiguous way to read it - the label text is uppercased by CSS, not in
       the DOM. */
    await expect(orders.getByTitle('In process')).toBeInTheDocument();
    await expect(orders.getByTitle('Created')).toBeInTheDocument();

    // Order-level notes survive a reload and are shown on the row (bug #1973),
    // with the full text kept in `title` because the line truncates.
    await expect(
      orders.getByText('Fasted sample, collected from the left jugular.')
    ).toBeInTheDocument();

    /* Origin pills: the provider, and the modality read out of its
       SCREAMING_CASE enum through a lookup. Scoped to this section because the
       order builder's modality dropdown shows "Reference lab" too - an unscoped
       query would pass with the pill missing entirely. */
    await expect(orders.getByText('Reference lab')).toBeInTheDocument();
    await expect(orders.getByText('In-house')).toBeInTheDocument();
    await expect(orders.queryByText('REFERENCE_LAB')).toBeNull();
    await expect(orders.queryByText('INHOUSE')).toBeNull();

    // A SUBMITTED order offers "Follow up", live because its uiUrl is on an
    // allowed IDEXX host.
    await expect(
      canvas.getByRole('button', { name: `Follow up for order ${ORDER_ID}` })
    ).toBeEnabled();

    /* The older order's uiUrl is on a host outside the IDEXX allowlist, so
       `getSafeIdexxIframeUrl` returns nothing and the action must be inert. This
       is the silent one: the button looks identical either way, and a regression
       in the allowlist would only show as a frame pointed at an arbitrary host. */
    await expect(
      canvas.getByRole('button', { name: `Continue for order ${PAST_ORDER_ID}` })
    ).toBeDisabled();

    // Same for the acknowledgement: the submitted order has a PDF, the older
    // one does not.
    await expect(
      canvas.getByRole('button', { name: `View acknowledgement for order ${ORDER_ID}` })
    ).toBeEnabled();
    await expect(
      canvas.getByRole('button', { name: `View acknowledgement for order ${PAST_ORDER_ID}` })
    ).toBeDisabled();

    /* The result table is a SEPARATE section keyed on the result, not the order,
       so the same order id appears in both - which is why every query above is
       scoped. A PARTIAL result carries no categories, so this row exists but has
       nothing to expand into; that is the difference from the story below. */
    const results = sectionOf(canvas, 'Results');
    await expect(results.getByTitle('Partial')).toBeInTheDocument();
    await expect(results.getByText(`1. Order ${ORDER_ID}`)).toBeInTheDocument();
  },
};

export const ResultsReturned: Story = {
  name: 'Results returned, in and out of range',
  beforeEach: seed(WITH_RESULTS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* A complete order swaps its ordering action for the result PDF: there is
       nothing left to continue on the vendor side. */
    await expect(await canvas.findByTitle('Complete')).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: `Open result PDF for order ${ORDER_ID}` })
    ).toBeEnabled();
    await expect(canvas.getByTitle('Final')).toBeInTheDocument();

    /* The first result's breakdown is open on arrival - `ResultsSection`
       initialises `expandedId` from `s.results[0]`, and the toggle's name is
       "Hide" rather than "Show" to match. Asserted before any click, because
       that initialiser runs once when the section mounts: it only lands on the
       right result if the section mounts AFTER the results do, which is a
       property of the load order rather than of the component. */
    const table = await canvas.findByRole('table');
    await expect(
      canvas.getByRole('button', { name: `Hide results for result ${RESULT_ID}` })
    ).toBeInTheDocument();
    await expect(within(table).getByText('7 mmol/L')).toBeInTheDocument();

    /* In range, dead centre. The marker is offset by half its own width
       (`calc(50% - 3px)`), so its CENTRE - not its left edge - is the value.
       Drop that correction and every reading sits 3px low with nothing to show
       for it. */
    const inRange = meterOf(canvas.getByText('Glucose').closest('tr') as HTMLElement);
    await expect(
      Math.abs(
        inRange.marker.left +
          inRange.marker.width / 2 -
          inRange.track.left -
          inRange.track.width / 2
      )
    ).toBeLessThanOrEqual(1);

    /* 14 against a 5-9 range is 225% along the track. Clamped, it pins to the
       right-hand end; unclamped it would be drawn hundreds of pixels outside the
       card, over whatever sits beside it. */
    const outOfRange = meterOf(canvas.getByText('Creatinine').closest('tr') as HTMLElement);
    await expect(
      Math.abs(
        outOfRange.marker.left +
          outOfRange.marker.width / 2 -
          outOfRange.track.left -
          outOfRange.track.width
      )
    ).toBeLessThanOrEqual(1);

    /* The toggle is a real toggle: the same control collapses it again, its name
       flips with the state, and it names the RESULT - the step can list several,
       and an icon-only eye repeated down the column is otherwise unnameable. A
       label frozen on "Show" would leave a screen reader announcing "Show" over
       an open table. */
    await userEvent.click(
      canvas.getByRole('button', { name: `Hide results for result ${RESULT_ID}` })
    );
    await waitFor(async () => {
      await expect(canvas.queryByRole('table')).toBeNull();
    });
    await userEvent.click(
      canvas.getByRole('button', { name: `Show results for result ${RESULT_ID}` })
    );
    await expect(await canvas.findByRole('table')).toBeInTheDocument();
  },
};

export const CombinedResultsPdf: Story = {
  name: 'Print all Results: one merged PDF',
  beforeEach: seedWithoutPrintDialog({
    ...BASE,
    orders: [SUBMITTED_ORDER],
    results: [FINAL_RESULT, SECOND_RESULT],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Complete');
    // Both results have to be on screen before printing, or the id list below is
    // short for a reason that has nothing to do with the button.
    await expect(sectionOf(canvas, 'Results').getAllByTitle('Final')).toHaveLength(2);

    await userEvent.click(canvas.getByRole('button', { name: 'Print all Results' }));

    const frame = await overlay(canvasElement).findByTitle('All lab results');
    await expect((frame as HTMLIFrameElement).getAttribute('src')).toMatch(/^blob:/);

    /* Every result id goes to the backend in ONE request - the point of the
       action is a single merged document. Sending the first id only would still
       open an overlay with a valid PDF in it, showing one result out of two. */
    await expect(pdfRequests).toHaveLength(1);
    await expect(pdfRequests[0].resultIds).toBe(`${RESULT_ID},res-9002`);
    await expect(pdfRequests[0].url).toContain(`/organisation/${ORG_ID}/IDEXX/results/pdf`);

    /* Closing revokes the object URL, so the overlay has to actually unmount - a
       hidden-but-mounted frame would be left pointed at a revoked blob. The
       close control names WHICH overlay it closes, because the step mounts two
       PdfPreviewOverlays at once. */
    await userEvent.click(
      overlay(canvasElement).getByRole('button', { name: 'Close combined results PDF' })
    );
    await waitFor(async () => {
      await expect(overlay(canvasElement).queryByTitle('All lab results')).toBeNull();
    });
  },
};

export const ReadOnly: Story = {
  name: 'Locked appointment',
  args: { readOnly: true },
  beforeEach: seed(WITH_RESULTS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Test Queue');

    /* The whole order builder is GONE, not disabled: no search, no notes, no
       practitioner fields, and no way to place an order. Asserting the queue
       copy alone would pass with the builder still sitting above it. */
    await expect(canvas.queryByText('Order Builder')).toBeNull();
    await expect(canvas.queryByRole('textbox', { name: 'Search for lab tests' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Create Lab Order' })).toBeNull();

    /* The empty queue says something different once locked: "nothing was
       selected before this was locked" rather than "add some" - the instruction
       would point at a form that is no longer on the page. */
    await expect(
      canvas.getByText('No draft lab tests were selected before this appointment was locked.')
    ).toBeInTheDocument();

    // Everything that only READS stays: the order table, the results, and the
    // routes out of the step.
    await canvas.findByTitle('Complete');
    await expect(
      sectionOf(canvas, 'Order Status').getByText(`1. Order ${ORDER_ID}`)
    ).toBeInTheDocument();
    /* The result breakdown is still expandable, and still open by default: a
       locked appointment is read-only, not hidden, and the breakdown is the only
       place the actual values are shown. */
    await expect(
      canvas.getByRole('button', { name: `Hide results for result ${RESULT_ID}` })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Refresh Orders' })).toBeEnabled();
    await expect(canvas.getByRole('link', { name: 'Open labs workspace' })).toBeInTheDocument();
  },
};

export const PreloadedFromServices: Story = {
  name: 'Diagnostics preloaded from services and packages',
  beforeEach: seed({ ...BASE, diagnosticOrders: DIAGNOSTIC_QUEUE }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByText('Preloaded from Services & Packages');
    const section = heading.closest('.rounded-2xl') as HTMLElement;
    const items = within(section).getAllByRole('listitem');

    /* Two rows, not three. The backend's diagnostic read-model mixes preloaded
       tests with the orders and results the tables below already draw, and only
       `PROVIDER_TEST` items belong here - a LAB_ORDER leaking through would tell
       the clinician to order something that has already been ordered. */
    await expect(items).toHaveLength(2);
    await expect(within(section).queryByText('Chemistry 17 Panel')).toBeNull();

    await expect(within(items[0]).getByText('Complete Blood Count')).toBeInTheDocument();
    await expect(within(items[0]).getByText('Service')).toBeInTheDocument();
    // No `name` on the second item, so the row falls back to the order code
    // rather than rendering an empty line with two pills after it.
    await expect(within(items[1]).getByText('SA-PANEL')).toBeInTheDocument();
    await expect(within(items[1]).getByText('Package')).toBeInTheDocument();

    // The raw enum is title-cased through a lookup, so an unmapped `sourceKind`
    // renders no pill at all rather than SCREAMING_CASE.
    await expect(within(section).queryByText('PRODUCT_ITEM')).toBeNull();
    await expect(within(section).queryByText('PACKAGE_ITEM')).toBeNull();
  },
};

export const NotConnected: Story = {
  name: 'IDEXX not connected',
  beforeEach: seed({ connected: false }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('IDEXX integration is not enabled for this organization.')
    ).toBeInTheDocument();

    // The way out has to be a real link: this line of copy is the only route
    // from the appointment to switching the integration on.
    await expect(
      canvas.getByRole('link', { name: 'Enable IDEXX in Integrations' })
    ).toHaveAttribute('href', '/integrations');

    // Nothing behind the gate renders - no builder, no tables - so there is no
    // form to fill in against an integration that cannot receive it.
    await expect(canvas.queryByText('Order Builder')).toBeNull();
    await expect(canvas.queryByText('Order Status')).toBeNull();

    // The provider row survives the gate: it is drawn above the IDEXX section,
    // not inside it.
    await expect(
      canvas.getByRole('button', { name: 'Open the IDEXX workspace' })
    ).toBeInTheDocument();
  },
};

export const ServiceError: Story = {
  name: 'The order list fails to load',
  beforeEach: seed({ ...BASE, failOrderSearch: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The message carries the status and the backend's own text rather than a
       generic apology.

       Two copies, and that is deliberate: the section renders the error at the
       top and again beside the Create Lab Order button, because the order is
       placed several screens below the heading and the top copy alone would be
       off-screen at the moment it appears. `findByText` throws on multiple
       matches, which is what failed here - the assertion, not the component. The
       count is asserted so that losing either copy is still caught. */
    const messages = await canvas.findAllByText(
      'Unable to load appointment lab orders. (404): Not Found'
    );
    await expect(messages).toHaveLength(2);

    /* A failed listing must not take the ordering form down with it: a clinician
       can still place the order they came here to place. The tables fall back to
       their empty states rather than to a half-populated list. */
    await expect(canvas.getByText('Order Builder')).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Search for lab tests' })).toBeInTheDocument();
    await expect(canvas.getByText('No lab orders for this appointment yet.')).toBeInTheDocument();
    await expect(canvas.getByText('No results available yet.')).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* The width is pinned here as well as through the viewport global. The global
     is applied by the Storybook MANAGER, so a runner loading `iframe.html`
     directly renders this at panel width - where a 620px table fits and the
     overflow assertion below is true for the wrong reason. */
  decorators: [
    (Story) => (
      <div className="w-[375px] bg-[var(--screen)] p-3">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(WITH_RESULTS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTitle('Complete');

    // The first result opens by itself, so the breakdown is on screen at 375px
    // without anyone asking for it - which is what makes the overflow below the
    // default phone experience rather than an edge case.
    const table = await canvas.findByRole('table');
    const scroller = table.parentElement as HTMLElement;

    /* The result table has a 620px floor, so on a 375px column the only thing
       keeping the step usable is the table's own overflow container: the table
       stays 620px wide, the box around it stays inside the phone, and the box
       is what scrolls. All three are asserted because dropping the container
       leaves the first one true while the whole step gains a horizontal
       scrollbar. Measured against the pinned 375px frame rather than the
       document, so it means the same thing whatever width the runner gives the
       iframe. */
    await expect(Math.round(table.getBoundingClientRect().width)).toBeGreaterThanOrEqual(620);
    await expect(scroller.getBoundingClientRect().width).toBeLessThan(375);
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  },
};
