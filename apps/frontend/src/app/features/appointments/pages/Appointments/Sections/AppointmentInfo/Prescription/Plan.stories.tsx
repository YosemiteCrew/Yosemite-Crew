import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import axios, { type AxiosResponse } from 'axios';
import type { Appointment, Invoice, InvoiceItem, UserOrganization } from '@yosemite-crew/types';

import { createEmptyFormData } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import type { FormDataProps } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import type { FormsProps } from '@/app/features/forms/types/forms';
import { buildInitialValues } from '@/app/features/forms/pages/Forms/Sections/AddForm/reviewUtils';
import api from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';

import Plan from './Plan';

const ORG_ID = 'org-storybook';
const APPOINTMENT_ID = 'appt-plan-1';
const INVOICE_ID = 'inv-plan-1';

const PLAIN_FORM_ID = 'form-plan-recheck';
const MEDS_FORM_ID = 'form-plan-discharge-meds';
const PARTIAL_FORM_ID = 'form-plan-postop-meds';

/**
 * `usePermissions` derives the effective set from `roleCode`, so seeding the
 * role is the whole fixture. Without it PrescriptionFormSection renders the
 * permission notice and nothing below can be reached.
 */
const VETERINARIAN: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const medicationRow = (index: number, name: string | undefined, price: string) => [
  {
    id: `medications_med_${index}_name`,
    type: 'input' as const,
    label: `Medication ${index}`,
    ...(name === undefined ? {} : { defaultValue: name }),
  },
  {
    id: `medications_med_${index}_price`,
    type: 'input' as const,
    label: `Medication ${index} price`,
    defaultValue: price,
  },
];

const planForm = (id: string, name: string, schema: FormsProps['schema']): FormsProps => ({
  _id: id,
  orgId: ORG_ID,
  name,
  category: 'Prescription',
  usage: 'Internal',
  requiredSigner: 'VET',
  updatedBy: 'Dr. Weber',
  lastUpdated: '2026-03-01T09:00:00.000Z',
  status: 'Published',
  schema,
});

/** A plan with no medication block at all - the common recheck case. */
const PLAIN_FORM = planForm(PLAIN_FORM_ID, 'Recheck plan', [
  {
    id: 'plan_summary',
    type: 'textarea',
    label: 'Plan summary',
    defaultValue: 'Recheck in 10 days.',
  },
]);

/** Three dispensed medications, all named. */
const MEDS_FORM = planForm(MEDS_FORM_ID, 'Discharge medications', [
  {
    id: 'plan_summary',
    type: 'textarea',
    label: 'Plan summary',
    defaultValue: 'Dispense and discharge.',
  },
  {
    id: 'medications',
    type: 'group',
    label: 'Medications',
    fields: [
      ...medicationRow(1, 'Amoxicillin 250 mg', '18.5'),
      ...medicationRow(2, 'Meloxicam oral suspension', '24'),
      ...medicationRow(3, 'Ocular lubricant gel', '9.75'),
    ],
  },
]);

/**
 * Three medication rows with the middle one left empty - what a vet who filled
 * rows 1 and 3 of a fixed three-row block actually submits. The blank row still
 * arrives as a `medications_med_2_name` key, so the index IS discovered and it
 * is the empty-name guard, not the regex, that has to drop it.
 */
const PARTIAL_FORM = planForm(PARTIAL_FORM_ID, 'Post-op medications', [
  {
    id: 'medications',
    type: 'group',
    label: 'Medications',
    fields: [
      ...medicationRow(1, 'Buprenorphine 0.3 mg', '31.4'),
      ...medicationRow(2, undefined, '12'),
      ...medicationRow(3, 'Cone collar', '7'),
    ],
  },
]);

