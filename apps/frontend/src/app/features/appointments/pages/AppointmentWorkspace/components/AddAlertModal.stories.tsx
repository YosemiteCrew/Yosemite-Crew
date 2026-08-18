import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import AddAlertModal from './AddAlertModal';

const COMPANION_LABEL = 'Alert (e.g. Needs muzzle, Diabetic)';
const CLIENT_LABEL = 'Alert (e.g. Call before visit, Billing follow-up)';

/** The dialog portals to `document.body`, so nothing here is inside `canvasElement`. */
const body = () => within(document.body);

const meta = {
  title: 'Workspace/AddAlertModal',
  component: AddAlertModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The centred dialog for adding a companion or client alert from the appointment ' +
          'workspace: a label field, a severity select, and a live preview of the pill that will ' +
          'be written.\n\n' +
          'Two things here had never been drawn. The dialog itself portals to `document.body` ' +
          'through `CenterModal`, so it is outside the story canvas entirely - and the **Preview ' +
          'row is gated on `label.trim()`**, a piece of local form state with no prop behind it. ' +
          'It cannot be reached by rendering the component at all; only by typing. So the ' +
          'AlertPill that this dialog exists to configure was the one part of it no snapshot ' +
          'contained.\n\n' +
          'That row is worth seeing because it appears *between* the severity select and the ' +
          'Cancel/Add action row, inside the same `flex flex-col gap-4` column - so the moment a ' +
          'first character is typed, both buttons shift down by the row height plus a 16px gap. ' +
          'A dialog reviewed only in its empty state never shows that jump.\n\n' +
          'Severity is the pill: `low` is a neutral tint, `medium` and `high` use the 900 and 800 ' +
          'text steps on their 100 tints (the mid-ramp 700s read 2.77 and 4.23 against those ' +
          'tints and failed AA), and `critical` is the only inverted one - `--color-neutral-900` ' +
          'ground with `--color-neutral-0` text. The preview is the only place in the product ' +
          'where a reader picks between them, so it is the only place the four can be compared.\n\n' +
          'The `subject` prop swaps every string - title, body, field label and submit label - ' +
          'but not the choices: `SEVERITY_OPTIONS` and `CLIENT_ALERT_OPTIONS` are today the same ' +
          'four values. The form is remounted on a `key` tied to `open`, so each opening starts ' +
          'blank rather than being reset by an effect (which used to leave a stale frame on ' +
          'close).\n\n' +
          'The stories assert the Preview row has the typed label and the chosen severity, not ' +
          'merely that it mounted - an empty preview row is still a row.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    open: true,
    companionName: 'Poppy Whitfield',
    onClose: fn(),
    onAdd: fn(),
  },
} satisfies Meta<typeof AddAlertModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Open, nothing typed',
  play: async () => {
    const panel = body();
    await expect(panel.getByRole('heading', { name: 'Add alert' })).toBeInTheDocument();
    await expect(panel.getByRole('textbox', { name: COMPANION_LABEL })).toHaveValue('');
    // No preview until there is something to preview, and the submit is inert
    // rather than merely dimmed.
    await expect(panel.queryByText('Preview')).not.toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Add alert' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the dialog opens in. The action row sits directly under the severity select ' +
          'here - compare its position with the next story, where the preview row pushes it down.',
      },
    },
  },
};

export const WithPreview: Story = {
  name: 'Preview row (typed)',
  play: async () => {
    const panel = body();
    await userEvent.type(panel.getByRole('textbox', { name: COMPANION_LABEL }), 'Needs muzzle');
    // The row, its caption, and the pill it exists to show - an assertion on the
    // row alone would pass on an empty pill.
    await expect(panel.getByText('Preview')).toBeInTheDocument();
    await expect(panel.getByText('Needs muzzle')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Add alert' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface: caption plus a `low`-severity AlertPill, in a `flex items-center ' +
          'gap-2` row that did not exist a keystroke earlier. The pill is `min-h-5`, so the whole ' +
          'action row below it moves 36px down (20px row + 16px gap) the moment it appears.',
      },
    },
  },
};

