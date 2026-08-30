import type { Meta, StoryObj } from '@storybook/react';
import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { expect, userEvent, waitFor, within } from 'storybook/test';
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
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useOrgStore } from '@/app/stores/orgStore';
import LabTests from './LabTests';

const ORG_ID = 'org-storybook-idexx';
const INTEGRATION_ID = 'int-idexx-1';
const COMPANION_ID = 'companion-idexx-1';
const APPOINTMENT_ID = 'appt-idexx-1';
const ORDER_ID = 'IDX-100244';
const PAST_ORDER_ID = 'IDX-100109';

// Local Date parts, not a UTC literal: the order and result cards render
// `formatDateTimeLocal`, so a `Z` literal slides by the runner's offset.
const at = (hour: number, minute: number) => new Date(2026, 2, 12, hour, minute);

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: {
    id: COMPANION_ID,
    name: 'Rosie',
    species: 'dog',
    breed: 'Cocker Spaniel',
    parent: { id: 'parent-idexx-1', name: 'Marta Cole' },
  },
  // `companion`, not `patient`, is what the panel reads for the patient id and
  // the parent id it sends to census, so an appointment missing it silently
  // disables both ordering and census.
  companion: {
    id: COMPANION_ID,
    name: 'Rosie',
    species: 'dog',
    breed: 'Cocker Spaniel',
    parent: { id: 'parent-idexx-1', name: 'Marta Cole' },
  },
  lead: { id: 'vet-1', name: 'Dr Aisha Rahman' },
  supportStaff: [{ id: 'tech-1', name: 'Sam Okoro' }],
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
  {
    _id: 'idexx-test-2',
    code: 'CHEM17',
    display: 'Chemistry 17 Panel',
    type: 'PROFILE',
    meta: {
      listPrice: '52.00',
      currencyCode: 'USD',
      turnaround: '24 hours',
      specimen: 'Serum',
    },
  },
  // No price, no turnaround, no specimen: every one of those falls back to a
  // sentence rather than an empty pill.
  { _id: 'idexx-test-3', code: 'T4', display: 'Total T4', type: 'ASSAY' },
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
  parentId: 'parent-idexx-1',
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
  createdAt: at(9, 40).toISOString(),
  updatedAt: at(10, 5).toISOString(),
};

/**
 * Deliberately carries a uiUrl on a host that is NOT idexx.com or
 * vetconnectplus.com, and no acknowledgment at all. `getSafeIdexxIframeUrl`
 * rejects the host, which is what leaves both of this card's actions disabled.
 */
const PAST_ORDER: LabOrder = {
  _id: 'order-1',
  organisationId: ORG_ID,
  provider: 'IDEXX',
  companionId: COMPANION_ID,
  appointmentId: APPOINTMENT_ID,
  patientName: 'Rosie',
  status: 'CREATED',
  modality: 'REFERENCE_LAB',
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
  resultId: 'res-9001',
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
          // Dead centre of its range: the meter marker must land on the middle
          // of the track.
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
          // Unspaced range. `parseReferenceRange` reads "8.2" as "-8.2" here and
          // gives up, so this renders N/A rather than a meter - current
          // behaviour, pinned so a fix has to come past this story.
          { name: 'Total protein', result: '6.1', units: 'g/dL', referenceRange: '5.4-8.2' },
          // Non-numeric result with no range at all: the honest N/A.
          { name: 'Sample quality', result: 'Adequate' },
        ],
      },
    ],
  },
};

/** An earlier PDF for the SAME order, so the newest has something to beat. */
const SUPERSEDED_RESULT: LabResult = {
  ...FINAL_RESULT,
  _id: 'result-superseded',
  resultId: 'res-8999',
  createdAt: at(10, 30).toISOString(),
  updatedAt: at(10, 40).toISOString(),
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

// A byte-for-byte tiny PDF. The preview overlay frames a blob: URL built from
// whatever the service returns, so this keeps the story entirely local - no
// vendor host is ever contacted.
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
};

