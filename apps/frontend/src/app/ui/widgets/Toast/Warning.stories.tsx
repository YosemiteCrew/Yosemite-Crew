import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import 'react-toastify/dist/ReactToastify.css';
import Warning from './Warning';

type WarningProps = ComponentProps<typeof Warning>;

/**
 * `toastProps` is react-toastify's own runtime bag (position, transition,
 * progress state). `Warning` never reads it, so the stories hand over an empty
 * object typed off the component's own props rather than reconstructing a
 * container the story does not mount.
 */
const TOAST_PROPS = {} as WarningProps['toastProps'];

const meta = {
  title: 'Widgets/Toast/Warning',
  component: Warning,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Body of the warning toast `toast.warn()` renders through react-toastify: an amber alert ' +
          'triangle, a `--text-primary` title and a `--text-tertiary` detail line, with the shared ' +
          'round close chip on the right. It is the "this went through, but read this" tier between ' +
          '`Success` and `ErrorToast`. The warm-glass surface around it comes from the ' +
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
      title: 'Low stock',
      text: 'Only 3 doses of Bravecto 500mg are left in the dispensary.',
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
} satisfies Meta<typeof Warning>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TitleOnly: Story = {
  name: 'Title only',
  args: {
    data: { title: 'Session expiring soon', text: '' },
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
      title: 'Some appointments could not be moved to the new room',
      text: 'Four of the eleven visits scheduled in Consult 2 overlap with a block already booked in the destination room, so they were left where they were.',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'The overflow case, and the one worth watching: neither the 34px triangle nor the close ' +
          'chip is `shrink-0`, so as the message grows the flex row takes the space back out of the ' +
          'icon rather than wrapping around it. Compare the glyph here with the one in `Default`.',
      },
    },
  },
};
