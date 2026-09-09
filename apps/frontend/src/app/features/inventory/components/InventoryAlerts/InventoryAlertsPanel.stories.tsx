import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type {
  ExpiringAlertBatch,
  LowStockAlertItem,
} from '@/app/features/inventory/services/inventoryAlertsService';
import InventoryAlertsPanel from './InventoryAlertsPanel';

const ORG_ID = 'org-storybook-inventory';
const DAY_MS = 86_400_000;

/** Offsets from "now" rather than fixed dates, so the relative-day labels
 *  ("in 3 days", "2 days ago") stay correct no matter when this renders. */
const isoDaysFromNow = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString();

const LOW_STOCK_ITEMS: LowStockAlertItem[] = [
  {
    id: 'item-flea-guard',
    name: 'FleaGuard Chewables 20mg',
    onHand: 0,
    reorderLevel: 15,
    unitOfMeasure: 'tablets',
    category: 'Parasiticides',
    sku: 'FG-20-CHEW',
  },
  {
    id: 'item-amoxicillin',
    name: 'Amoxicillin 250mg',
    onHand: 8,
    reorderLevel: 20,
    unitOfMeasure: 'capsules',
    category: 'Antibiotics',
    sku: 'AMX-250',
  },
  {
    id: 'item-iv-fluid',
    name: 'Lactated Ringer IV Fluid 1L',
    onHand: 3,
    reorderLevel: 10,
    unitOfMeasure: 'bags',
    category: 'Fluids',
    sku: 'LRS-1L',
  },
  {
    id: 'item-suture',
    name: 'Absorbable Suture 3-0',
    onHand: 12,
    reorderLevel: 25,
    category: 'Surgical',
    sku: 'SUT-30',
  },
];

const EXPIRING_BATCHES: ExpiringAlertBatch[] = [
  {
    id: 'batch-rabies',
    itemId: 'item-rabies-vaccine',
    batchNumber: 'RB-2024-118',
    expiryDate: isoDaysFromNow(-2),
    quantity: 6,
    inventoryItem: { name: 'Rabies Vaccine 1mL' },
  },
  {
    id: 'batch-heartworm',
    itemId: 'item-heartworm',
    batchNumber: 'HW-0592',
    expiryDate: isoDaysFromNow(3),
    quantity: 40,
    inventoryItem: { name: 'Heartworm Preventative Chews' },
  },
  {
    // The current handler doesn't include the item relation on every batch,
    // and expiryDate itself can be unset - both fall back gracefully.
    id: 'batch-suture-lot',
    itemId: 'item-suture',
    batchNumber: 'SUT-3092',
    expiryDate: null,
    quantity: 15,
    inventoryItem: null,
  },
];

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

type AlertsFixture =
  | { kind: 'resolves'; lowStock: LowStockAlertItem[]; expiring: ExpiringAlertBatch[] }
  /** Held open on purpose: the only way to hold the loading skeleton still. */
  | { kind: 'pending' }
  | { kind: 'rejects' };

/**
 * The panel fetches through `fetchLowStockAlerts` / `fetchExpiringAlerts`, both of
 * which route through the shared axios instance, so the adapter is the seam. Both
 * calls resolve, hang, or reject together per fixture - the panel doesn't
 * distinguish which endpoint failed, it always shows one generic error.
 */
const buildAdapter =
  (fixture: AlertsFixture): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');

    if (fixture.kind === 'pending') return new Promise<never>(() => {});
    if (fixture.kind === 'rejects') {
      return Promise.reject(
        Object.assign(new Error('Request failed with status code 500'), {
          isAxiosError: true,
          config,
          response: {
            status: 500,
            statusText: 'Internal Server Error',
            data: { message: 'Inventory alerts are temporarily unavailable.' },
            headers: {},
            config,
          },
        })
      );
    }

    if (url.includes('/alerts/low-stock'))
      return Promise.resolve(respond(config, fixture.lowStock));
    if (url.includes('/alerts/expiring')) return Promise.resolve(respond(config, fixture.expiring));
    return Promise.resolve(respond(config, []));
  };

