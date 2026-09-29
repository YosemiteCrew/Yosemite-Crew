import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { VoiceCapture } from './VoiceCapture';

const meta = {
  title: 'Primitives/Voice capture',
  component: VoiceCapture,
  args: {
    onTranscript: fn(),
    onCorrection: fn(),
    onStop: fn(),
  },
} satisfies Meta<typeof VoiceCapture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
