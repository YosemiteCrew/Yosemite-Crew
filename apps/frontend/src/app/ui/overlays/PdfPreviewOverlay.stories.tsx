import { type ComponentProps, useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import PdfPreviewOverlay from './PdfPreviewOverlay';

/**
 * A stand-in document for the frame. `getSafePdfPreviewUrl` accepts `blob:`
 * when `allowBlob` is set, which is exactly how the app previews a freshly
 * generated invoice, so the stories exercise the real code path without
 * shipping a binary fixture or reaching the network.
 */
const DOCUMENT_MARKUP = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Document</title>
<style>
  body { margin: 0; background: #525659; display: flex; justify-content: center; padding: 24px; }
  .sheet { width: 620px; min-height: 780px; background: #fff; color: #1a1a1a; padding: 56px 64px;
    font: 14px/1.6 Georgia, serif; box-shadow: 0 2px 12px rgba(0,0,0,.4); }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #6b6b6b; font-size: 12px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  td { padding: 6px 0; }
  td.num { text-align: right; }
</style></head>
<body><div class="sheet">
  <h1>Invoice INV-2026-0481</h1>
  <p class="muted">Issued 14 September 2026 &middot; Due 28 September 2026</p>
  <hr>
  <table width="100%">
    <tr><td>Consultation &mdash; 30 min</td><td class="num">&euro;65.00</td></tr>
    <tr><td>Meloxicam 1.5 mg/ml, 10 ml</td><td class="num">&euro;18.40</td></tr>
    <tr><td>Post-operative wound check</td><td class="num">&euro;32.00</td></tr>
  </table>
  <hr>
  <table width="100%"><tr><td><strong>Total</strong></td>
    <td class="num"><strong>&euro;115.40</strong></td></tr></table>
</div></body></html>`;

type OverlayProps = ComponentProps<typeof PdfPreviewOverlay>;

const PreviewWithDocument = (args: Omit<OverlayProps, 'pdfUrl'>) => {
  // Created during render rather than in an effect so the frame is present on
  // the first paint; revoked on unmount so switching stories does not leak.
  const [url] = useState(() =>
    URL.createObjectURL(new Blob([DOCUMENT_MARKUP], { type: 'text/html' }))
  );
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return <PdfPreviewOverlay {...args} pdfUrl={url} />;
};

/**
 * No `autodocs` tag on purpose: the overlay portals a `fixed inset-0` panel onto
 * `document.body`, so on a generated docs page every story would stack on top of
 * the page and each other.
 */
const meta = {
  title: 'Overlays/PdfPreviewOverlay',
  component: PdfPreviewOverlay,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Full-screen document preview: a rounded `--screen` panel over a blurred scrim, with the ' +
          'document title, an optional Download action and a close chip above the frame. A loader ' +
          'covers the frame until it reports `load`, keyed by URL so a second document shows the ' +
          'loader again instead of flashing the previous one.',
      },
    },
  },
  args: {
    open: true,
    title: 'Invoice INV-2026-0481.pdf',
    onClose: fn(),
  },
  render: ({ pdfUrl: _pdfUrl, ...args }) => <PreviewWithDocument {...args} />,
} satisfies Meta<typeof PdfPreviewOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'With download',
  args: { pdfUrl: null, onDownload: fn() },
};

export const WithoutDownload: Story = {
  name: 'View only',
  args: { pdfUrl: null },
  parameters: {
    docs: {
      description: {
        story:
          'Omitting `onDownload` drops the Download pill entirely, for documents the viewer is ' +
          'allowed to read but not keep — the close chip is then the only control.',
      },
    },
  },
};

export const LongTitle: Story = {
  name: 'Long file name',
  args: {
    pdfUrl: null,
    onDownload: fn(),
    title: 'Bella Hartmann - post-operative discharge summary and medication plan 2026-09-14.pdf',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The header is a two-column flex row with no truncation on the title, so a long file ' +
          'name is the case that shows whether the action group holds its position.',
      },
    },
  },
};
