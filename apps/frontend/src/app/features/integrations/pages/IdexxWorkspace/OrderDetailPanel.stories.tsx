import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { LabResult } from '@/app/features/integrations/services/types';
import Modal from '@/app/ui/overlays/Modal';
import { OrderDetailPanel } from './index';

/** Mirrors the id `OrderDetailPanel` puts on its own `ModalHeader` title. */
const ORDER_DETAIL_TITLE_ID = 'idexx-order-detail-title';

const RESULT: LabResult = {
  _id: 'lab-result-1',
  provider: 'IDEXX',
  resultId: 'RES-88213',
  orderId: 'ORD-40917',
  requisitionId: 'REQ-7781',
  clientId: 'client-22',
  clientFirstName: 'Maya',
  clientLastName: 'Whitfield',
  patientId: 'PET-5512',
  patientName: 'Poppy',
  modality: 'REFLAB',
  status: 'COMPLETE',
  statusDetail: 'All runs reported',
  accessionId: 'ACC-2026-0412',
  createdAt: '2026-03-12T08:05:00.000Z',
  updatedAt: '2026-03-12T11:42:00.000Z',
  rawPayload: {
    categories: [
      {
        categoryId: 1,
        name: 'Complete blood count',
        tests: [
          { name: 'Haematocrit', result: '41', units: '%', referenceRange: '37-55' },
          {
            name: 'White blood cells',
            result: '19.4',
            units: 'K/uL',
            referenceRange: '5.0-16.0',
            outOfRange: true,
          },
          { name: 'Platelets', result: '288', units: 'K/uL', referenceRange: '175-500' },
        ],
      },
      {
        categoryId: 2,
        name: 'Chemistry',
        tests: [
          { name: 'Creatinine', result: '1.1', units: 'mg/dL', referenceRange: '0.5-1.8' },
          { name: 'ALT', result: '142', units: 'U/L', referenceRange: '10-125', outOfRange: true },
          { name: 'Glucose', result: 'Pending', units: '', referenceRange: '' },
        ],
      },
    ],
    runSummaries: [
      { id: 'run-1', code: 'CBC', name: 'Complete blood count' },
      { id: 'run-2', code: 'CHEM17', name: 'Chemistry 17 panel' },
    ],
  },
};

const APPOINTMENT_LABS_HREF = '/appointments/appt-9912?step=DIAGNOSTICS';

/**
 * The panel ships as the body of a right-side drawer opened from a results row.
 * The harness reproduces that exactly - same `Modal` variant, size and
 * `aria-labelledby` as the workspace - so a story can open the real gate rather
 * than approximating it.
 */
const DrawerHarness = (props: ComponentProps<typeof OrderDetailPanel>) => {
  const [showModal, setShowModal] = useState(false);
  return (
    <div className="p-2">
      <button
        type="button"
        className="rounded-full border border-card-border px-4 py-2 text-body-4 text-text-primary"
        onClick={() => setShowModal(true)}
      >
        View result RES-88213
      </button>
      <Modal
        showModal={showModal}
        setShowModal={setShowModal}
        size="md"
        aria-labelledby={ORDER_DETAIL_TITLE_ID}
      >
        <OrderDetailPanel {...props} onClose={() => setShowModal(false)} />
      </Modal>
    </div>
  );
};

/** The panel fills a 470px `md` drawer, so review it at that width. */
const DrawerFrame = (Story: React.ComponentType) => (
  <div className="w-full max-w-[470px] p-3">
    <Story />
  </div>
);

