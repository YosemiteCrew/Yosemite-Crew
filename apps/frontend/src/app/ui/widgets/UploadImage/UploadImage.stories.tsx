import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { MEDIA_SOURCES } from '../../../constants/mediaSources';
import UploadImage from './UploadImage';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Built lazily inside a render so no `File` is constructed while the CSF module is analysed. */
const makeFile = (name: string, type: string) =>
  new File([new Blob(['fixture'], { type })], name, {
    type,
  });

const meta = {
  title: 'Widgets/UploadImage',
  component: UploadImage,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Drag-and-drop upload well with a preview strip underneath. Accepts DOC, PDF, PNG and ' +
          'JPEG up to 20 MB and silently drops anything else. Previews come from two sources: files ' +
          'the user just picked (`value`) and files already stored server-side (`existingFiles`); ' +
          'images render as thumbnails, documents as an icon plus filename, and each chip has its ' +
          'own remove button.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    placeholder: 'Upload medical records',
    onChange: fn(),
  },
} satisfies Meta<typeof UploadImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The resting state: the whole well is one button, so keyboard users reach it too.',
      },
    },
  },
};

export const WithSelectedFiles: Story = {
  name: 'Documents selected',
  render: (args) => (
    <UploadImage
      {...args}
      value={[
        makeFile('vaccination-record.pdf', 'application/pdf'),
        makeFile('consent-form.docx', DOCX_MIME),
      ]}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Non-image files render as the icon chip. The PDF and Word icons are separate so a long ' +
          'list stays scannable.',
      },
    },
  },
};

export const WithExistingFiles: Story = {
  name: 'Already-uploaded files',
  args: {
    placeholder: 'Upload companion photos',
    existingFiles: [
      { name: 'kiko-intake.png', type: 'image/png', url: MEDIA_SOURCES.avatars.dog },
      { name: 'insurance-policy.pdf', type: 'application/pdf', url: 'https://example.com/policy' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Files that came back from the API. Image entries get a real thumbnail; removing one only ' +
          'clears it locally, since the component has no delete callback for stored files yet.',
      },
    },
  },
};

export const LongFileName: Story = {
  name: 'Long file name',
  render: (args) => (
    <UploadImage
      {...args}
      value={[
        makeFile(
          '2026-08-15-post-operative-discharge-summary-and-medication-plan.pdf',
          'application/pdf'
        ),
      ]}
    />
  ),
};