/**
 * A genuine `AxiosError`: a custom adapter has to REJECT for a non-2xx, because
 * axios only applies `validateStatus` inside its own built-in adapters.
 *
 * 404 rather than 500 for two reasons. `postData` logs every rejection with
 * `console.error` on its way up and the story verifier treats a console error as
 * a broken story unless it is an API 404, and 500 is on the axios wrapper's
 * transient-retry list, so a 500 would be re-sent three times with backoff
 * before the panel ever showed the message.
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

/**
 * Answers every IDEXX endpoint this panel touches, at the adapter seam of the
 * shared axios instance.
 *
 * The adapter rather than `fetch`: `@/app/services/axios` is one instance with a
 * request interceptor that stamps the org header, an in-flight GET cache and a
 * 401 handler that signs the user out. Replacing `defaults.adapter` leaves all
 * of that in the path and stops only at the wire, and `mergeConfig` reads the
 * instance defaults per request so it takes effect on an instance created long
 * before the story.
 *
 * The census list is stateful on purpose: "add to census" is a POST followed by
 * a re-read, and a fixed reply would make the panel claim the companion is still
 * missing after a successful add.
 */
const installIdexxApi = (fixtures: StoryFixtures) => {
  const census = [...(fixtures.census ?? [])];
  const previous = api.defaults.adapter;

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

    // Results live under an UPPERCASE /IDEXX/ segment while everything else is
    // lowercase. Matching the wrong case answers nothing and the panel looks
    // empty for no visible reason.
    if (url.endsWith('/pdf')) {
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
      if (method !== 'post') return ok([...census]);
      const payload = (
        typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})
      ) as { patientId?: string; veterinarian?: string; ivls?: string[] };
      // Echoes the analyser back as UNCONFIRMED, which is what IDEXX does: the
      // IVLS device confirms the patient itself, minutes later.
      const entry: CensusEntry = {
        id: 4021,
        patient: { patientId: String(payload.patientId ?? COMPANION_ID), name: 'Rosie' },
        veterinarian: payload.veterinarian ?? null,
        ivls: (payload.ivls ?? []).map((serialNumber) => ({
          serialNumber,
          displayName: 'Catalyst One',
        })),
        confirmedBy: [],
        confirmed: false,
      };
      census.push(entry);
      return ok(entry);
    }
    if (url.endsWith('/idexx/orders/search')) {
      return fixtures.failOrderSearch ? notFound(config) : ok(fixtures.orders ?? []);
    }
    // Anything else is an endpoint these stories did not think about. Failing it
    // is better than inventing a shape the backend does not return.
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
 * Seeds the org and integration stores and installs the API stub.
 *
 * `useIntegrationByProviderForPrimaryOrg` is a pure read off `integrationStore`,
 * so seeding the store is the whole of "IDEXX is connected" - no request is
 * involved in that decision. Both stores are snapshotted and put back on unmount
 * so neighbouring stories are unaffected.
 */
const seed = (fixtures: StoryFixtures = {}) => {
  return () => {
    const orgSnapshot = useOrgStore.getState();
    const integrationSnapshot = useIntegrationStore.getState();
    const connected = fixtures.connected ?? true;

    useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
    useIntegrationStore.setState({
      integrationsById: connected ? { [INTEGRATION_ID]: idexxIntegration('enabled') } : {},
      integrationIdsByOrgId: { [ORG_ID]: connected ? [INTEGRATION_ID] : [] },
      status: 'loaded',
    });

    const restoreApi = installIdexxApi(fixtures);

    return () => {
      restoreApi();
      useOrgStore.setState(orgSnapshot);
      useIntegrationStore.setState(integrationSnapshot);
    };
  };
};

const BASE: StoryFixtures = { devices: DEVICES, tests: TESTS };

