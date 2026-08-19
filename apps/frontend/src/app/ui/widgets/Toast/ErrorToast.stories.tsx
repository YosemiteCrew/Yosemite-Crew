import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import 'react-toastify/dist/ReactToastify.css';
import ErrorToast from './ErrorToast';

type ErrorToastProps = ComponentProps<typeof ErrorToast>;

/**
 * `toastProps` is react-toastify's own runtime bag (position, transition,
 * progress state). `ErrorToast` never reads it, so the stories hand over an
 * empty object typed off the component's own props rather than reconstructing
 * a container the story does not mount.
 */
const TOAST_PROPS = {} as ErrorToastProps['toastProps'];

const meta = {
  title: 'Widgets/Toast/ErrorToast',
  component: ErrorToast,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Body of the error toast `toast.error()` renders through react-toastify: a red alert ' +
          'glyph, a `--text-primary` title and a `--text-tertiary` detail line, with the shared ' +
          'round close chip on the right. The warm-glass surface around it comes from the ' +
          '`.Toastify__toast` override in `globals.css`; the decorator reproduces that container ' +
          'so the stories show the toast at its real 320px width rather than free-floating.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    isPaused: false,
    toastProps: TOAST_PROPS,
    closeToast: fn(),
    data: {
      title: 'Could not save appointment',
      text: 'The slot was taken while you were editing.',
    },
  },
  decorators: [
    (Story) => (
      <div className="Toastify">
        <div className="Toastify__toast">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TitleOnly: Story = {
  name: 'Title only',
  args: {
    data: { title: 'Upload failed', text: '' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Callers that have nothing to add pass an empty `text`. The second line collapses to ' +
          'zero height, so the toast shrinks to the 64px minimum rather than leaving a gap.',
      },
    },
  },
};

export const LongMessage: Story = {
  name: 'Long message (wraps)',
  args: {
    data: {
      title: 'Prescription could not be sent to the dispensary',
      text: 'The dispensary rejected the request because the product is out of stock and no substitute has been configured for this organisation.',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'The overflow case, and the one worth watching: neither the 34px alert glyph nor the ' +
          'close chip is `shrink-0`, so as the message grows the flex row takes the space back ' +
          'out of the icon rather than wrapping around it. Compare the glyph here with the one ' +
          'in `Default`.',
      },
    },
  },
};
