import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { expect, userEvent, within } from 'storybook/test';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { PurchaseOrdersContent } from './index';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';

const ORGANISATION_ID = 'org-purchasing-story';
const ORDER = {
  id: 'order-story-1',
  vendorId: 'vendor-story-1',
  orderNumber: 'PO-2026-041',
  status: 'PARTIALLY_RECEIVED',
  orderDate: '2026-09-28T09:00:00.000Z',
  expectedDate: '2026-10-06T00:00:00.000Z',
  totalAmount: 90,
  currency: 'EUR',
  notes: 'Keep refrigerated on arrival.',
  lines: [
    {
      id: 'line-story-1',
      itemId: 'item-story-1',
      quantityOrdered: 10,
      quantityReceived: 4,
      quantityReturned: 0,
      unitCost: 9,
      totalCost: 90,
      packSize: 1,
    },
  ],
};
const VENDORS = [{ id: 'vendor-story-1', name: 'North Shore Veterinary Supply' }];
const ITEMS = [
  {
    _id: 'item-story-1',
    name: 'Amoxicillin 250 mg',
    unitCost: 9,
    organisationId: ORGANISATION_ID,
    businessType: 'HOSPITAL',
  },
];

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const adapter: AxiosAdapter = (config) => {
  const url = String(config.url ?? '');
  if (url.includes('/outstanding')) return Promise.resolve(respond(config, [ORDER.lines[0]]));
  if (url.endsWith('/vendors')) return Promise.resolve(respond(config, VENDORS));
  if (url.endsWith('/items')) return Promise.resolve(respond(config, ITEMS));
  if (url.includes('/purchase-orders/organisation/')) {
    return Promise.resolve(
      respond(config, { items: [ORDER], page: 1, pageSize: 25, total: 1, totalPages: 1 })
    );
  }
  return Promise.resolve(respond(config, {}));
};

const meta = {
  title: 'Inventory/PurchaseOrders',
  component: PurchaseOrdersContent,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/inventory/purchase-orders' } },
  },
  beforeEach: () => {
    const previousAuth = useAuthStore.getState();
    const previousOrg = useOrgStore.getState();
    const previousAdapter = api.defaults.adapter;
    clearInFlightGetRequests();
    api.defaults.adapter = adapter;
    useAuthStore.setState({ status: 'authenticated' });
    useOrgStore.setState({
      primaryOrgId: ORGANISATION_ID,
      status: 'loaded',
      membershipsByOrgId: { [ORGANISATION_ID]: { roleCode: 'OWNER', active: true } },
    });
    return () => {
      api.defaults.adapter = previousAdapter;
      useAuthStore.setState(previousAuth);
      useOrgStore.setState(previousOrg);
      clearInFlightGetRequests();
    };
  },
} satisfies Meta<typeof PurchaseOrdersContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenOrder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'Purchase orders' })).toBeVisible();
    await expect(await canvas.findByText('PO-2026-041')).toBeVisible();
    await expect(canvas.getByText('North Shore Veterinary Supply')).toBeVisible();
    await expect(canvas.getByText('6 units')).toBeVisible();
    await expect(canvas.queryByText('Keep refrigerated on arrival.')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Review' }));
    const page = within(document.body);
    await expect(await page.findByRole('heading', { name: 'Review PO-2026-041' })).toBeVisible();
    await expect(page.getByText('10 ordered · 4 received · 6 outstanding')).toBeVisible();
    await expect(
      page.getByText('Review the supplier, quantities, and total for this order.')
    ).toBeVisible();
    await expect(page.getByText('Keep refrigerated on arrival.')).toBeVisible();
  },
};