/** Opens a `LabelDropdown` and picks one option out of its portalled panel. */
const chooseOption = async (trigger: HTMLElement, optionName: string) => {
  await userEvent.click(trigger);
  // The panel is portalled onto document.body, so it is NOT inside canvasElement.
  const menu = within(globalThis.document.body);
  await userEvent.click(await menu.findByRole('button', { name: optionName }));
};

/** The meter track and its marker for one result row. */
const meterOf = (row: HTMLElement) => {
  const cells = row.querySelectorAll('td');
  const track = cells[cells.length - 1].firstElementChild as HTMLElement;
  const marker = track.firstElementChild as HTMLElement;
  return { track: track.getBoundingClientRect(), marker: marker.getBoundingClientRect() };
};

const meta = {
  title: 'Appointments/LabTests',
  component: LabTests,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The IDEXX lab panel inside an appointment: the order builder (reference lab or ' +
          'in-house), the order and requisition status, and the returned results with their ' +
          'reference-range meters. Everything here is our own UI over our own service layer - ' +
          'nothing vendor-hosted is embedded except the ordering frame, which these stories ' +
          'deliberately never open.\n\n' +
          'Two actions are left unclicked on purpose. **Create IDEXX order** opens the vendor ' +
          'ordering iframe against a live vetconnectplus URL the moment the POST returns, and ' +
          '**Follow up / Continue** does the same, so the stories assert the enabled/disabled ' +
          'contract around those buttons instead of firing them.\n\n' +
          'Read the states from the Canvas rather than the Docs page: every example shares one ' +
          'org store and one axios adapter, so on Docs the last story to mount wins.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeAppointment: APPOINTMENT,
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[760px]">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(BASE),
} satisfies Meta<typeof LabTests>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotConnected: Story = {
  name: 'IDEXX not connected',
  beforeEach: seed({ connected: false }),
  parameters: {
    docs: {
      description: {
        story:
          'What an organisation that has never connected IDEXX sees. An IDEXX record with any ' +
          'status other than `enabled` renders the same panel.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('IDEXX integration is not enabled for this organization.')
    ).toBeInTheDocument();
    // The way out has to be a real link. This line of copy is the only route
    // from the appointment to switching the integration on.
    await expect(
      canvas.getByRole('link', { name: 'Enable IDEXX in Integrations' })
    ).toHaveAttribute('href', '/integrations');
    // Nothing behind the gate renders: no order form to fill in against an
    // integration that cannot receive it.
    await expect(
      canvas.queryByRole('button', { name: 'Create lab order' })
    ).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  name: 'Loading the integration',
  beforeEach: seed({ ...BASE, holdDevices: true }),
  parameters: {
    docs: {
      description: {
        story:
          'Held on the IVLS device request. Everything else - the order form, the status panel ' +
          'and the results - is behind this one call, so a slow device list blanks the whole ' +
          'section rather than degrading part of it.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // findBy, not getBy: `loading` is only set once the device effect runs, so
    // the very first paint is still the form.
    await expect(await canvas.findByText('Loading IDEXX integration…')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Results' })).not.toBeInTheDocument();
  },
};

export const NoOrdersYet: Story = {
  name: 'Connected, nothing ordered yet',
  parameters: {
    docs: {
      description: {
        story:
          'The first visit state: no order, no result, companion not on census. The two ' +
          'practitioner fields are the part worth watching - they are pre-filled from the ' +
          "appointment's lead and support staff, so a clinician never retypes what the booking " +
          'already knows.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No tests selected yet.')).toBeInTheDocument();

    // Ordering nothing is not an order: the CTA stays disabled until the queue
    // has something in it.
    await expect(canvas.getByRole('button', { name: 'Create IDEXX order' })).toBeDisabled();

    // Pre-fill wiring. The lead becomes the veterinarian and the first support
    // member who is NOT the lead becomes the technician; both silently fall back
    // to an empty control if that derivation breaks.
    await expect(
      canvas.getByRole('button', { name: 'Veterinarian: Dr Aisha Rahman' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Technician: Sam Okoro' })).toBeInTheDocument();

    await expect(
      await canvas.findByText('No lab orders found for this appointment yet.')
    ).toBeInTheDocument();
    await expect(canvas.getByText('No results available yet.')).toBeInTheDocument();

    // The IDEXX Hub shortcut is icon-only, so its aria-label is its ONLY name.
    await expect(canvas.getByRole('link', { name: 'Open IDEXX Hub' })).toHaveAttribute(
      'href',
      '/appointments/idexx-workspace'
    );
  },
};

export const QueueingTests: Story = {
  name: 'Queueing a test',
  parameters: {
    docs: {
      description: {
        story:
          'Search, pick, and the test lands in the queue. In this panel selecting a search ' +
          'result queues it outright - unlike the workspace Diagnostics step, where a searched ' +
          'test is only staged until "Add to Queue" is pressed.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByPlaceholderText('Search IDEXX tests');
    // minChars is 0 here, so focus alone opens the list - there is nothing to
    // type for a clinician who just wants to browse the catalogue.
    await userEvent.click(search);

    // The list is behind a 300ms debounce on the tests request.
    const option = await canvas.findByText('Complete Blood Count');
    // A test IDEXX did not price says so, rather than showing an empty pill.
    await expect(canvas.getByText('Rate unavailable')).toBeInTheDocument();

    await userEvent.click(option);

    const chip = await canvas.findByTitle('Remove test from selection');
    await expect(chip).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Create IDEXX order' })).toBeEnabled();

    // The queue is the only thing between the two states, so removing the chip
    // has to put the CTA back to disabled - a stale enabled button posts an
    // order with no tests on it.
    await userEvent.click(chip);
    await expect(await canvas.findByText('No tests selected yet.')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Create IDEXX order' })).toBeDisabled();
  },
};

export const InHouseCensus: Story = {
  name: 'In-house: adding the companion to census',
  beforeEach: seed({ ...BASE, census: [] }),
  parameters: {
    docs: {
      description: {
        story:
          'The in-house branch, reachable only through the modality dropdown. An in-house run ' +
          'needs the companion on the IDEXX census for the selected analyser, so this panel is ' +
          'the whole of that workflow: pick the IVLS device, add the companion, then wait for ' +
          'the analyser to confirm.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await chooseOption(
      await canvas.findByRole('button', { name: 'Modality: Reference lab' }),
      'In-house'
    );
    await chooseOption(
      await canvas.findByRole('button', { name: 'Select IVLS device' }),
      'Catalyst One (IVLS-7781)'
    );

    await expect(
      await canvas.findByText('Companion census status: Not added to census')
    ).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Add to census' }));

    await expect(
      await canvas.findByText('Companion census status: Already added to census')
    ).toBeInTheDocument();

    // A fresh entry is NOT ready. IDEXX confirms the patient on the analyser
    // itself, so reporting "ready" here would send a nurse to a machine that has
    // never heard of the patient.
    await expect(
      canvas.getByText('IVLS confirmation: Pending for selected device')
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'Current appointment state: Added to selected device census, awaiting IVLS confirmation'
      )
    ).toBeInTheDocument();
    // Named device, not a bare serial - the nurse has to find the right box.
    await expect(
      canvas.getByText('Census device ID: Catalyst One (IVLS-7781)')
    ).toBeInTheDocument();

    // IDEXX allows exactly one census entry per patient, so the add action has
    // to disappear once one exists. Offering it twice earns a vendor 4xx.
    await expect(canvas.queryByRole('button', { name: 'Add to census' })).not.toBeInTheDocument();
  },
};

export const OrderSubmitted: Story = {
  name: 'Order placed, results in process',
  beforeEach: seed({
    ...BASE,
    census: [CONFIRMED_CENSUS],
    orders: [SUBMITTED_ORDER, PAST_ORDER],
    results: [IN_PROGRESS_RESULT],
  }),
  parameters: {
    docs: {
      description: {
        story:
          'A submitted order with a partial result back, plus an earlier order in the same ' +
          'appointment. The pill reads the RESULT progress rather than the order status, so a ' +
          'submitted order that IDEXX is still running says "In process" instead of the ' +
          'misleading "Submitted".',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // StatusPill mirrors its label into `title`, which is the least ambiguous
    // way to read it - the label text is uppercased by CSS, not in the DOM.
    await expect(await canvas.findByTitle('In process')).toBeInTheDocument();
    await expect(canvas.getByText(`Order ${ORDER_ID}`)).toBeInTheDocument();

    // A SUBMITTED order offers "Follow up", and it is live because its uiUrl is
    // on an allowed IDEXX host.
    await expect(canvas.getByRole('button', { name: 'Follow up' })).toBeEnabled();

    await expect(canvas.getByText('Past orders in this appointment')).toBeInTheDocument();
    await expect(canvas.getByText(`Order ${PAST_ORDER_ID}`)).toBeInTheDocument();
    await expect(canvas.getByTitle('Created')).toBeInTheDocument();

    // The older order's uiUrl is on a host outside the IDEXX allowlist, so
    // `getSafeIdexxIframeUrl` returns nothing and the action must be inert. This
    // is the silent one: the button looks identical either way, and a regression
    // in the allowlist would only show as a frame pointed at an arbitrary host.
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();

    // Same story for the acknowledgment: the submitted order has a PDF, the
    // older one does not.
    const acknowledgments = canvas.getAllByRole('button', { name: 'Acknowledgment PDF' });
    await expect(acknowledgments).toHaveLength(2);
    await expect(acknowledgments[0]).toBeEnabled();
    await expect(acknowledgments[1]).toBeDisabled();
  },
};

export const ResultsReturned: Story = {
  name: 'Results returned, in and out of range',
  beforeEach: seed({
    ...BASE,
    census: [CONFIRMED_CENSUS],
    orders: [SUBMITTED_ORDER],
    results: [FINAL_RESULT],
  }),
  parameters: {
    docs: {
      description: {
        story:
          'A finalised result. The meter is the only place a value is drawn against its ' +
          'reference range, and it is pure geometry - nothing about it is announced - so this ' +
          'story measures it rather than looking at classes.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByTitle('Complete')).toBeInTheDocument();
    // A complete order swaps its ordering action for the result PDF: there is
    // nothing left to continue on the vendor side.
    await expect(canvas.getByRole('button', { name: 'Result PDF' })).toBeEnabled();
    await expect(
      canvas.getByText('ID: res-9001 | Status: Final | Order: IDX-100244')
    ).toBeInTheDocument();

    // In range, dead centre. The marker is offset by half its own width
    // (`calc(50% - 3px)`), so its CENTRE - not its left edge - is the value.
    // Drop that correction and every reading sits 3px low with nothing to show
    // for it.
    const inRange = meterOf(canvas.getByText('Glucose').closest('tr') as HTMLElement);
    await expect(
      Math.abs(
        inRange.marker.left +
          inRange.marker.width / 2 -
          inRange.track.left -
          inRange.track.width / 2
      )
    ).toBeLessThanOrEqual(1);

    // 14 against a 5-9 range is 225% along the track. Clamped, it pins to the
    // right-hand end; unclamped it would be drawn hundreds of pixels outside the
    // card, over whatever sits next to it.
    const outOfRange = meterOf(canvas.getByText('Creatinine').closest('tr') as HTMLElement);
    await expect(
      Math.abs(
        outOfRange.marker.left +
          outOfRange.marker.width / 2 -
          outOfRange.track.left -
          outOfRange.track.width
      )
    ).toBeLessThanOrEqual(1);

    // No parseable range means no meter, and saying so beats drawing a marker at
    // a position nothing supports.
    const noRange = canvas.getByText('Sample quality').closest('tr') as HTMLElement;
    await expect(within(noRange).getByText('N/A')).toBeInTheDocument();

    // The unspaced "5.4-8.2" is read as a single negative bound and rejected, so
    // this row loses its meter too. Current behaviour, pinned deliberately: if
    // the parser is fixed this assertion is the thing that says so.
    const unspacedRange = canvas.getByText('Total protein').closest('tr') as HTMLElement;
    await expect(within(unspacedRange).getByText('N/A')).toBeInTheDocument();
  },
};

export const ResultPdfPreview: Story = {
  name: 'Result PDF preview',
  beforeEach: seed({
    ...BASE,
    census: [CONFIRMED_CENSUS],
    orders: [SUBMITTED_ORDER],
    results: [SUPERSEDED_RESULT, FINAL_RESULT],
  }),
  parameters: {
    docs: {
      description: {
        story:
          'The overlay behind the order card "Result PDF". The order knows nothing about ' +
          'result ids, so the panel resolves the newest result for the order itself and frames ' +
          'the blob the service builds - never a vendor URL.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Result PDF' }));

    // The overlay is portalled onto document.body, outside canvasElement.
    const overlay = within(globalThis.document.body);

    // res-9001, not the older res-8999: two results can share an order when
    // IDEXX corrects one, and showing the superseded PDF is a clinical error the
    // UI gives no hint of.
    await expect(await overlay.findByText('IDEXX Result PDF #res-9001')).toBeInTheDocument();

    const frame = overlay.getByTitle('IDEXX Result PDF #res-9001') as HTMLIFrameElement;
    await expect(frame.getAttribute('src')).toMatch(/^blob:/);

    const close = overlay.getByRole('button', { name: 'Close IDEXX PDF preview' });
    await userEvent.click(close);
    // Closing revokes the object URL, so the overlay has to actually unmount -
    // a hidden-but-mounted frame would be pointed at a revoked blob.
    await waitFor(async () => {
      await expect(overlay.queryByText('IDEXX Result PDF #res-9001')).not.toBeInTheDocument();
    });
  },
};

export const OrderListFailed: Story = {
  name: 'The order list fails to load',
  beforeEach: seed({ ...BASE, failOrderSearch: true }),
  parameters: {
    docs: {
      description: {
        story:
          'The order search answers 404. The message carries the status and the backend text ' +
          'rather than a generic apology, and the rest of the panel stays usable.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('Unable to load appointment lab orders. (404): Not Found')
    ).toBeInTheDocument();

    // A failed listing must not take the ordering form down with it: a clinician
    // can still place the order they came here to place.
    await expect(canvas.getByRole('button', { name: 'Create lab order' })).toBeInTheDocument();
    await expect(
      canvas.getByText('No lab orders found for this appointment yet.')
    ).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* The width is pinned here as well as through the viewport global. The global
     is applied by the Storybook MANAGER, so a runner that loads `iframe.html`
     directly renders this at panel width - where a 620px table fits and the
     scroll assertion below is false for the wrong reason. The frame makes the
     story mean the same thing in both. */
  decorators: [
    (Story) => (
      <div className="w-[375px]">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed({
    ...BASE,
    census: [CONFIRMED_CENSUS],
    orders: [SUBMITTED_ORDER],
    results: [FINAL_RESULT],
  }),
  parameters: {
    docs: {
      description: {
        story:
          'The same returned result on a phone. The result table has a 620px floor, so the only ' +
          'thing keeping the page usable is its own overflow container.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = await canvas.findByRole('table');
    const scroller = table.parentElement as HTMLElement;

    // The table scrolls inside its own box...
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    // ...and the page does not scroll sideways behind it. Lose the container and
    // the second half of this passes silently while every phone gains a
    // horizontal scrollbar.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