const REAL_ADAPTER = api.defaults.adapter;

const prepare = (fixture: AlertsFixture) => () => {
  clearInFlightGetRequests();
  api.defaults.adapter = buildAdapter(fixture);

  return () => {
    api.defaults.adapter = REAL_ADAPTER;
    clearInFlightGetRequests();
  };
};

/**
 * A refused fetch is logged by the axios wrapper on its way to the panel's catch,
 * and the render check treats a console error as a broken story. Only that
 * line is dropped; anything else still reaches the console.
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

const meta = {
  title: 'Inventory/InventoryAlertsPanel',
  component: InventoryAlertsPanel,
  parameters: {
    docs: {
      description: {
        component:
          'Data container for `InventoryAlerts`: it loads low-stock and expiring-batch alerts ' +
          'for an organisation in parallel and hands the presentational component the arrays ' +
          'plus loading/error - fetching lives here, rendering lives in `InventoryAlerts`.\n\n' +
          'A missing `organisationId` is treated as "nothing to show" rather than an error - ' +
          'both lists are cleared and the fetch is skipped entirely, which is how the panel ' +
          'behaves before an org is selected. A failed fetch (either call) replaces both lists ' +
          'with one generic error banner rather than surfacing which endpoint failed. The ' +
          'effect re-runs whenever `organisationId` or `expiringWindowDays` changes, and guards ' +
          'against setting state after the org switches or the panel unmounts mid-flight.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    organisationId: ORG_ID,
    expiringWindowDays: 30,
    onViewLowStock: fn(),
    onViewExpiring: fn(),
  },
  argTypes: {
    organisationId: { control: 'text' },
    expiringWindowDays: { control: 'number' },
  },
  beforeEach: prepare({ kind: 'resolves', lowStock: LOW_STOCK_ITEMS, expiring: EXPIRING_BATCHES }),
} satisfies Meta<typeof InventoryAlertsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Low stock and expiring items',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('FleaGuard Chewables 20mg')).toBeVisible();
    await expect(canvas.getByText('Out of stock')).toBeVisible();
    await expect(canvas.getByText('Rabies Vaccine 1mL')).toBeVisible();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();

    // Four low-stock items, three expiring batches - the counts stay distinct
    // on the "View all" buttons even though only the first three rows render.
    await expect(canvas.getByRole('button', { name: 'View all 4 in catalog' })).toBeEnabled();
    await userEvent.click(canvas.getByRole('button', { name: 'View all 3 in catalog' }));
    await expect(args.onViewExpiring).toHaveBeenCalledTimes(1);
  },
};

export const Empty: Story = {
  name: 'No alerts',
  beforeEach: prepare({ kind: 'resolves', lowStock: [], expiring: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No low-stock items')).toBeVisible();
    await expect(canvas.getByText('Nothing expiring in the next 30 days')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /View all/ })).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  name: 'Loading alerts',
  beforeEach: prepare({ kind: 'pending' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Low stock')).toBeVisible();
    await expect(canvas.getByText('Expiring soon')).toBeVisible();
    // The skeleton rows are the loading tell: both lists render one, hidden from
    // the accessibility tree, in place of real rows or the empty-state copy.
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('ul[aria-hidden="true"]').length).toBe(2)
    );
    await expect(canvas.queryByText('No low-stock items')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /View all/ })).not.toBeInTheDocument();
  },
};

export const FetchFailed: Story = {
  name: 'Fetch failed',
  beforeEach: [prepare({ kind: 'rejects' }), muteExpectedFailureLogs],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Unable to load inventory alerts right now.');
    // Both lists clear rather than showing stale or partial data.
    await expect(canvas.getByText('No low-stock items')).toBeVisible();
    await expect(canvas.getByText('Nothing expiring in the next 30 days')).toBeVisible();
  },
};

export const NoOrganisation: Story = {
  name: 'No organisation selected',
  args: { organisationId: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Skips the fetch entirely rather than requesting alerts for no organisation.
    await expect(canvas.getByText('No low-stock items')).toBeVisible();
    await expect(canvas.getByText('Nothing expiring in the next 30 days')).toBeVisible();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
};
