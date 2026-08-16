import type { Meta, StoryObj } from '@storybook/react';
import { Icon } from '@/app/ui/icons/Icon';
import { ErrorTost, useErrorTost } from './Toast';

const meta = {
  title: 'Overlays/Toast/ErrorTost',
  component: ErrorTost,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Inline notification strip used by the auth and settings forms. `errortext` is the heading ' +
          'and `message` the detail line beneath it; the icon is passed in rather than chosen by the ' +
          'component, so the same strip carries success and info as well as errors despite the name. ' +
          'The dismiss control is a real `<button>` with an accessible label. Most callers reach for ' +
          '`useErrorTost()` instead of rendering this directly - see the last story.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    errortext: 'Could not save your changes',
    message: 'The email address is already in use by another account.',
    iconElement: <Icon icon="solar:danger-triangle-bold" width="22" height="22" aria-hidden />,
  },
  argTypes: {
    iconElement: { control: false },
    onClose: { action: 'dismissed' },
  },
} satisfies Meta<typeof ErrorTost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Error: Story = {};

export const HeadingOnly: Story = {
  name: 'Heading only',
  args: { message: undefined },
  parameters: {
    docs: {
      description: {
        story: '`message` is optional - the strip collapses to a single line without it.',
      },
    },
  },
};

export const LongMessage: Story = {
  name: 'Long message',
  args: {
    errortext: 'Verification link expired',
    message:
      'Links are valid for 30 minutes. Request a new one and it will arrive at the same address; ' +
      'check the spam folder if it does not appear within a couple of minutes.',
  },
  parameters: {
    docs: {
      description: {
        story: 'Wrapping case - the dismiss button must stay pinned and must not shrink.',
      },
    },
  },
};

const HookDemo = () => {
  const { showErrorTost, ErrorTostPopup } = useErrorTost();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
      <button
        type="button"
        className="yc-switch"
        style={{
          alignSelf: 'flex-start',
          padding: '9px 16px',
          borderRadius: 9999,
          border: '1px solid var(--hairline)',
          background: 'var(--glass-92)',
          color: 'var(--ink-body)',
          cursor: 'pointer',
        }}
        onClick={() =>
          showErrorTost({
            errortext: 'Could not save your changes',
            message: 'The email address is already in use by another account.',
            iconElement: (
              <Icon icon="solar:danger-triangle-bold" width="22" height="22" aria-hidden />
            ),
          })
        }
      >
        Trigger the toast
      </button>
      {ErrorTostPopup}
    </div>
  );
};

export const ViaHook: Story = {
  name: 'Via useErrorTost()',
  render: () => <HookDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'The hook owns the visible state and clears it after `duration` (5s by default), returning ' +
          '`ErrorTostPopup` for the caller to place. Note it dismisses on a timer, so anything the ' +
          'reader must act on does not belong here.',
      },
    },
  },
};
