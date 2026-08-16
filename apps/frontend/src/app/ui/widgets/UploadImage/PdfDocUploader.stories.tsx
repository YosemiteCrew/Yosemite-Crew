import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import PdfDocUploader from './PdfDocUploader';

type UploaderProps = ComponentProps<typeof PdfDocUploader>;

/**
 * The signer is the component's only route to the network: it hands back the S3
 * URL that the PUT then targets. Returning a promise that never settles lets a
 * story pick a real file — the preview card appears — while guaranteeing no
 * request leaves Storybook.
 */
const stalledSigner: UploaderProps['getSignedUrl'] = () =>
  new Promise(() => {
    // Deliberately never resolves; see the note above.
  });

/** Built inside a render so no `File` is constructed while the CSF module is analysed. */
const makePdf = (name: string) =>
  new File([new Blob(['fixture'], { type: 'application/pdf' })], name, {
    type: 'application/pdf',
  });

const meta = {
  title: 'Widgets/PdfDocUploader',
  component: PdfDocUploader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Single-file PDF upload well. Click or drop onto it, and the file goes straight to S3 ' +
          'through a signed URL the caller supplies via `getSignedUrl` — which is why the same well ' +
          'serves practice documents (`DocUploader`) and companion records (`CompanionDoc`) without ' +
          'knowing either endpoint. Anything that is not a PDF, or is over 20 MB, is dropped ' +
          'silently. The selected file is the caller’s state, so the preview card below the well ' +
          'is driven by the `file` prop rather than by anything the component remembers.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    placeholder: 'Upload signed consent form',
    file: null,
    onChange: fn(),
    setFile: fn(),
    getSignedUrl: stalledSigner,
  },
} satisfies Meta<typeof PdfDocUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The resting state. The whole well is one `<button>` labelled with the placeholder, so a ' +
          'keyboard user reaches the file picker the same way a mouse user does, and the "Only PDF / ' +
          'max size 20 MB" line states the limits before a rejected file can confuse anyone.',
      },
    },
  },
};

export const FileSelected: Story = {
  name: 'File selected',
  render: (args) => <PdfDocUploader {...args} file={makePdf('rabies-certificate.pdf')} />,
  parameters: {
    docs: {
      description: {
        story:
          'Once a file is picked the preview card joins the well: document glyph, file name, and a red ' +
          'trash control in the corner that clears the selection through `setFile`. The well stays ' +
          'visible, so replacing the file is one click rather than a remove-then-add.',
      },
    },
  },
};

export const LongFileName: Story = {
  name: 'Long file name',
  render: (args) => (
    <PdfDocUploader
      {...args}
      placeholder="Upload discharge paperwork"
      file={makePdf('2026-08-15-post-operative-discharge-summary-and-medication-plan.pdf')}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The overflow case: the name is capped at 150px and truncated with an ellipsis, so a long ' +
          'file name cannot push the remove control off the card.',
      },
    },
  },
};