const FORMS_BY_ID: Record<string, FormsProps> = {
  [PLAIN_FORM_ID]: PLAIN_FORM,
  [MEDS_FORM_ID]: MEDS_FORM,
  [PARTIAL_FORM_ID]: PARTIAL_FORM,
};

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: {
    id: 'companion-1',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  companion: {
    id: 'companion-1',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date(2026, 2, 12, 9, 30),
  startTime: new Date(2026, 2, 12, 9, 30),
  endTime: new Date(2026, 2, 12, 10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

const openInvoice = (items: InvoiceItem[] = []): Invoice => ({
  id: INVOICE_ID,
  organisationId: ORG_ID,
  appointmentId: APPOINTMENT_ID,
  items,
  subtotal: 0,
  totalAmount: 0,
  paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
  currency: 'EUR',
  status: 'PENDING',
  createdAt: new Date(2026, 2, 12, 9, 0),
  updatedAt: new Date(2026, 2, 12, 9, 0),
});

type Recorded = { method: string; url: string; body: Record<string, unknown> };

/** Every request the tree makes during a story, in the order it made them. */
const requests: Recorded[] = [];

const financeTraffic = () =>
  requests
    .filter((request) => /\/submit$|\/v1\/finance\//.test(request.url))
    .map((request) => `${request.method} ${request.url}`);

const lineItemsPosted = (): Array<Record<string, unknown>> => {
  const call = requests.find((request) => request.url.endsWith('/lines'));
  return (call?.body.items as Array<Record<string, unknown>>) ?? [];
};

/**
 * Saving a plan is the only SOAP section with a side effect, and that side
 * effect is three real service calls deep - `createSubmission`, then
 * `addLineItemsToAppointments` (which seeds or finds the invoice before it can
 * post a line), then a refresh of the org's invoices. None of that can be
 * mocked at the module boundary here, so the stub goes in at the transport: the
 * axios instance keeps its interceptors, the services and stores stay real, and
 * every request is recorded instead of sent.
 *
 * The submit reply is derived from the picked form's own schema defaults rather
 * than hardcoded, so the answers Plan parses are exactly the answers the
 * rendered form would have submitted. That matters, because Plan reads
 * `rawCreated` - the SERVER's echo - not the values held in the component.
 */
const REAL_ADAPTER = axios.getAdapter(api.defaults.adapter);

const SUBMIT_URL = /\/form\/admin\/([^/]+)\/submit$/;

const seed = (options: { invoiceItems?: InvoiceItem[] } = {}) => {
  const snapshots = {
    org: useOrgStore.getState(),
    forms: useFormsStore.getState(),
    auth: useAuthStore.getState(),
    invoices: useInvoiceStore.getState(),
    subscription: useSubscriptionStore.getState(),
  };
  const originalAdapter = api.defaults.adapter;
  requests.length = 0;

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: VETERINARIAN },
    status: 'loaded',
  });
  useFormsStore.setState({
    formsById: FORMS_BY_ID,
    formIds: [PLAIN_FORM_ID, MEDS_FORM_ID, PARTIAL_FORM_ID],
  });
  // `handleSave` bails out before the network when `attributes` is null, so the
  // whole side effect is unreachable without a signed-in user.
  useAuthStore.setState({ attributes: { sub: 'user-storybook' } });
  /* An OPEN invoice already in the store short-circuits `seedAppointmentInvoice`,
     so the story exercises the line-posting path rather than invoice creation. */
  useInvoiceStore.setState({
    invoicesById: { [INVOICE_ID]: openInvoice(options.invoiceItems) },
    invoiceIdsByOrgId: { [ORG_ID]: [INVOICE_ID] },
    status: 'loaded',
  });
  // The currency travels from the org's billing subscription into the posted
  // line, so a non-USD org is the honest default to test with.
  useSubscriptionStore.setState({
    subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency: 'EUR' } },
  });

  api.defaults.adapter = (async (config) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toUpperCase();
    let body: Record<string, unknown> = {};
    if (typeof config.data === 'string' && config.data) {
      body = JSON.parse(config.data) as Record<string, unknown>;
    }

    const submitted = SUBMIT_URL.exec(url);
    if (submitted) {
      requests.push({ method, url, body });
      const form = FORMS_BY_ID[submitted[1]];
      return {
        data: {
          _id: 'submission-1',
          formId: submitted[1],
          formVersion: 1,
          appointmentId: APPOINTMENT_ID,
          companionId: 'companion-1',
          parentId: 'parent-1',
          submittedBy: 'user-storybook',
          submittedAt: new Date(2026, 2, 12, 9, 55).toISOString(),
          answers: buildInitialValues(form?.schema ?? []),
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    }

    if (url.includes('/v1/finance/')) {
      requests.push({ method, url, body });
      return {
        data: url.endsWith('/lines') ? { id: INVOICE_ID } : [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    }

    return REAL_ADAPTER(config);
  }) as typeof api.defaults.adapter;

  return () => {
    api.defaults.adapter = originalAdapter;
    useSubscriptionStore.setState(snapshots.subscription);
    useInvoiceStore.setState(snapshots.invoices);
    useAuthStore.setState(snapshots.auth);
    useFormsStore.setState(snapshots.forms);
    useOrgStore.setState(snapshots.org);
  };
};

const submitPlan = async (canvas: ReturnType<typeof within>, formName: string) => {
  await userEvent.click(canvas.getByRole('textbox', { name: 'Search plan' }));
  await userEvent.click(await canvas.findByRole('button', { name: formName }));
  await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));
};

