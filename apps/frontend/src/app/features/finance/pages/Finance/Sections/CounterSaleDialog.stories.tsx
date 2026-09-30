import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import CounterSaleDialog from './CounterSaleDialog';

const ORG_ID = 'org-counter-sale-story';
const ITEMS = [
  {
    _id: 'item-bandage',
    organisationId: ORG_ID,
    name: 'Bandage roll',
    sellingPrice: 8.5,
    currency: 'GBP',
    status: 'ACTIVE',
    onHand: 12,
    allocated: 2,
  },
];
const INVOICE = {
  id: 'invoice-counter-sale-story',
  organisationId: ORG_ID,
  appointmentId: null,
  items: [{ name: 'Bandage roll', quantity: 1, unitPrice: 8.5, total: 8.5 }],
  subtotal: 8.5,
  totalAmount: 8.5,
  currency: 'gbp',
  status: 'AWAITING_PAYMENT',
  paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
};
let createdRequest: string | undefined;
let finalizedRequest: string | undefined;

type Handler = (config: InternalAxiosRequestConfig) => { status?: number; body?: unknown };

const stubApi = (handler: Handler) => {
  const previous = api.defaults.adapter;
  api.defaults.adapter = async (config) => {
    const { status = 200, body = [] } = handler(config);
    if (status >= 400) {
      throw Object.assign(new Error(`Request failed with status ${status}`), {
        response: { status, data: body, config },
        config,
      });
    }
    return { data: body, status, statusText: 'OK', headers: {}, config } as AxiosResponse;
  };
  return () => {
    api.defaults.adapter = previous;
    clearInFlightGetRequests();
  };
};

const prepare = () => {
  clearInFlightGetRequests();
  createdRequest = undefined;
  finalizedRequest = undefined;
  return stubApi((config) => {
    const url = String(config.url ?? '');
    if (url.includes('/v1/inventory/organisation/')) return { body: ITEMS };
    if (url.endsWith(`/invoices/${INVOICE.id}`)) {
      return {
        body: {
          data: { invoice: { ...INVOICE, pdfUrl: 'https://files.test/invoice.pdf' } },
          meta: null,
          error: null,
        },
      };
    }
    if (url.endsWith('/finalize')) {
      finalizedRequest = String(config.url ?? '');
      return {
        body: {
          data: { ...INVOICE, pdfUrl: 'https://files.test/invoice.pdf' },
          meta: null,
          error: null,
        },
      };
    }
    if (url.endsWith('/counter-sales')) {
      createdRequest = String(config.data ?? '');
      return { status: 201, body: { data: INVOICE, meta: null, error: null } };
    }
    return { body: [] };
  });
};

const meta = {
  title: 'Finance/CounterSaleDialog',
  component: CounterSaleDialog,
  parameters: { layout: 'centered' },
  tags: ['autodocs', 'counter-sale-qa'],
  args: {
    open: true,
    setOpen: () => {},
    organisationId: ORG_ID,
    currency: 'GBP',
    onCreated: () => {},
  },
  beforeEach: prepare,
} satisfies Meta<typeof CounterSaleDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const openItemPicker = async () => {
  const picker = within(document.body).getByRole('button', { name: 'Item' });
  if ((await picker.getAttribute('aria-expanded')) !== 'true') {
    await userEvent.click(picker);
  }
};

export const ReadyToSell: Story = {
  play: async () => {
    const dialog = within(document.body);
    await expect(await dialog.findByRole('heading', { name: 'Counter sale' })).toBeInTheDocument();
    await openItemPicker();
    await expect(
      await within(document.body).findByRole('option', { name: /Bandage roll/ })
    ).toBeInTheDocument();
  },
};

export const CreateSale: Story = {
  play: async () => {
    const dialog = within(document.body);
    await openItemPicker();
    await userEvent.click(
      await within(document.body).findByRole('option', { name: /Bandage roll/ })
    );
    await userEvent.click(dialog.getByRole('button', { name: 'Create counter sale' }));
    await waitFor(() => expect(createdRequest).toBeDefined());
    await waitFor(() => expect(finalizedRequest).toContain('/finalize'));
    await expect(await dialog.findByRole('status')).toHaveTextContent('Receipt ready');
    expect(JSON.parse(createdRequest ?? '{}')).toEqual({
      organisationId: ORG_ID,
      items: [{ inventoryItemId: 'item-bandage', quantity: 1 }],
    });
  },
};

export const InventoryUnavailable: Story = {
  beforeEach: () =>
    stubApi((config) =>
      String(config.url ?? '').includes('/v1/inventory/organisation/')
        ? { status: 503, body: { message: 'Unavailable' } }
        : { body: [] }
    ),
  play: async () => {
    await expect(
      await within(document.body).findByText(/Inventory could not be loaded/)
    ).toBeInTheDocument();
  },
};
