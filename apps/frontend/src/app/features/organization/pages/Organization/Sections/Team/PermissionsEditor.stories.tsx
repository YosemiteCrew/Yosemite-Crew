import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PermissionsEditor from './PermissionsEditor';
import { ROLE_PERMISSIONS } from '@/app/lib/permissions';

/** Opens the accordion, which is the only way the matrix reaches the DOM. */
const openMatrix = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Permissions' }));
  return canvas;
};

const meta = {
  title: 'Organization/PermissionsEditor',
  component: PermissionsEditor,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The per-membership permission matrix on the Team screen: eighteen rows, a View and an ' +
          'Edit checkbox each, a reset link and a Cancel/Save bar.\n\n' +
          'All of it lives inside an `Accordion` with `defaultOpen={false}`, and that accordion ' +
          '**unmounts its children when closed** rather than hiding them - `{open && hasChildren && ' +
          '(...)}`. Without a click nothing below the header exists in the DOM at all, so the entire ' +
          'matrix, every checkbox state and the whole save bar had never been rendered in Storybook. ' +
          'The header is not a disclosure over static markup; it is the mount.\n\n' +
          'What that hid is a table with four distinct row treatments that no two of which appear ' +
          'together by default. Audit Logs has no `edit` group, so its Edit cell is an em dash and ' +
          'not an unchecked box - 18 View boxes against 17 Edit boxes. For an OWNER the Teams and ' +
          'Organization rows are `ownerLocked`: both boxes are forced checked, disabled, and ' +
          'carry the title "An owner keeps this permission", because those two rows gate the screens ' +
          'an owner would use to undo the change. Everything else is a live toggle, and turning View ' +
          'off cascades Edit off with it.\n\n' +
          'The Cancel/Save bar is gated twice over - `!readOnly && isDirty` - so it only exists after ' +
          'a toggle, and the "Saving..." relabel exists only while `onSave` is in flight. The stories ' +
          'drive both by toggling a real checkbox and by handing `onSave` a promise that never ' +
          'settles, which is the only way to reach them.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    role: 'VETERINARIAN',
    value: ROLE_PERMISSIONS.VETERINARIAN,
    onSave: fn(),
  },
} satisfies Meta<typeof PermissionsEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  name: 'Collapsed (children unmounted)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Permissions' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    // Not hidden - absent. This is what every earlier snapshot of this file contained.
    await expect(canvas.queryAllByRole('checkbox')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story: 'How the row sits on the Team screen until someone opens it.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Matrix open',
  play: async ({ canvasElement }) => {
    const canvas = await openMatrix(canvasElement);

    /* Assert the matrix has its rows, not merely that aria-expanded flipped -
       an empty accordion body satisfies the attribute just as well. */
    const boxes = await canvas.findAllByRole('checkbox');
    await expect(boxes).toHaveLength(35);

    await expect(canvas.getByText('Permission')).toBeInTheDocument();
    await expect(canvas.getByText('View')).toBeInTheDocument();
    await expect(canvas.getByText('Edit')).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Reset to role defaults' })
    ).toBeInTheDocument();

    // Audit Logs has no `edit` group, so it contributes a View box and an em dash.
    await expect(canvas.getByLabelText('Audit Logs view permission')).toBeInTheDocument();
    await expect(canvas.queryByLabelText('Audit Logs edit permission')).toBeNull();
    await expect(canvas.getByText('—')).toBeInTheDocument();

    // The baseline is reflected, not assumed: a vet holds inventory view and edit.
    await expect(canvas.getByLabelText('Inventory view permission')).toBeChecked();
    await expect(canvas.getByLabelText('Inventory edit permission')).toBeChecked();
    // ...and holds Teams view without Teams edit.
    await expect(canvas.getByLabelText('Teams view permission')).toBeChecked();
    await expect(canvas.getByLabelText('Teams edit permission')).not.toBeChecked();

    // Clean state: no save bar yet.
    await expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole matrix for a veterinarian. Eighteen rows on a shared `yc-table-head`, two 72px ' +
          'centred columns, and a hairline under every row but the last.',
      },
    },
  },
};