/** The functional update `handleSave` hands to the parent, applied to a clean bag. */
const nextFormData = (setFormData: unknown): FormDataProps => {
  const spy = setFormData as { mock: { calls: Array<[(prev: FormDataProps) => FormDataProps]> } };
  const call = spy.mock.calls.at(-1);
  if (!call) throw new Error('setFormData was never called, so there is no plan state to read');
  return call[0](createEmptyFormData());
};

const meta = {
  title: 'Appointments/Plan',
  component: Plan,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Treatment/Plan is the one SOAP section that does something when it is saved. Its four ' +
          'siblings (Subjective, Objective, Assessment, Discharge) are thin wrappers that hand ' +
          '`PrescriptionFormSection` a title and a form category; Plan also passes an ' +
          '`onAfterCreate`, and that hook **turns the plan into money**.\n\n' +
          'After the submission is created it scans the answers for ' +
          '`medications_med_<n>_name` keys, pairs each with its `_price` sibling, builds one ' +
          'quantity-1 line per named medication and posts them to the appointment invoice, then ' +
          "refreshes the org's invoices. So a vet who saves a plan has also billed the client, " +
          'from a screen that never says so.\n\n' +
          'Three details decide what gets billed and none of them is visible on the surface. ' +
          'The rows are read from the SERVER echo, not from the values held on screen. A row ' +
          'whose name is blank is skipped, so a half-filled medication block does not post an ' +
          'unnamed charge. And a line already on the invoice is not posted twice, which is what ' +
          'stops a re-saved plan from double-billing.\n\n' +
          'The stories below drive the real save through a recording transport and assert what ' +
          'actually left the page. The surface itself - picker, read-only preview, CTA - belongs ' +
          'to Appointments/PrescriptionFormSection.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    formData: createEmptyFormData(),
    setFormData: fn(),
    activeAppointment: APPOINTMENT,
    canEdit: true,
  },
  beforeEach: () => seed(),
} satisfies Meta<typeof Plan>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoMedicationRows: Story = {
  name: 'A plan with no medications',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await submitPlan(canvas, 'Recheck plan');

    // The submission lands, and the plan is handed back to the parent.
    await waitFor(() => expect(args.setFormData).toHaveBeenCalled());
    const next = nextFormData(args.setFormData);
    await expect(next.plan).toHaveLength(1);

    /* And nothing else happens. A recheck plan must not open an invoice, touch
       a line or refresh finance - one request in, one request total. This is
       the assertion that catches a regression where `buildMedicationLineItems`
       starts matching something it should not. */
    await expect(financeTraffic()).toEqual([`POST /fhir/v1/form/admin/${PLAIN_FORM_ID}/submit`]);
    await expect(next.lineItems).toHaveLength(0);
  },
};

