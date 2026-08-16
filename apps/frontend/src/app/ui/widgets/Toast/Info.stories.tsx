import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import 'react-toastify/dist/ReactToastify.css';
import Info from './Info';

type InfoProps = ComponentProps<typeof Info>;

/**
 * `toastProps` is react-toastify's own runtime bag (position, transition,
 * progress state). `Info` never reads it, so the stories hand over an empty
 * object typed off the component's own props rather than reconstructing a
 * container the story does not mount.
 */
const TOAST_PROPS = {} as InfoProps['toastProps'];

const meta = {
  title: 'Widgets/Toast/Info',
  component: Info,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Body of the informational toast, rendered by `useNotify().notify("info", ...)` through ' +
          "react-toastify's `toast.info`. Same two-line anatomy as the success and error toasts — a " +
          '`--text-primary` title over a `--text-tertiary` detail line, with the shared round close ' +
          'chip on the right — but led by a blue circled "i" for messages that report state rather ' +
          'than an outcome. The warm-glass surface around it comes from the `.Toastify__toast` ' +
          'override in `globals.css`, which the decorator reproduces so the stories show the toast at ' +
          'its real width.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    isPaused: false,
    toastProps: TOAST_PROPS,
    closeToast: fn(),
    data: {
      title: 'Reminder scheduled',
      text: 'The pet parent gets a nudge 24 hours before the visit.',
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
} satisfies Meta<typeof Info>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TitleOnly: Story = {
  name: 'Title only',
  args: {
    data: { title: 'Sync in progress', text: '' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Callers with nothing to add pass an empty `text`. The second line collapses to zero height ' +
          'and the row re-centres on the title rather than leaving a gap under it.',
      },
    },
  },
};

export const LongMessage: Story = {
  name: 'Long message (wraps)',
  args: {
    data: {
      title: 'IDEXX results are still being processed by the lab',
      text: 'Nothing is lost — the order stays open and the panel appears on the visit as soon as the analyser reports back, usually within the hour.',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'The overflow case, and the one worth watching: neither the 34px info glyph nor the close ' +
          'chip is `shrink-0`, so as the message grows the flex row takes the space back out of the ' +
          'icon rather than wrapping around it. Compare the glyph here with the one in `Default`.',
      },
    },
  },
};
