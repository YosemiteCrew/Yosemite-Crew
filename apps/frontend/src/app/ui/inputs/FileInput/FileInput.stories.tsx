import type { Meta, StoryObj } from '@storybook/react';
import FileInput from './FileInput';

const meta = {
  title: 'Inputs/FileInput',
  component: FileInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Click-to-upload file input. Hidden native `<input type="file">` triggered via visible label. ' +
          'Accepts DOC, PDF, PNG, JPEG up to 5 MB.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FileInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
