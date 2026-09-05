import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import type { WorkspaceDocumentRow } from '@yosemite-crew/types';

import { AllDocumentsTable } from './AllDocumentsTable';

/**
 * Stand-in for the rendered PDF. `getSafePdfPreviewUrl` accepts `blob:` when
 * `allowBlob` is set - which is how the app previews a freshly generated
 * document - so the frame exercises the real path without a binary fixture or
 * a network call.
 */
const DOCUMENT_MARKUP = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Discharge summary</title>
<style>
  body { margin: 0; background: #525659; display: flex; justify-content: center; padding: 24px; }
  .sheet { width: 620px; min-height: 780px; background: #fff; color: #1a1a1a; padding: 56px 64px;
    font: 14px/1.6 Georgia, serif; box-shadow: 0 2px 12px rgba(0,0,0,.4); }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 4px; text-transform: uppercase; letter-spacing: .08em; }
  .muted { color: #6b6b6b; font-size: 12px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
</style></head>
<body><div class="sheet">
  <h1>Discharge summary &mdash; Poppy</h1>
  <p class="muted">Beagle, 4y &middot; Discharged 12 March 2026</p>
  <hr>
  <h2>Diagnosis</h2><p>Uncomplicated lower urinary tract infection.</p>
  <h2>Medication</h2><p>Amoxicillin/clavulanate 50 mg, twice daily with food, 10 days.</p>
  <h2>Follow up</h2><p>Recheck urinalysis in 14 days.</p>
</div></body></html>`;

/** Rows carrying this are handed the blob URL by the harness below. */
const RENDERED = 'rendered:local';

const DOCUMENTS: WorkspaceDocumentRow[] = [
  {
    documentId: 'doc-discharge',
    sourceKind: 'DISCHARGE_SUMMARY',
    sourceId: 'enc-8841',
    appointmentId: 'appt-8841',
    encounterId: 'enc-8841',
    companionId: 'companion-1',
    templateId: 'tpl-discharge',
    templateVersion: 3,
    title: 'Discharge summary - Poppy',
    kind: 'DISCHARGE_SUMMARY',
    status: 'FINAL',
    signingStatus: 'SIGNED',
    pdfUrl: RENDERED,
    createdAt: new Date('2026-03-12T10:14:00.000Z'),
    updatedAt: new Date('2026-03-12T10:14:00.000Z'),
  },
  {
    documentId: 'doc-consent',
    sourceKind: 'CONSENT_FORM',
    sourceId: 'frm-2210',
    appointmentId: 'appt-8841',
    encounterId: 'enc-8841',
    companionId: 'companion-1',
    templateId: 'tpl-consent',
    templateVersion: 1,
    title: 'Anaesthesia consent',
    kind: 'CONSENT_FORM',
    status: 'FINAL',
    signingStatus: 'IN_PROGRESS',
    pdfUrl: RENDERED,
    createdAt: new Date('2026-03-12T08:02:00.000Z'),
    updatedAt: new Date('2026-03-12T08:40:00.000Z'),
  },
  {
    documentId: 'doc-lab',
    sourceKind: 'LAB_REPORT',
    sourceId: 'lab-5502',
    appointmentId: 'appt-8841',
    encounterId: 'enc-8841',
    companionId: 'companion-1',
    templateId: null,
    templateVersion: null,
    title: 'Urine culture and sensitivity',
    kind: 'LAB_REPORT',
    status: 'DRAFT',
    signingStatus: 'NOT_REQUIRED',
    // Never rendered, so opening it has to resolve a URL - and fails.
    pdfUrl: null,
    createdAt: new Date('2026-03-11T16:31:00.000Z'),
    updatedAt: new Date('2026-03-11T16:31:00.000Z'),
  },
];

/**
 * Minted outside React - before the story renders, so the frame has its document
 * on the first paint - and revoked by the cleanup `beforeEach` returns, so
 * switching stories does not leak the blob. Same shape as the sibling
 * PdfPreviewOverlay stories.
 */
let documentUrl = '';

/** Hands every `RENDERED` row the live blob URL so its preview opens a real document. */
const seedRenderedDocuments = (documents: WorkspaceDocumentRow[]): WorkspaceDocumentRow[] =>
  documents.map((row) => (row.pdfUrl === RENDERED ? { ...row, pdfUrl: documentUrl } : row));

const meta = {
  title: 'Workspace/AllDocumentsTable',
  component: AllDocumentsTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "All Documents" card in the workspace summary: every artefact the visit produced, ' +
          'and the two surfaces that open out of it.\n\n' +
          'The card itself is deliberately **not** a table despite the name. It lives in a ~400px ' +
          'aside, so a six-track row pushed the status and signing pills out of their columns and ' +
          'over the neighbouring cell; it is stacked cards instead, each with the title truncating ' +
          'on its own line and the pills free to wrap. That is a layout decision no snapshot ' +
          'recorded, because nothing rendered the card at all.\n\n' +
          'Two states are reachable only through the row buttons and had never been drawn. ' +
          '**The preview** is a `PdfPreviewOverlay` portalled to `document.body` as a ' +
          '`fixed inset-0` panel over a blurred scrim - it leaves the card entirely, which is ' +
          'part of why it escaped review. **The inline error** is a `role="alert"` on the ' +
          '`--danger-100` wash that appears *below the list*, inside the same flex column, and ' +
          'pushes nothing else around; it exists only after a failed URL resolve.\n\n' +
          'The two are mutually exclusive by construction: `handleDocumentAction` clears the error ' +
          'before it resolves, then sets either the preview or the message. Both branches are ' +
          'driven here from props alone - a row with a `pdfUrl` short-circuits the lookup, and a ' +
          'row without one, in a story with no `organisationId`, fails before any request is made.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    documents: DOCUMENTS,
    organisationId: 'org-storybook',
    canView: true,
  },
  beforeEach: () => {
    documentUrl = URL.createObjectURL(new Blob([DOCUMENT_MARKUP], { type: 'text/html' }));
    return () => {
      URL.revokeObjectURL(documentUrl);
      documentUrl = '';
    };
  },
  render: ({ documents, ...args }) => (
    <AllDocumentsTable {...args} documents={seedRenderedDocuments(documents)} />
  ),
} satisfies Meta<typeof AllDocumentsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Document list',
  parameters: {
    docs: {
      description: {
        story:
          'Three artefacts with their source pill, humanised status and signing pill. `SIGNED` reads ' +
          'success, `IN_PROGRESS` reads progress and `NOT_REQUIRED` falls through to neutral, so the ' +
          'three tones sit together in one frame.',
      },
    },
  },
};

export const PreviewOpen: Story = {
  name: 'Preview open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'View Discharge summary - Poppy' }));
    // The overlay portals out of the canvas, so query the document - and assert
    // it drew its chrome AND its frame, not merely that something appeared.
    const overlay = document.querySelector('[data-signing-overlay="true"]') as HTMLElement | null;
    await expect(overlay).toBeInTheDocument();
    const panel = within(overlay as HTMLElement);
    await expect(panel.getByText('Discharge summary - Poppy')).toBeInTheDocument();
    await expect(panel.getByTitle('Discharge summary - Poppy')).toBeInTheDocument();
    await expect(
      panel.getByRole('button', { name: 'Download Discharge summary - Poppy' })
    ).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Close PDF preview' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The document itself, in the full-screen preview. The header carries the row title verbatim ' +
          '- so a long document name has to sit beside the Download and close chips - and a loader ' +
          'covers the frame, keyed by URL, until it reports `load`.',
      },
    },
  },
};

export const PreviewClosed: Story = {
  name: 'Preview dismissed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'View Anaesthesia consent' }));
    const overlay = document.querySelector('[data-signing-overlay="true"]');
    await expect(overlay).toBeInTheDocument();
    await userEvent.click(
      within(overlay as HTMLElement).getByRole('button', { name: 'Close PDF preview' })
    );
    // The card owns the preview state, so closing must unmount the portal
    // rather than leave an invisible fixed layer over the page.
    await expect(document.querySelector('[data-signing-overlay="true"]')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Closing clears `preview`, which drops the portal outright. Worth pinning: a `fixed ' +
          'inset-0` layer left mounted would swallow every click on the workspace behind it.',
      },
    },
  },
};