export const MedicationsBecomeInvoiceLines: Story = {
  name: 'Medications are billed on save',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The medication block is drawn before it is submitted, read-only.
    await userEvent.click(canvas.getByRole('textbox', { name: 'Search plan' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Discharge medications' }));
    await expect(await canvas.findByText('Medications')).toBeInTheDocument();

    await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));

    /* Three calls in a fixed order: create the submission, put the lines on the
       appointment's open invoice, then re-read the org's invoices so the
       finance tab is not stale. The order is the contract - posting lines
       before the submission exists would bill a plan that was never saved. */
    await waitFor(() =>
      expect(financeTraffic()).toEqual([
        `POST /fhir/v1/form/admin/${MEDS_FORM_ID}/submit`,
        `POST /v1/finance/invoices/${INVOICE_ID}/lines`,
        'GET /v1/finance/invoices',
      ])
    );

    const items = lineItemsPosted();
    await expect(items.map((item) => item.name)).toEqual([
      'Amoxicillin 250 mg',
      'Meloxicam oral suspension',
      'Ocular lubricant gel',
    ]);
    /* Prices arrive as strings from the form and have to reach the invoice as
       numbers - a string unitPrice sums as concatenation further down finance. */
    await expect(items.map((item) => item.unitPrice)).toEqual([18.5, 24, 9.75]);
    await expect(items.map((item) => item.quantity)).toEqual([1, 1, 1]);
    await expect(items.map((item) => item.total)).toEqual([18.5, 24, 9.75]);
    /* No description is captured for a medication, so the name is reused rather
       than posting an empty line description. */
    await expect(items.map((item) => item.description)).toEqual(items.map((item) => item.name));

    const lines = requests.find((request) => request.url.endsWith('/lines'));
    /* Lower-cased, and taken from the org's billing subscription rather than a
       default: an org billing in euros must not have its plan billed in USD. */
    await expect(lines?.body.currency).toBe('eur');

    /* The same three lines are merged into the local bill so the Finance tab
       shows them without waiting for the refresh to land. Waited for
       separately: the requests above are recorded when they are SENT, and the
       parent is only updated once the whole chain has resolved. */
    await waitFor(() => expect(args.setFormData).toHaveBeenCalled());
    const next = nextFormData(args.setFormData);
    await expect(next.lineItems.map((item) => item.name)).toEqual([
      'Amoxicillin 250 mg',
      'Meloxicam oral suspension',
      'Ocular lubricant gel',
    ]);
  },
};

export const BlankMedicationRowSkipped: Story = {
  name: 'A blank medication row is not billed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitPlan(canvas, 'Post-op medications');

    await waitFor(() => expect(lineItemsPosted()).toHaveLength(2));

    /* Row 2 was submitted - `medications_med_2_name` is in the answers with an
       empty value, and it carries a price of 12 - so the index IS found. Only
       the empty-name guard stops it. Without that guard the client is billed
       12 for a line with no name on it. */
    await expect(lineItemsPosted().map((item) => item.name)).toEqual([
      'Buprenorphine 0.3 mg',
      'Cone collar',
    ]);
    // Rows keep their numeric order, not the order the answer keys happen to
    // enumerate in: 1 then 3, never 3 then 1.
    await expect(lineItemsPosted().map((item) => item.unitPrice)).toEqual([31.4, 7]);
  },
};

export const AlreadyBilledMedication: Story = {
  name: 'Re-saving does not bill a medication twice',
  beforeEach: () =>
    seed({
      invoiceItems: [
        {
          id: 'line-existing',
          name: 'Amoxicillin 250 mg',
          quantity: 1,
          unitPrice: 18.5,
          total: 18.5,
        },
      ],
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitPlan(canvas, 'Discharge medications');

    await waitFor(() => expect(lineItemsPosted()).toHaveLength(2));

    /* The invoice already carries the amoxicillin line, matched on
       name + quantity + unit price rather than on an id the form never had. A
       vet correcting and re-saving a plan is routine; billing the same drug
       again for it is not. */
    await expect(lineItemsPosted().map((item) => item.name)).toEqual([
      'Meloxicam oral suspension',
      'Ocular lubricant gel',
    ]);
  },
};

export const ReadOnly: Story = {
  name: 'Locked appointment (canEdit false)',
  args: { canEdit: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* No picker and no CTA: the section cannot be submitted at all, so the
       billing side effect has no entry point on a closed appointment. */
    await expect(canvas.queryByRole('textbox', { name: 'Search plan' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(
      canvas.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Treatment/Plan', 'Previous plan submissions']);

    await expect(financeTraffic()).toEqual([]);
    await expect(args.setFormData).not.toHaveBeenCalled();
  },
};
