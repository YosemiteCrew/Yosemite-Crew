import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import api from '@/app/services/axios';
import type { BatchValues } from '@/app/features/inventory/pages/Inventory/types';
import InventoryBatchCount from './InventoryBatchCount';

const BATCHES: BatchValues[] = [
  {
    _id: 'batch-lot-2231',
    batch: 'LOT-2231',
    barcode: '5012345678900',
    quantity: '12',
    allocated: '2',
    manufactureDate: '2026-01-10',
    expiryDate: '2999-06-30',
  },
  {
    _id: 'batch-lot-1988',
    batch: 'LOT-1988',
    quantity: '4',
    manufactureDate: '2019-02-01',
    expiryDate: '2020-02-01',
  },
];

/**
 * What the server answers is decided by the counted quantity in the request, not
 * by which story installed the adapter last: Autodocs mounts every story on one
 * page against the one shared axios instance, so a per-story answer would race.
 */
const COUNTED = { shortfall: 10, match: 12, refused: 99 };
const REFUSAL = 'Stock changed after this count was recorded. Record a new count.';

const REAL_ADAPTER = api.defaults.adapter;

const readBody = (config: InternalAxiosRequestConfig): { physicalCount?: number } => {
  if (typeof config.data !== 'string') return config.data ?? {};
  return JSON.parse(config.data) as { physicalCount?: number };
};

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const countAdapter: AxiosAdapter = async (config) => {
  const url = String(config.url ?? '');
  if (url.endsWith('/reconcile')) {
    return respond(config, { id: 'count-1', reconciled: true });
  }
  if (!url.includes('/inventory-counts')) {
    throw new Error(`Unstubbed request in InventoryBatchCount.stories: ${url}`);
  }
  const physicalCount = readBody(config).physicalCount ?? 0;
  if (physicalCount === COUNTED.refused) {
    const response: AxiosResponse = {
      data: { error: REFUSAL },
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config,
    };
    throw new AxiosError(
      'Request failed with status code 409',
      'ERR_BAD_REQUEST',
      config,
      {},
      response
    );
  }
  return respond(config, {
    id: 'count-1',
    inventoryBatchId: 'batch-lot-2231',
    systemCount: 12,
    physicalCount,
    discrepancy: physicalCount - 12,
    reconciled: physicalCount === 12,
  });
};

/** Restores the real adapter, never "whatever was there before". */
const stubCountEndpoints = () => {
  api.defaults.adapter = countAdapter;
  return () => {
    api.defaults.adapter = REAL_ADAPTER;
  };
};

const meta = {
  title: 'Inventory/InventoryBatchCount',
  component: InventoryBatchCount,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    organisationId: 'org-batch-count-story',
    itemId: 'item-amoxicillin',
    itemName: 'Amoxicillin 250 mg',
    batches: BATCHES,
    onRefresh: fn(),
  },
  beforeEach: stubCountEndpoints,
} satisfies Meta<typeof InventoryBatchCount>;

export default meta;
type Story = StoryObj<typeof meta>;

const startCount = async (canvasElement: HTMLElement, counted: number) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Start count' }));
  await userEvent.type(canvas.getByPlaceholderText('Scan or enter a batch'), '5012345678900');
  await expect(canvas.getByRole('combobox', { name: 'Batch' })).toHaveValue('batch-lot-2231');
  await userEvent.type(canvas.getByPlaceholderText('Enter the physical count'), String(counted));
  await userEvent.click(canvas.getByRole('button', { name: 'Record count' }));
  return canvas;
};

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Batch stock count' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Start count' })).toBeEnabled();
    await expect(canvas.queryByRole('combobox', { name: 'Batch' })).not.toBeInTheDocument();
  },
};

export const ExpiredBatchesLeftOut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Start count' }));
    const batch = canvas.getByRole('combobox', { name: 'Batch' });
    await expect(within(batch).getByRole('option', { name: 'LOT-2231' })).toBeInTheDocument();
    await expect(within(batch).queryByRole('option', { name: 'LOT-1988' })).toBeNull();
  },
};

export const ShortfallAdjusted: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = await startCount(canvasElement, COUNTED.shortfall);
    await expect(await canvas.findByText('Difference: -2')).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: 'Amoxicillin 250 mg: 12 in stock, 10 counted' })
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Adjust stock to count' }));
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'Stock updated to the counted quantity.'
    );
    await waitFor(() => expect(args.onRefresh).toHaveBeenCalledTimes(1));
  },
};

export const ShortfallNeedsReason: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await startCount(canvasElement, COUNTED.shortfall);
    await userEvent.click(await canvas.findByRole('button', { name: 'Leave stock unchanged' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Add a reason before leaving stock unchanged.'
    );
    await expect(canvas.getByText('Difference: -2')).toBeVisible();
  },
};

export const MatchingCount: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = await startCount(canvasElement, COUNTED.match);
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'Count recorded. Stock already matches.'
    );
    await waitFor(() => expect(args.onRefresh).toHaveBeenCalledTimes(1));
  },
};

export const RefusedCount: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await startCount(canvasElement, COUNTED.refused);
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent(REFUSAL);
    await expect(alert).not.toHaveTextContent('status code');
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const start = within(canvasElement).getByRole('button', { name: 'Start count' });
    await expect(start).toBeDisabled();
  },
};