export const DownloadRow: Story = {
  name: 'Download opens the same preview',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Download Discharge summary - Poppy' })
    );
    const overlay = document.querySelector('[data-signing-overlay="true"]') as HTMLElement | null;
    await expect(overlay).toBeInTheDocument();
    await expect(
      within(overlay as HTMLElement).getByTitle('Discharge summary - Poppy')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The download chip is wired to the same handler as the eye, so it opens the preview rather ' +
          "than saving the file - the actual download lives on the overlay's own button. Two " +
          'differently-labelled controls with one behaviour is only visible by driving both.',
      },
    },
  },
};

export const ResolveFailed: Story = {
  name: 'Document cannot be opened',
  // Empty rather than omitted: an absent organisation is exactly what the
  // guard tests, and an explicit '' cannot be lost to arg merging.
  args: { organisationId: '' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'View Urine culture and sensitivity' })
    );
    // The lab row has no `pdfUrl`, and with no organisation the lookup cannot
    // even be attempted, so the failure is raised before any request.
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Organisation missing for document lookup.');
    // The two states are exclusive: a failed resolve must not also portal.
    await expect(document.querySelector('[data-signing-overlay="true"]')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The inline alert, which sits under the list rather than replacing it, so the rows stay ' +
          'usable and the message reads as being about the row that was just pressed. It is the ' +
          'only red on the card and it has no dismiss - the next successful open clears it.',
      },
    },
  },
};

export const LoadFailed: Story = {
  name: 'Document list failed to load',
  args: { error: 'Documents are unavailable for this visit.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Documents are unavailable for this visit.'
    );
    // `error` replaces the list outright rather than sitting above it.
    await expect(canvas.queryByText('Discharge summary - Poppy')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A fetch-level failure. This alert is a different element from the per-row one above: it ' +
          'takes the place of the whole list, so the card is red copy and nothing else.',
      },
    },
  },
};

export const NoDocuments: Story = {
  name: 'No documents yet',
  args: { documents: [] },
  parameters: {
    docs: {
      description: {
        story:
          'The neutral empty notice on `--neutral-100`, which is what the card shows for most of a ' +
          'visit - nothing is written here until a document is generated or signed.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (no view permission)',
  args: { canView: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Discharge summary - Poppy')).toBeInTheDocument();
    // The action chips are dropped entirely rather than disabled, so the row
    // has to hold together with its right-hand column gone.
    await expect(
      canvas.queryByRole('button', { name: 'View Discharge summary - Poppy' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Without the documents-view permission the rows keep their metadata and lose their ' +
          'actions. Nothing is dimmed - there is no affordance suggesting a preview that cannot ' +
          'happen.',
      },
    },
  },
};
