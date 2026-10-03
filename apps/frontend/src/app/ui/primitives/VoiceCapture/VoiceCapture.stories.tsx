import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import VoiceCapture from './VoiceCapture';
import type { SpeechTranscriptionAdapter, SpeechTranscriptionEvents } from './speechTranscription';

const mockTranscriber: SpeechTranscriptionAdapter = {
  id: 'storybook-mock',
  isSupported: () => true,
  start: (events: SpeechTranscriptionEvents) => {
    events.onStart?.();
    events.onInterim?.('Hi there');
  },
  stop: () => undefined,
  abort: () => undefined,
};

const unsupportedTranscriber: SpeechTranscriptionAdapter = {
  id: 'storybook-unsupported',
  isSupported: () => false,
  start: () => undefined,
  stop: () => undefined,
  abort: () => undefined,
};

const meta = {
  title: 'Primitives/VoiceCapture',
  component: VoiceCapture,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Accessible voice capture for staff: shows when the mic is live, streams interim captions, ' +
          'lets the author correct the transcript before use, repeats the recording and stops playback ' +
          'immediately, and always degrades to a typed message. Uses the Web Speech API through a ' +
          'swap-able adapter so the provider can be replaced without changing the UI. MediaRecorder and ' +
          'SpeechRecognition are unavailable if the microphone is denied, so the panel stays usable as a ' +
          'plain text input and a screen-reader message explains why.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
  },
  args: {
    onTranscript: fn(),
    onCorrection: fn(),
    onStop: fn(),
  },
} satisfies Meta<typeof VoiceCapture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Voice capture (supported)',
  args: { transcriber: mockTranscriber },
};

export const Unsupported: Story = {
  name: 'Unsupported browser',
  args: { transcriber: unsupportedTranscriber },
};

export const CustomPlaceholder: Story = {
  name: 'Custom placeholder',
  args: { transcriber: mockTranscriber, placeholder: 'Describe the patient visit…' },
};
