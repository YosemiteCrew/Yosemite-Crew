import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import CreateKeyForm from './CreateKeyForm';
import './DeveloperApiKeys.css';

/**
 * The form owns its own fields, so every branch worth checking is reached by
 * typing rather than by props: the disable rule, the trim on the name and the
 * comma parser that turns the scopes box into an array.
 *
 * The `DevApiKeys-*` classes live in `DeveloperApiKeys.css`, which only the page
 * imports - without the import here the form renders as bare markup and the
 * stories quietly stop showing what ships.
 */
const meta = {
  title: 'Developers/CreateKeyForm',
  component: CreateKeyForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The create half of the API keys page. Two things are load-bearing and invisible from ' +
          'the outside: **Create is disabled until the name has non-whitespace content and ' +
          're-disabled while a create is in flight**, and **the scopes box is free text that is ' +
          'split on commas, trimmed, and dropped entirely when nothing survives** - so a trailing ' +
          'comma does not send an empty scope.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    creating: false,
    onCreate: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof CreateKeyForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Nothing typed yet',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const create = canvas.getByRole('button', { name: 'Create' });
    await expect(create).toBeDisabled();

    /* Whitespace is not a name. The guard is `!name.trim()`, so a form gated on
       `name.length` instead would happily issue a key called "   ". */
    await userEvent.type(canvas.getByLabelText('Key name'), '   ');
    await expect(create).toBeDisabled();

    // The disabled pill also carries `pointer-events-none`, hence the override.
    await userEvent.click(create, { pointerEventsCheck: 0 });
    await expect(args.onCreate).not.toHaveBeenCalled();

    /* Cancel sits immediately beside Create inside the same <form>. It is a
       plain button, not a second submit - if it ever became `type="submit"`,
       backing out would create the key instead. */
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(args.onCreate).not.toHaveBeenCalled();
  },
};

export const Named: Story = {
  name: 'A name enables Create',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Key name'), '  Production server  ');

    const create = canvas.getByRole('button', { name: 'Create' });
    await expect(create).toBeEnabled();
    await userEvent.click(create);

    /* The name is trimmed on the way out, and `scopes` is left undefined rather
       than sent as an empty array - the payload carries no `scopes` key at all
       when the box is blank. */
    await expect(args.onCreate).toHaveBeenCalledWith({
      name: 'Production server',
      environment: 'live',
      scopes: undefined,
    });
  },
};

export const TestEnvironment: Story = {
  name: 'Switching to the test environment',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const environment = canvas.getByLabelText('Environment');

    // The select opens on Live, so a key is production unless someone changes it.
    await expect(environment).toHaveValue('live');

    await userEvent.type(canvas.getByLabelText('Key name'), 'CI runner');
    await userEvent.selectOptions(environment, 'test');
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));

    /* The submitted value is the enum, not the "Test" label shown in the
       option - the two are different strings and only one is valid. */
    await expect(args.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'test' })
    );
  },
};

export const Scopes: Story = {
  name: 'Scopes are split, trimmed and de-blanked',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Key name'), 'Reporting job');
    await userEvent.type(
      canvas.getByLabelText('Scopes (optional, comma-separated)'),
      ' appointments:read ,  inventory:read, '
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));

    /* The trailing comma and the padding are the point. A plain
       `split(',').map(trim)` would send a third, empty scope, which the caller
       has no way to tell from one the developer meant. */
    await expect(args.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ scopes: ['appointments:read', 'inventory:read'] })
    );
  },
};

export const Creating: Story = {
  name: 'While the create is in flight',
  args: { creating: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Key name'), 'CI runner');

    /* A filled name is not enough while a request is out. This is the half of
       the disable rule that stops a double submit issuing two live keys, and it
       is only reachable with `creating` held true. */
    const create = canvas.getByRole('button', { name: 'Creating…' });
    await expect(create).toBeDisabled();
    await userEvent.click(create, { pointerEventsCheck: 0 });
    await expect(args.onCreate).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The label swaps to "Creating…" and the button locks. The fields stay editable on ' +
          'purpose: a failed create leaves this form mounted, and the typed values are what the ' +
          'developer retries with.',
      },
    },
  },
};