export const ViewOffCascadesEdit: Story = {
  name: 'Turning View off clears Edit',
  play: async ({ canvasElement }) => {
    const canvas = await openMatrix(canvasElement);
    const view = await canvas.findByLabelText('Inventory view permission');
    const edit = canvas.getByLabelText('Inventory edit permission');
    await expect(view).toBeChecked();
    await expect(edit).toBeChecked();

    await userEvent.click(view);

    // `applyToggle` removes the edit candidates alongside the view ones.
    await expect(view).not.toBeChecked();
    await expect(edit).not.toBeChecked();
    // The bar is gated on `isDirty`, so it only exists now.
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An edit right without the matching view right is not a state the app can render, so ' +
          'clearing View takes Edit with it. Two checkboxes move from one click, which is only ' +
          'visible with the matrix mounted.',
      },
    },
  },
};

export const EditOnEnablesView: Story = {
  name: 'Turning Edit on adds View',
  play: async ({ canvasElement }) => {
    const canvas = await openMatrix(canvasElement);
    const view = await canvas.findByLabelText('Documents view permission');
    const edit = canvas.getByLabelText('Documents edit permission');
    await expect(view).toBeChecked();
    await expect(edit).not.toBeChecked();

    // Clear both, then switch Edit on alone - View must come back with it.
    await userEvent.click(view);
    await expect(edit).not.toBeChecked();
    await userEvent.click(edit);

    await expect(edit).toBeChecked();
    await expect(view).toBeChecked();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The mirror rule: `withViewEnabled` puts the view tier back whenever an edit tier is ' +
          'switched on, so the pair can never end up half-granted. Reachable only by clicking two ' +
          'boxes in order, which is why it needed a `play` rather than an arg.',
      },
    },
  },
};

export const DirtyBar: Story = {
  name: 'Cancel restores the baseline',
  play: async ({ canvasElement }) => {
    const canvas = await openMatrix(canvasElement);
    const labs = await canvas.findByLabelText('Labs edit permission');
    await expect(labs).toBeChecked();

    await userEvent.click(labs);
    await expect(labs).not.toBeChecked();

    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));

    await expect(labs).toBeChecked();
    // Back in step with `value`, so the bar disappears again.
    await expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Cancel resets the draft to the incoming `value` rather than to the role baseline - the ' +
          'reset link beside the header is the one that does the latter. Both live on this surface ' +
          'and mean different things, which is only apparent with both drawn.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Saving (pending)',
  args: {
    // Never resolves, so the pending relabel stays on screen for review.
    onSave: fn(() => new Promise<void>(() => {})),
  },
  play: async ({ canvasElement }) => {
    const canvas = await openMatrix(canvasElement);
    await userEvent.click(await canvas.findByLabelText('Forms edit permission'));
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    const saving = await canvas.findByRole('button', { name: 'Saving...' });
    await expect(saving).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both actions disable and Save relabels while the promise is open. There is no prop for ' +
          'this - it exists only between a click and a resolution.',
      },
    },
  },
};

export const OwnerLockedRows: Story = {
  name: 'Owner (Teams and Organization locked)',
  args: { role: 'OWNER', value: ROLE_PERMISSIONS.OWNER },
  play: async ({ canvasElement }) => {
    const canvas = await openMatrix(canvasElement);
    const teamsView = await canvas.findByLabelText('Teams view permission');

    // Forced on and inert, with the reason in a title attribute.
    await expect(teamsView).toBeChecked();
    await expect(teamsView).toBeDisabled();
    await expect(teamsView).toHaveAttribute('title', 'An owner keeps this permission');
    await expect(canvas.getByLabelText('Teams edit permission')).toBeDisabled();
    await expect(canvas.getByLabelText('Organization view permission')).toBeDisabled();
    await expect(canvas.getByLabelText('Organization edit permission')).toBeDisabled();

    // Every other row is still a live toggle, so the lock has to read as local.
    await expect(canvas.getByLabelText('Labs edit permission')).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The two rows an owner cannot revoke, because Teams and Organization are the screens they ' +
          'would use to reverse the change. The lock is a disabled checked box plus a title, with no ' +
          'visual difference from an ordinary checked box - which is exactly the kind of thing worth ' +
          'looking at rather than asserting alone.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only',
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = await openMatrix(canvasElement);
    const boxes = await canvas.findAllByRole('checkbox');
    await expect(boxes).toHaveLength(35);
    await expect(boxes.every((box) => box.hasAttribute('disabled'))).toBe(true);
    // The reset link and the save bar are removed rather than dimmed.
    await expect(canvas.queryByRole('button', { name: 'Reset to role defaults' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a member without Teams edit sees. The matrix still renders in full - it is the ' +
          'record of what the role holds - but every control is inert and the two write affordances ' +
          'are gone entirely.',
      },
    },
  },
};
