import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import 'react-toastify/dist/ReactToastify.css';
import Success from './Success';

type SuccessProps = ComponentProps<typeof Success>;

/**
 * `toastProps` is react-toastify's own runtime bag (position, transition,
 * progress state). `Success` never reads it, so the stories hand over an empty
 * object typed off the component's own props rather than reconstructing a
 * container the story does not mount.
 */
const TOAST_PROPS = {} as SuccessProps['toastProps'];

const meta = {
  title: 'Widgets/Toast/Success',
  component: Success,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Body of the success toast `toast.success()` renders through react-toastify: a green ' +
          'checkmark glyph, a `--text-primary` title and a `--text-tertiary` detail line, with the ' +
          'shared round close chip on the right. The warm-glass surface around it comes from the ' +
          '`.Toastify__toast` override in `globals.css`; the decorator reproduces that container so ' +
          'the stories show the toast at its real width rather than free-floating.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    isPaused: false,
    toastProps: TOAST_PROPS,
    closeToast: fn(),
    data: {
      title: 'Appointment confirmed',
      text: 'Kiko is booked with Dr. Carter for Tuesday at 10:30.',
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
} satisfies Meta<typeof Success>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TitleOnly: Story = {
  name: 'Title only',
  args: {
    data: { title: 'Changes saved', text: '' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Callers with nothing to add pass an empty `text`. The second line collapses to zero ' +
          'height and the row re-centres on the title rather than leaving a gap under it.',
      },
    },
  },
};

export const LongMessage: Story = {
  name: 'Long message (wraps)',
  args: {
    data: {
      title: 'Vaccination record uploaded to the companion profile',
      text: 'The rabies certificate was attached to Kiko and shared with the pet parent, who will see it in the app the next time they open the passport.',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'The overflow case, and the one worth watching: neither the 34px check glyph nor the close ' +
          'chip is `shrink-0`, so as the message grows the flex row takes the space back out of the ' +
          'icon rather than wrapping around it. Compare the glyph here with the one in `Default`.',
      },
    },
  },
};
