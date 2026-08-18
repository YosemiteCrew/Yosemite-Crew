import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import HistoryRecordDrawer, { type RecordDetailPair } from './HistoryRecordDrawer';
import type { HistoryEntry } from '@/app/features/companionHistory/types/history';

const LAB_ENTRY: HistoryEntry = {
  id: 'hist-lab-1',
  type: 'LAB_RESULT',
  occurredAt: '2026-03-12T09:42:00.000Z',
  status: 'COMPLETED',
  title: 'Complete blood count',
  subtitle: 'IDEXX ProCyte Dx',
  summary:
    'Mild regenerative anaemia with a normal platelet count. Recheck haematocrit in ten days; ' +
    'no transfusion indicated at this level.',
  actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' },
  tags: ['haematology'],
  link: { kind: 'labResult', id: 'lab-1', appointmentId: 'appt-1', companionId: 'companion-1' },
  source: 'idexx',
  payload: {},
};

/**
 * A record the document store actually holds. `payload.documentId` is what
 * flips the footer's primary action from an open path to a download.
 */
const DOCUMENT_ENTRY: HistoryEntry = {
  id: 'hist-doc-1',
  type: 'DOCUMENT',
  occurredAt: '2026-02-28T14:05:00.000Z',
  title: 'Rabies vaccination certificate',
  subtitle: 'Uploaded by the parent',
  summary: 'Issued by Harbourside Veterinary Group, valid to 28 February 2029.',
  link: { kind: 'document', id: 'doc-rabies-2026', companionId: 'companion-1' },
  source: 'documents',
  payload: { documentId: 'doc-rabies-2026' },
};

const INVOICE_ENTRY: HistoryEntry = {
  id: 'hist-invoice-1',
  type: 'INVOICE',
  occurredAt: '2026-03-12T11:20:00.000Z',
  status: 'PAID',
  title: 'Invoice INV-2026-0481',
  subtitle: '148.50 EUR',
  link: { kind: 'invoice', id: 'inv-481', appointmentId: 'appt-1' },
  source: 'finance',
  payload: {},
};

const CBC_RESULTS: RecordDetailPair[] = [
  { label: 'Haematocrit', value: '33 %', range: '37 - 55', abnormal: true, direction: '↓' },
  { label: 'Haemoglobin', value: '11.2 g/dL', range: '12 - 18', abnormal: true, direction: '↓' },
  { label: 'White cell count', value: '9.4 K/uL', range: '5.05 - 16.76' },
  { label: 'Platelets', value: '412 K/uL', range: '148 - 484' },
  { label: 'Reticulocytes', value: '96 K/uL', range: '10 - 110' },
  { label: 'Segmented neutrophils', value: '7.1 K/uL', range: '2.95 - 11.64' },
];

const meta = {
  title: 'Companions/HistoryRecordDrawer',
  component: HistoryRecordDrawer,
  parameters: {
    // No `autodocs`: the drawer portals to document.body over a fixed, blurred
    // backdrop, so on a docs page every story would stack on top of the page
    // instead of rendering in its own block. Same call as OtpModal and
    // RecordAttestationModal.
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The record-detail panel behind a row in a companion history timeline: a 360px ' +
          '`size="sm"` drawer on tablet and desktop, full-screen on a phone.\n\n' +
          'It returns `null` for a null `entry`, so the entire panel - header, results table, note ' +
          'block, linked-record card and the four-action footer - existed only after a row was ' +
          'clicked and had never been rendered in Storybook. That is the same class of gap that ' +
          'let four layout bugs ship on this branch, two of them grid bugs on overlays that only ' +
          'appear after an interaction: one popover whose `grid-template-columns` used a comma, ' +
          'which is invalid CSS, so the browser dropped the declaration and six children stacked ' +
          'into a single column; and two calendar overlays with an orphaned grid child that ' +
          'doubled their height.\n\n' +
          'This panel has a grid of exactly that kind. `RESULT_GRID_CLASS` is ' +
          '`grid grid-cols-[1fr_72px_90px] gap-2 px-3.5`, and it is applied twice - once to the ' +
          'sticky `yc-table-head` row and once to every result row - so the header and the body ' +
          'only line up while both keep the identical template. Nothing but a rendered panel can ' +
          'show that they do.\n\n' +
          'Two other branches are worth seeing: an abnormal row tints its whole width with ' +
          '`--warn-bg` and repaints all three cells `--warn-text`, and the footer primary action ' +
          'is chosen from the record itself - a record that resolves to a stored document offers ' +
          '"Download PDF", every other type keeps its own open path ("Open result", ' +
          '"Open finance", "Open task", ...) because the download endpoint could never resolve ' +
          'those ids.',
      },
    },
  },
  args: {
    entry: LAB_ENTRY,
    results: CBC_RESULTS,
    linkedLabel: 'Annual check-up - 12 March 2026',
    onClose: fn(),
    onDownload: fn(),
    onView: fn(),
    onOpenLinked: fn(),
    onShare: fn(),
    onDiscuss: fn(),
  },
} satisfies Meta<typeof HistoryRecordDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'No entry (renders nothing)',
  args: { entry: null },
  play: async () => {
    // The guard is the gate: with no entry there is no dialog in the document at
    // all, not a hidden one.
    await expect(within(document.body).queryByRole('dialog')).toBeNull();
  },
  parameters: {
    docs: {
      story:
        'The state the timeline sits in for as long as no row is open. Worth pinning: the drawer ' +
        'is unmounted rather than hidden, so nothing inside it holds focus or listens for Escape.',
    },
  },
};

