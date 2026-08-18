import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { Primary } from '@/app/ui/primitives/Buttons';
import { useConfirm } from './ConfirmModal';

/**
 * Confirmation for irreversible actions, replacing the browser's native
 * confirm(). Rendered through the hook exactly as call sites use it, so the
 * story exercises the real promise flow rather than a static shell.
 */
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
  const [result, setResult] = useState<string>('no answer yet');

  return (
    <div className="flex min-h-[320px] flex-col items-start gap-4 p-6">
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

/** The dialog portals to document.body, so it is never inside `canvasElement`. */
const openDialog = async (canvasElement: HTMLElement, title: string) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: title }));
  return within(document.body).findByRole('dialog', { name: title });
};

const meta = {
  title: 'Overlays/ConfirmModal',
  component: Demo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Promise-based confirmation. `confirm()` resolves true on the confirm action and false on ' +
          'cancel, Escape, backdrop click or the close control.\n\n' +
          'The dialog is `options ? <ConfirmModal .../> : null` behind a resolver held in a ref, so ' +
          'it does not exist until a promise is open - there is no `open` prop and no way to reach ' +
          'it from args. Every story here used to render only the closed trigger, which means the ' +
          'markup that actually confirms destructive actions across the product had never been drawn ' +
          'anywhere: not the header, not the body sentence, and not the danger footer.\n\n' +
          'What that hid is a footer whose confirm button is a **different component** per tone - ' +
          '`Delete` on `danger`, `Primary` otherwise - sitting beside a fixed `Secondary` cancel. ' +
          'The two share no classes: `Delete` paints `--danger-strong` with `--danger-strong-ink`, ' +
          '`Primary` paints `--cta`. That swap is the single most consequential pixel in the ' +
          'component, since it is the only thing distinguishing "Disconnect" from "Save", and it is ' +
          'reachable only after a click.\n\n' +
          'The stories assert the dialog carries its header, its sentence and both buttons, and they ' +
          'resolve the promise both ways - the resolved value is written into the page, so a dialog ' +
          'that renders but never settles is visible as a stuck "no answer yet".',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Close this chat session?',
    body: 'The client will no longer be able to send messages in this conversation.',
    confirmLabel: 'Close session',
  },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DangerousAction: Story = {
  name: 'Danger (disconnect IDEXX)',
  args: {
    tone: 'danger',
    title: 'Disconnect IDEXX?',
    body: 'Lab ordering and result syncing stop for this organization until IDEXX is enabled again.',
    confirmLabel: 'Disconnect',
  },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement, 'Disconnect IDEXX?');
    const panel = within(dialog);

    /* Assert the dialog has its content, not merely that it mounted - an empty
       panel satisfies the role just as well as a populated one. */
    await expect(panel.getByRole('heading', { name: 'Disconnect IDEXX?' })).toBeInTheDocument();
    await expect(
      panel.getByText(
        'Lab ordering and result syncing stop for this organization until IDEXX is enabled again.'
      )
    ).toBeInTheDocument();

    // Three controls: close, cancel, confirm - and the confirm carries the tone.
    await expect(panel.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    const confirm = panel.getByRole('button', { name: 'Disconnect' });
    const cancel = panel.getByRole('button', { name: 'Cancel' });
    /* `Delete` fills with --danger-strong while `Secondary` is a bordered
       transparent pill. If the tone branch were dropped the confirm would render
       as an ordinary Primary and still look deliberate, so compare the fills. */
    await expect(getComputedStyle(confirm).backgroundColor).not.toBe(
      getComputedStyle(cancel).backgroundColor
    );
    await expect(getComputedStyle(confirm).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The danger tone, which is what almost every call site uses. This is the only story that ' +
          'draws the `Delete` confirm button - a filled `--danger-strong` pill against the bordered ' +
          'Secondary cancel beside it.',
      },
    },
  },
};

export const DangerConfirmed: Story = {
  name: 'Danger, confirmed',
  args: {
    tone: 'danger',
    title: 'Delete this group?',
    body: 'The group and its messages are removed for everyone. This cannot be undone.',
    confirmLabel: 'Delete group',
  },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement, 'Delete this group?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete group' }));

    // The promise resolves true and the dialog unmounts with it.
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(canvas.getByTestId('confirm-result')).toHaveTextContent('Result: confirmed');
    });
    await expect(within(document.body).queryByRole('dialog')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full round trip a call site sees: `await confirm(...)` returns `true` and the dialog ' +
          'goes away in the same settle. Reachable only by driving the promise - no arg produces it.',
      },
    },
  },
};

export const CancelDeclines: Story = {
  name: 'Cancel declines',
  args: {
    tone: 'danger',
    title: 'Delete this group?',
    body: 'The group and its messages are removed for everyone. This cannot be undone.',
    confirmLabel: 'Delete group',
  },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement, 'Delete this group?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(canvas.getByTestId('confirm-result')).toHaveTextContent('Result: declined');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Cancel resolves `false` rather than leaving the promise open, so a caller that awaited it ' +
          'continues down its declined branch instead of hanging. A dialog that unmounts without ' +
          'settling looks identical on screen and is the failure this asserts against.',
      },
    },
  },
};

export const EscapeDeclines: Story = {
  name: 'Escape declines',
  args: {
    tone: 'danger',
    title: 'Delete this group?',
    body: 'The group and its messages are removed for everyone. This cannot be undone.',
    confirmLabel: 'Delete group',
  },
  play: async ({ canvasElement }) => {
    await openDialog(canvasElement, 'Delete this group?');
    await userEvent.keyboard('{Escape}');

    // Dismissal is a decline, matching what the native confirm() did.
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(canvas.getByTestId('confirm-result')).toHaveTextContent('Result: declined');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          "Escape settles the same promise as Cancel. It runs through `ModalBase`'s stack check, so " +
          'a confirm opened over another panel dismisses only itself - which is exactly the ' +
          'arrangement this component is used in, since it usually confirms an action started inside ' +
          'another modal.',
      },
    },
  },
};

export const NeutralAction: Story = {
  name: 'Default tone',
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement, 'Close this chat session?');
    const panel = within(dialog);
    await expect(
      panel.getByText('The client will no longer be able to send messages in this conversation.')
    ).toBeInTheDocument();
    // Same footer shape, `Primary` in place of `Delete`.
    await expect(panel.getByRole('button', { name: 'Close session' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The non-destructive tone, worth seeing beside the danger one: identical geometry, a ' +
          '`--cta` fill instead of `--danger-strong`, and the same bordered cancel. Any difference ' +
          'beyond the fill would be a bug.',
      },
    },
  },
};

export const LongBody: Story = {
  name: 'Long consequence sentence',
  args: {
    tone: 'danger',
    title: 'Remove this room from every future appointment?',
    body:
      'Every upcoming appointment currently assigned to this room loses its location, including ' +
      'recurring series that extend past the end of the year. Clients already sent a confirmation ' +
      'naming the room are not re-notified, and the change cannot be reversed from this screen.',
    confirmLabel: 'Remove room',
  },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(
      canvasElement,
      'Remove this room from every future appointment?'
    );
    await expect(within(dialog).getByRole('button', { name: 'Remove room' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dialog is a fixed 500px panel with no scroll of its own, so the title wraps and the ' +
          'body grows the panel downwards. This is the case that decides whether the footer stays ' +
          'reachable on a short viewport.',
      },
    },
  },
};