export const CriticalPreview: Story = {
  name: 'Preview after changing severity',
  play: async () => {
    const panel = body();
    await userEvent.type(
      panel.getByRole('textbox', { name: COMPANION_LABEL }),
      'Aggressive on lead'
    );
    // The select portals a second panel out of the dialog; the modal deliberately
    // exempts `[data-portal-dropdown]` from its outside-click dismissal.
    await userEvent.click(panel.getByRole('button', { name: 'Severity: Low' }));
    const listbox = document.querySelector('[data-portal-dropdown]');
    await expect(listbox).toBeInTheDocument();
    await expect((listbox as HTMLElement).querySelectorAll('button')).toHaveLength(4);
    await userEvent.click(within(listbox as HTMLElement).getByRole('button', { name: 'Critical' }));

    await expect(panel.getByRole('button', { name: 'Severity: Critical' })).toBeInTheDocument();
    await expect(panel.getByText('Aggressive on lead')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two gated surfaces composited: the severity listbox open over the dialog, then the ' +
          'preview repainted in the `critical` tone. Critical is the only inverted pill - white ' +
          'text on `--color-neutral-900` - so it is also the only one whose contrast is decided ' +
          'by the ground rather than by the tint.',
      },
    },
  },
};

export const SubmitsTheAlert: Story = {
  name: 'Submitting writes label and severity',
  play: async ({ args }) => {
    const panel = body();
    await userEvent.type(panel.getByRole('textbox', { name: COMPANION_LABEL }), '  Diabetic  ');
    await userEvent.click(panel.getByRole('button', { name: 'Add alert' }));
    // The trimmed label is what is persisted, not the raw field value.
    await expect(args.onAdd).toHaveBeenCalledWith({ label: 'Diabetic', severity: 'low' });
    await expect(args.onClose).toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The round trip. Whitespace is trimmed for both the enabled/disabled decision and the ' +
          'written value, so a label of spaces can never be submitted and " Diabetic " and ' +
          '"Diabetic" cannot become two different alerts.',
      },
    },
  },
};

export const ClientSubject: Story = {
  name: 'Client alert (subject swap)',
  args: { subject: 'client', companionName: 'Maya Whitfield' },
  play: async () => {
    const panel = body();
    await expect(panel.getByRole('heading', { name: 'Add client alert' })).toBeInTheDocument();
    await expect(panel.getByText('Add a client alert for Maya Whitfield.')).toBeInTheDocument();
    await userEvent.type(panel.getByRole('textbox', { name: CLIENT_LABEL }), 'Billing follow-up');
    await expect(panel.getByText('Preview')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Add client alert' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every string changes with `subject`, including the example text inside the field ' +
          'label, and the client copy uses the full name where the companion copy takes only the ' +
          'first word of it. The severity choices are identical - the two option constants hold ' +
          'the same four values - so this is a copy variant, not a behaviour one.',
      },
    },
  },
};

export const Closed: Story = {
  name: 'Closed (shell still mounted)',
  args: { open: false },
  play: async () => {
    // CenterModal keeps the dialog mounted and hides it, so the story canvas is
    // empty while a <dialog> still exists on <body>. It must be inert, or the
    // form behind it stays tabbable.
    const dialog = document.querySelector('dialog');
    await expect(dialog).toBeInTheDocument();
    await expect(dialog).toHaveAttribute('inert');
  },
  parameters: {
    docs: {
      description: {
        story:
          'What "closed" actually means here: not unmounted, but a `<dialog>` without `open`, ' +
          'carrying `inert` and `pointer-events-none` behind a faded backdrop. Worth stating ' +
          'because the form state is thrown away by remounting on a key rather than by ' +
          'unmounting the dialog.',
      },
    },
  },
};
