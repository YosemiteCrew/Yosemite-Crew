import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { fn } from 'storybook/test';

import DocUploader from './DocUploader';

/** Built inside a render so no `File` is constructed while the CSF module is analysed. */
const makePdf = (name: string) => new File(['fixture'], name, { type: 'application/pdf' });

/**
 * `file`/`setFile` are owned by the caller, so the stories hold them locally.
 * Nothing reaches the network until a file is actually picked — `apiUrl` is only
 * read inside the signed-URL request that a selection triggers.
 */
const ControlledDocUploader = ({
  initialFile = null,
  placeholder,
  apiUrl,
  onChange,
}: {
  initialFile?: File | null;
  placeholder: string;
  apiUrl: string;
  onChange: (url: string, mimeType?: string, size?: number) => void;
}) => {
  const [file, setFile] = useState<File | null>(initialFile);
  return (
    <div style={{ maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <DocUploader
        placeholder={placeholder}
        apiUrl={apiUrl}
        onChange={onChange}
        file={file}
        setFile={setFile}
      />
    </div>
  );
};

const meta = {
  title: 'Widgets/UploadImage/DocUploader',
  component: DocUploader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The PDF-only upload well used for signed documents and records. It is a single button, so ' +
          'click, keyboard and drag-and-drop all reach the same picker, and it rejects anything that ' +
          'is not a PDF or is over 20 MB before any request is made. A picked file is exchanged for a ' +
          'signed S3 URL from `apiUrl`, uploaded directly, and reported back through `onChange` as an ' +
          'S3 key; the chip below the well shows what is currently attached.',
      },
    },
  },
  args: {
    placeholder: 'Upload signed consent form',
    apiUrl: '/v1/storage/signed-url',
    onChange: fn(),
    file: null,
    setFile: fn(),
  },
} satisfies Meta<typeof DocUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: (args) => (
    <ControlledDocUploader
      placeholder={args.placeholder}
      apiUrl={args.apiUrl}
      onChange={args.onChange}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The resting state. The constraints are stated up front rather than surfaced as an error ' +
          'after the user has already picked the wrong file.',
      },
    },
  },
};

export const WithFile: Story = {
  name: 'Document attached',
  render: (args) => (
    <ControlledDocUploader
      initialFile={makePdf('vaccination-consent.pdf')}
      placeholder={args.placeholder}
      apiUrl={args.apiUrl}
      onChange={args.onChange}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The attached document renders as a chip under the well, with its own remove button. The ' +
          'well stays open so a replacement can be dropped straight onto it.',
      },
    },
  },
};

export const LongFileName: Story = {
  name: 'Long file name',
  render: (args) => (
    <ControlledDocUploader
      initialFile={makePdf('2026-08-15-post-operative-discharge-summary-and-medication-plan.pdf')}
      placeholder={args.placeholder}
      apiUrl={args.apiUrl}
      onChange={args.onChange}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'File names are clamped to 150px and truncated, so a long upload cannot stretch the chip ' +
          'past the form column it sits in.',
      },
    },
  },
};