const meta = {
  title: 'Integrations/OrderDetailPanel',
  component: OrderDetailPanel,
  decorators: [DrawerFrame],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The IDEXX order/result detail drawer body. In the workspace it renders only inside a ' +
          '`Modal` gated on `showResultModal`, which itself only opens after a results row is ' +
          'clicked *and* a network fetch resolves - so this entire tree, several hundred lines of ' +
          'tables and meters, had never been drawn by anything.\n\n' +
          'The specific things now visible:\n\n' +
          '- The **meter column**. Each row draws a `h-2 w-48` rail with a `w-1.5 h-4` marker ' +
          'positioned by `left: calc(<percent>% - 3px)`. The percent is clamped to 0-100 but the ' +
          'raw value is not, so an out-of-range result pins the marker to an edge and recolours it ' +
          'to `bg-[var(--danger)]`. A test whose reference range cannot be parsed drops the rail ' +
          'entirely for a plain "N/A" - three visually different cells from one column.\n' +
          '- The **horizontally scrolling tables**. Each category table is `min-w-[620px]` inside ' +
          'an `overflow-x-auto`, which in a 470px `md` drawer means it always scrolls. That ' +
          'interaction between a fixed-width table and the drawer width is invisible from the ' +
          'component in isolation, which is why one story opens the real drawer.\n' +
          '- The three **body branches**, which share no markup: a one-line loading string, a ' +
          '"No result selected." string, and the full tree. The header still renders in all ' +
          "three, falling back through `accessionId ?? resultId ?? 'Order'` for its title.\n" +
          '- The **run summaries** block, rendered only when `rawPayload.runSummaries` is ' +
          'non-empty, and the appointment-link icon, rendered only when `appointmentLabsHref` is ' +
          'non-empty - which is also what flips the footer primary between a real `next/link` and ' +
          'a disabled button.\n\n' +
          'The stories assert the body actually carries its category tables and rows, not merely ' +
          'that the drawer opened.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeResultDetail: RESULT,
    resultDetailLoading: false,
    terminologyText: (text: string) => text,
    appointmentLabsHref: APPOINTMENT_LABS_HREF,
    pdfPreviewLoadingId: null,
    openResultPdfPreview: fn(() => Promise.resolve()),
    onClose: fn(),
  },
} satisfies Meta<typeof OrderDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  name: 'Result loaded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'ACC-2026-0412' })).toBeInTheDocument();
    // Assert the body has its real content, not just that the panel mounted.
    await expect(canvas.getByText('Complete blood count')).toBeInTheDocument();
    await expect(canvas.getByText('Chemistry')).toBeInTheDocument();
    await expect(canvas.getByText('White blood cells')).toBeInTheDocument();
    await expect(canvas.getByText('Run summaries')).toBeInTheDocument();
    await expect(
      canvas.getByRole('link', { name: 'Open appointment labs for result RES-88213' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'Two categories, six rows, two of them out of range. The out-of-range value text turns ' +
        '`text-text-error` while its meter marker turns `--danger` - two independent colour ' +
        'decisions that must agree, and only agree visibly.',
    },
  },
};

export const OpenedFromResultsRow: Story = {
  name: 'Opened in its drawer',
  render: (args) => <DrawerHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'View result RES-88213' }));
    // The drawer portals to document.body, outside canvasElement.
    const dialog = await within(document.body).findByRole('dialog');
    const panel = within(dialog);
    await expect(panel.getByRole('heading', { name: 'ACC-2026-0412' })).toBeInTheDocument();
    await expect(panel.getByText('Complete blood count')).toBeInTheDocument();
    await expect(panel.getByText('Creatinine')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Open results PDF' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The gate itself, opened the way a user opens it: the real 470px `md` drawer, labelled by ' +
        "the panel's own header id. This is the only story where the `min-w-[620px]` category " +
        'tables meet the width they actually ship at.',
    },
  },
};

export const LoadingDetail: Story = {
  name: 'Detail loading',
  args: { resultDetailLoading: true, activeResultDetail: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading result details…')).toBeInTheDocument();
    // With no result the header falls all the way back to its literal.
    await expect(canvas.getByRole('heading', { name: 'Order' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The drawer opens before the fetch resolves, so this is the first frame every user sees. ' +
        'The header and footer are already laid out while the body is a single line of text - the ' +
        'footer therefore sits high, not pinned to the drawer bottom.',
    },
  },
};

export const NoResultSelected: Story = {
  name: 'No result selected',
  args: { activeResultDetail: null, appointmentLabsHref: '' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No result selected.')).toBeInTheDocument();
    // Without an href the primary is a disabled button rather than a link.
    await expect(
      canvas.queryByRole('link', { name: 'Open in appointment labs' })
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Open in appointment labs' })).toBeDisabled();
  },
  parameters: {
    docs: {
      story:
        'The empty branch: no patient card, no status pill in the header actions, and both footer ' +
        'actions dead. Worth drawing because `Primary` silently changes element - `href="#"` ' +
        'renders a `<button>`, a real href renders a `next/link` - so the disabled state is a ' +
        'different DOM node, not a modifier.',
    },
  },
};

export const PdfPreviewLoading: Story = {
  name: 'PDF preview loading',
  args: { pdfPreviewLoadingId: RESULT.resultId },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Loading PDF...' })).toBeDisabled();
  },
  parameters: {
    docs: {
      story:
        'The PDF action relabels and disables while its blob is fetched, matched on ' +
        '`pdfPreviewLoadingId === resultId` - so a different row loading leaves this one live. ' +
        'The label is 3 characters longer, which is the only thing that moves.',
    },
  },
};
