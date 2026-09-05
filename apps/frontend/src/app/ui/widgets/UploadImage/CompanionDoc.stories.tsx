import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import axios, { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';

import api from '@/app/services/axios';
import CompanionDoc from './CompanionDoc';

const COMPANION_ID = 'companion-bruno-7f2a';
const API_URL = '/v1/document/pms/upload-url';
const PLACEHOLDER = 'Upload vaccination certificate';
const UPLOAD_URL =
  'https://uploads.yosemitecrew.example/companions/companion-bruno-7f2a/rabies.pdf?signature=stub';
const S3_KEY = 'companions/companion-bruno-7f2a/rabies-vaccination-2026.pdf';

/** Built inside a render or a play so no `File` is constructed while the CSF module is analysed. */
const makePdf = (name: string) => new File(['fixture'], name, { type: 'application/pdf' });

type Recorded = { method: string; url: string; body: unknown };
const recorded: Recorded[] = [];

const ok = (config: Parameters<AxiosAdapter>[0], data: unknown) =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse);

/**
 * The two hops of a real upload, answered offline. The signer POST goes through
 * the shared `api` instance; the PUT to the signed URL goes through the GLOBAL
 * axios export in `PdfDocUploader`, which was created with its own defaults, so
 * both adapters have to be swapped for the whole path to run.
 */
const signAndAccept: AxiosAdapter = (config) => {
  const method = String(config.method ?? 'get').toUpperCase();
  const url = String(config.url ?? '');
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  recorded.push({ method, url, body: body instanceof File ? `File(${body.name})` : body });

  if (method === 'POST' && url === API_URL) {
    return ok(config, { url: UPLOAD_URL, key: S3_KEY });
  }
  if (method === 'PUT' && url === UPLOAD_URL) {
    return ok(config, null);
  }
  return Promise.reject(
    new AxiosError(`Unstubbed request: ${url}`, 'ERR_BAD_REQUEST', config, undefined, {
      data: { message: 'Not Found' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config,
    } as AxiosResponse)
  );
};

const withSignedUpload = () => {
  recorded.length = 0;
  const previousApi = api.defaults.adapter;
  const previousGlobal = axios.defaults.adapter;
  api.defaults.adapter = signAndAccept;
  axios.defaults.adapter = signAndAccept;
  return () => {
    api.defaults.adapter = previousApi;
    axios.defaults.adapter = previousGlobal;
  };
};

const meta = {
  title: 'Widgets/UploadImage/CompanionDoc',
  component: CompanionDoc,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The companion-record flavour of the PDF upload well. It is `PdfDocUploader` with the ' +
          'signer filled in: when a file is picked it POSTs `{ mimeType, patientId }` to ' +
          '`apiUrl`, takes the `url` and `key` that come back, PUTs the file to that URL, and ' +
          'reports the S3 key (plus type and size) through `onChange`. The selected file is the ' +
          "caller's state, so the preview card is driven by the `file` prop.\n\n" +
          'Two things the well does quietly: a file that is not a PDF, or is over 20 MB, is ' +
          "dropped without a message (the caller's form is expected to say so), and the `error` " +
          'prop is accepted but never rendered - `CompanionDocumentUploadForm` draws its own ' +
          'warning under the well instead. Both are pinned in stories below so they stay ' +
          'deliberate.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    placeholder: PLACEHOLDER,
    apiUrl: API_URL,
    companionId: COMPANION_ID,
    file: null,
    onChange: fn(),
    setFile: fn(),
  },
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 420, display: 'grid', gap: 12 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof CompanionDoc>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: PLACEHOLDER })).toBeInTheDocument();
    await expect(canvas.getByText(/Only PDF/)).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting well. The whole area is one `<button>` named by the placeholder, and the ' +
          '"Only PDF / max size 20 MB" line states the limits before a rejected file can confuse ' +
          'anyone.',
      },
    },
  },
};

export const FileSelected: Story = {
  name: 'File selected',
  render: (args) => <CompanionDoc {...args} file={makePdf('rabies-vaccination-2026.pdf')} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('rabies-vaccination-2026.pdf')).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove rabies-vaccination-2026.pdf' })
    );
    await expect(args.setFile).toHaveBeenCalledWith(null);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A picked file adds the preview card under the well: document glyph, name, and a red ' +
          'trash control that clears the selection through `setFile(null)`. The well stays, so ' +
          'replacing the file is one click.',
      },
    },
  },
};

export const SignedUpload: Story = {
  name: 'Pick a file (signed upload)',
  beforeEach: withSignedUpload,
  play: async ({ args, canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('file input not rendered');
    const pdf = makePdf('rabies-vaccination-2026.pdf');

    await userEvent.upload(input, pdf);
    await expect(args.setFile).toHaveBeenCalledWith(pdf);

    // Sign, PUT, report - the key from the signer is what the form stores.
    await waitFor(() =>
      expect(args.onChange).toHaveBeenCalledWith(S3_KEY, 'application/pdf', pdf.size)
    );
    await expect(recorded).toEqual([
      {
        method: 'POST',
        url: API_URL,
        body: { mimeType: 'application/pdf', patientId: COMPANION_ID },
      },
      { method: 'PUT', url: UPLOAD_URL, body: 'File(rabies-vaccination-2026.pdf)' },
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole path, with both network hops answered by a stubbed adapter. The signer is ' +
          'asked with the companion id as `patientId`, the file is PUT to exactly the URL it ' +
          'returned, and `onChange` receives the S3 key rather than the URL - the key is what the ' +
          'record keeps.',
      },
    },
  },
};

export const RejectedFile: Story = {
  name: 'Non-PDF dropped (ignored)',
  beforeEach: withSignedUpload,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const png = new File(['fixture'], 'bruno-portrait.png', { type: 'image/png' });

    /* Dropped rather than picked: the picker's `accept=".pdf"` would filter a
       PNG before the component ever saw it, so the drop path is the one that
       exercises `validatePdfFile`. A REAL `DataTransfer` is required - a plain
       `{ files: [...] }` cannot be converted to one, and `DragEvent`'s
       constructor rejects it outright rather than degrading. */
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(png);
    fireEvent.drop(canvas.getByRole('button', { name: PLACEHOLDER }), { dataTransfer });

    await expect(args.setFile).not.toHaveBeenCalled();
    await expect(args.onChange).not.toHaveBeenCalled();
    await expect(recorded).toHaveLength(0);
    await expect(canvas.queryByText('bruno-portrait.png')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A PNG dropped onto the well. Nothing happens: no selection, no signer call, no ' +
          'message. The same silence covers a PDF over 20 MB. The form around the well is where ' +
          'the reader is told, which is why this is pinned rather than fixed here.',
      },
    },
  },
};

export const WithError: Story = {
  name: 'Error prop (not rendered)',
  args: {
    error: 'Please attach the signed consent form.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: PLACEHOLDER })).toBeInTheDocument();
    // Accepted for API symmetry with the other wells, never drawn.
    await expect(
      canvas.queryByText('Please attach the signed consent form.')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`error` is part of the props and is dropped on the floor: the well looks exactly like ' +
          'the empty state. The upload form renders its own warning beneath, so a message here ' +
          'would double up. Pinned so the omission stays a decision.',
      },
    },
  },
};
