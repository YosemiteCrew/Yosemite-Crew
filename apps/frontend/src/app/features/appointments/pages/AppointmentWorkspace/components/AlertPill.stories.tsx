import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import AlertPill from './AlertPill';

const meta = {
  title: 'Appointments/AlertPill',
  component: AlertPill,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A patient’s standing alert - "Needs muzzle", "Barking" - shown on every tab of the ' +
          'patient page and in the appointment workspace. The colour comes entirely from the ' +
          'persisted severity, so the four variants below are the whole surface. Passing both `id` ' +
          'and `onRemove` adds the dismiss control; without them the pill is read-only.\n\n' +
          'The `medium` and `high` tints previously took their text from the **700** ramp steps, ' +
          'which are mid-ramp fills rather than inks: on their own 100 tint they measured 2.77:1 ' +
          'and 4.23:1, so every alert on the patient page sat under AA. They now use the 900 and ' +
          '800 steps (6.42:1 and 6.23:1) with the tint and border unchanged, which is why the ' +
          'pills look the same weight but read cleanly. This story is the guard against that ' +
          'regressing - all four severities render together so a diff is obvious.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: 'Needs muzzle',
    severity: 'medium',
  },
  argTypes: {
    severity: {
      control: 'select',
      options: ['low', 'medium', 'high', 'critical'],
    },
    onRemove: { action: 'removed' },
  },
} satisfies Meta<typeof AlertPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};

export const Low: Story = {
  args: { label: 'Prefers quiet room', severity: 'low' },
};

export const High: Story = {
  args: { label: 'Barking', severity: 'high' },
};

export const Critical: Story = {
  args: { label: 'Bite risk', severity: 'critical' },
  parameters: {
    docs: {
      description: {
        story:
          'The only severity that inverts - near-black fill with `--color-neutral-0` text, so it ' +
          'reads as a warning rather than a tint.',
      },
    },
  },
};

export const Removable: Story = {
  args: { id: 'alert-1', label: 'Needs muzzle', severity: 'medium', onRemove: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'With `id` and `onRemove` the dismiss control appears, labelled "Remove alert &lt;label&gt;" ' +
          'rather than a bare ×.',
      },
    },
  },
};

export const EverySeverity: Story = {
  name: 'Every severity',
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 460 }}>
      <AlertPill label="Prefers quiet room" severity="low" />
      <AlertPill label="Needs muzzle" severity="medium" />
      <AlertPill label="Barking" severity="high" />
      <AlertPill label="Bite risk" severity="critical" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The four together, which is how they actually appear on a patient with several alerts - ' +
          'and the view that makes a contrast regression in any one of them visible.',
      },
    },
  },
};
