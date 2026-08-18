import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn, within } from 'storybook/test';
import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import AttestationDocumentPanel from './AttestationDocumentPanel';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import type { SignedFile } from '@/app/features/documents/types/companionDocuments';

/**
 * The panel fetches its signed file URLs on mount, so each story swaps the API
 * client's adapter for a canned one and puts the real adapter back on unmount.
 * Nothing here reaches the network, and `clearInFlightGetRequests` is part of
 * the teardown because a story that never resolves would otherwise leave its
 * promise in the GET dedupe cache for the next story to await forever.
 */
const withFiles = (adapter: AxiosAdapter) => () => {
  const previous = api.defaults.adapter;
  api.defaults.adapter = adapter;
  return () => {
    api.defaults.adapter = previous;
    clearInFlightGetRequests();
  };
};

const respondWith = (files: SignedFile[]): AxiosAdapter => {
  return (config: InternalAxiosRequestConfig) =>
    Promise.resolve<AxiosResponse<SignedFile[]>>({
      data: files,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
};

const respondWithFailure = (status: number, message: string): AxiosAdapter => {
  return (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError(message, String(status), config, undefined, {
        data: { message },
        status,
        statusText: message,
        headers: {},
        config,
      })
    );
};

/** A request that never settles, which is what "still loading" actually is. */
const neverResponds: AxiosAdapter = () => new Promise<AxiosResponse>(() => {});

/**
 * A stand-in for a photographed certificate, inlined as a data URI so the story
 * is deterministic and needs no network. The colours inside it are the content
 * of a scan - paper and print - not UI chrome.
 */
const SCAN_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="452">',
  '<rect width="640" height="452" fill="#fbfaf7"/>',
  '<rect x="28" y="28" width="584" height="396" fill="#ffffff" stroke="#d9d3c8"/>',
  '<text x="60" y="96" font-family="Georgia, serif" font-size="26" fill="#2b2a28">',
  'Rabies Vaccination Certificate</text>',
  '<rect x="60" y="126" width="300" height="10" fill="#e6e1d8"/>',
  '<rect x="60" y="156" width="470" height="10" fill="#e6e1d8"/>',
  '<rect x="60" y="186" width="420" height="10" fill="#e6e1d8"/>',
  '<rect x="60" y="216" width="360" height="10" fill="#e6e1d8"/>',
  '<rect x="60" y="286" width="200" height="10" fill="#e6e1d8"/>',
  '<text x="60" y="366" font-family="Georgia, serif" font-size="20" fill="#4a4640">',
  'Signed: A. Osei MRCVS</text>',
  '</svg>',
].join('');

const SCAN_IMAGE_URL = `data:image/svg+xml;utf8,${encodeURIComponent(SCAN_SVG)}`;

const IMAGE_FILE: SignedFile = {
  url: SCAN_IMAGE_URL,
  mimeType: 'image/png',
  key: 'rabies-cert.png',
};

const PDF_FILE: SignedFile = {
  url: 'https://files.example/rabies-cert.pdf',
  mimeType: 'application/pdf',
  key: 'rabies-cert.pdf',
};

const meta = {
  title: 'Pet Passport/Attestation/AttestationDocumentPanel',
  component: AttestationDocumentPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The uploaded file itself, shown beside the parsed fields so the vet attests what they can ' +
          'actually see. Images render inline; every other type - a scanned PDF certificate, most ' +
          'often - only offers an open action, because the app’s CSP allows those signed storage URLs ' +
          'as images but not as frames. All four load states are covered here: no file, loading, ' +
          'loaded, and a failure that says plainly not to attest a record you cannot read.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    documentId: 'doc-rabies-2026',
    title: 'Rabies vaccination certificate',
    onOpenFile: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[420px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AttestationDocumentPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The record carries no `documentId` at all, so nothing is ever requested. This
 * is an empty state rather than a failure, and it is worded as one.
 */
export const NoDocument: Story = {
  name: 'Empty - no file attached',
  args: { documentId: undefined },
  beforeEach: withFiles(neverResponds),
};

export const Loading: Story = {
  name: 'Loading',
  beforeEach: withFiles(neverResponds),
  parameters: {
    docs: {
      description: {
        story:
          'The signed URL is still being fetched. The panel holds its height with the shared ' +
          'skeleton fill, so the two-up grid does not jump when the file lands.',
      },
    },
  },
};

export const ImagePreview: Story = {
  name: 'Image - previewed inline',
  beforeEach: withFiles(respondWith([IMAGE_FILE])),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByAltText('Uploaded document: Rabies vaccination certificate');
  },
};

export const PdfDocument: Story = {
  name: 'PDF - open in a new tab',
  beforeEach: withFiles(respondWith([PDF_FILE])),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('PDF document');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A file the panel cannot frame becomes a titled tile naming its kind, plus the open action - ' +
          'never a blank box that leaves the vet unsure whether anything was uploaded.',
      },
    },
  },
};

export const MultipleFiles: Story = {
  name: 'Several files',
  beforeEach: withFiles(respondWith([IMAGE_FILE, PDF_FILE])),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('button', {
      name: 'Open Rabies vaccination certificate (file 2)',
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'One upload can carry several files. Each gets its own open action, numbered from the second ' +
          'onwards so two identical "Open document" buttons are still told apart by a screen reader.',
      },
    },
  },
};

export const FailedToLoad: Story = {
  name: 'Error - file could not be loaded',
  beforeEach: withFiles(respondWithFailure(403, 'The signed URL has expired.')),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('alert');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The fetch failed, so the panel says so in danger ink and announces it. This is the one state ' +
          'that must never read like the empty state: an unreadable file is a reason to stop, not a ' +
          'record with nothing attached.',
      },
    },
  },
};