export const LabResult: Story = {
  name: 'Lab result (abnormal rows)',
  play: async () => {
    const panel = within(await within(document.body).findByRole('dialog'));
    await expect(panel.getByText('Record detail')).toBeInTheDocument();
    // Assert the panel has a real table, not just that a dialog opened.
    await expect(panel.getByText('Analyte')).toBeInTheDocument();
    await expect(panel.getByText('Result')).toBeInTheDocument();
    await expect(panel.getByText('Range')).toBeInTheDocument();
    await expect(panel.getByText('Haematocrit ↓')).toBeInTheDocument();
    await expect(panel.getByText('37 - 55')).toBeInTheDocument();
    await expect(panel.getByText('Reticulocytes')).toBeInTheDocument();
    // And the whole footer, which is the other half of the gated surface.
    await expect(panel.getByRole('button', { name: /open result/i })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: /share to app/i })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: /discuss in chat/i })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The full panel: six analytes under a static table head, two of them out of range and so ' +
        'tinted across all three columns with an arrow appended to the analyte name; the clinical ' +
        'note in its `--inset` block; the linked appointment card; and the stacked footer. Not a ' +
        'lab record in the document store, so the primary action is "Open result" rather than a ' +
        'download.',
    },
  },
};

export const StoredDocument: Story = {
  name: 'Stored document (Download PDF)',
  args: { entry: DOCUMENT_ENTRY, results: [], linkedLabel: null },
  play: async () => {
    const panel = within(await within(document.body).findByRole('dialog'));
    await expect(panel.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: /open file/i })).toBeNull();
    // No results and no link, so only the note block sits between header and footer.
    await expect(panel.queryByText('Analyte')).toBeNull();
    await expect(panel.getByText(/Harbourside Veterinary Group/)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The download branch, reached because `payload.documentId` resolves. It is also the ' +
        'sparsest layout the panel can take - no results grid, no linked card - which is where a ' +
        'body that relies on its children for height shows up.',
    },
  },
};

export const InvoiceWithoutResults: Story = {
  name: 'Invoice (open path, linked record)',
  args: { entry: INVOICE_ENTRY, results: [] },
  play: async () => {
    const panel = within(await within(document.body).findByRole('dialog'));
    await expect(panel.getByRole('button', { name: /open finance/i })).toBeInTheDocument();
    await expect(
      panel.getByRole('button', { name: /Annual check-up - 12 March 2026/ })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'A finance record: no analytes, no summary, so the only thing between the header and the ' +
        'footer is the "Linked to" card. It falls back to `subtitle` for the note block, which is ' +
        'why the amount appears there rather than being lost.',
    },
  },
};

export const LongTitleAndNote: Story = {
  name: 'Long title and note',
  args: {
    entry: {
      ...LAB_ENTRY,
      title: 'Pre-anaesthetic haematology and biochemistry profile with electrolytes',
      summary:
        'All values within reference intervals except a mildly reduced haematocrit, consistent ' +
        'with the regenerative anaemia noted at the previous visit. Anaesthesia may proceed; ' +
        'repeat a packed cell volume on the morning of the procedure and hold if it drops below ' +
        '30 per cent.',
    },
    results: CBC_RESULTS.slice(0, 2),
  },
  parameters: {
    docs: {
      story:
        'The header title is a single `truncate` line at 17px, so a long record name is clipped ' +
        'rather than wrapping the close button out of the row - while the note below it wraps ' +
        'freely. The two behaviours sit three elements apart and only compose in a rendered panel.',
    },
  },
};
