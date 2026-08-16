import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Primary } from '@/app/ui/primitives/Buttons';
import { useConfirm } from './ConfirmModal';

/**
 * Confirmation for irreversible actions, replacing the browser's native
 * confirm(). Rendered through the hook exactly as call sites use it, so the
 * story exercises the real promise flow rather than a static shell.
 */
const meta: Meta = {
  title: 'Overlays/ConfirmModal',
  parameters: {
    docs: {
      description: {
        component:
          'Promise-based confirmation. `confirm()` resolves true on the confirm action and false on cancel, Escape, backdrop click or the close control.',
      },
    },
  },
};
export default meta;

const Demo = ({
  tone,
  title,
  body,
  confirmLabel,
}: {
  tone?: 'default' | 'danger';
  title: string;
  body: string;
  confirmLabel: string;
}) => {
  const { confirm, confirmDialog } = useConfirm();
  const [result, setResult] = React.useState<string>('no answer yet');

  return (
    <div className="flex flex-col items-start gap-4 p-6">
      {confirmDialog}
      <span data-testid="open-confirm-wrap">
        <Primary
          text={title}
          onClick={async () => {
            const ok = await confirm({ title, body, confirmLabel, tone });
            setResult(ok ? 'confirmed' : 'declined');
          }}
        />
      </span>
      <span data-testid="confirm-result" className="text-body-4 text-[var(--ink-muted)]">
        Result: {result}
      </span>
    </div>
  );
};

type Story = StoryObj<typeof Demo>;

export const DangerousAction: Story = {
  name: 'Danger (disconnect IDEXX)',
  render: () => (
    <Demo
      tone="danger"
      title="Disconnect IDEXX?"
      body="Lab ordering and result syncing stop for this organization until IDEXX is enabled again."
      confirmLabel="Disconnect"
    />
  ),
};

export const DeleteGroup: Story = {
  name: 'Danger (delete group)',
  render: () => (
    <Demo
      tone="danger"
      title="Delete this group?"
      body="The group and its messages are removed for everyone. This cannot be undone."
      confirmLabel="Delete group"
    />
  ),
};

export const NeutralAction: Story = {
  name: 'Default tone',
  render: () => (
    <Demo
      title="Close this chat session?"
      body="The client will no longer be able to send messages in this conversation."
      confirmLabel="Close session"
    />
  ),
};
