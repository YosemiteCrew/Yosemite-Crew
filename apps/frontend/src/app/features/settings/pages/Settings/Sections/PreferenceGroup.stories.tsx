import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import PillSelect, { type PillSelectOption } from './PillSelect';
import { PreferenceGroup, PreferenceRow, type PreferenceScope } from './PreferenceGroup';

const VIEW_OPTIONS: ReadonlyArray<PillSelectOption> = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'board', label: 'Status board' },
  { value: 'list', label: 'Table' },
];

const LOCK_OPTIONS: ReadonlyArray<PillSelectOption> = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
];

/** A live row: the pill is controlled, so it needs somewhere to keep its value. */
const ViewRow = () => {
  const [value, setValue] = useState('board');
  return (
    <PreferenceRow label="Default appointment view" description="The screen Appointments opens on">
      <PillSelect
        ariaLabel="Default appointment view"
        value={value}
        options={VIEW_OPTIONS}
        onChange={setValue}
      />
    </PreferenceRow>
  );
};

const LockRow = () => {
  const [value, setValue] = useState('30');
  return (
    <PreferenceRow
      label="Appointment lock window"
      description="How long before a visit its slot stops accepting changes"
    >
      <PillSelect
        ariaLabel="Appointment lock window"
        value={value}
        options={LOCK_OPTIONS}
        onChange={setValue}
      />
    </PreferenceRow>
  );
};

type GroupProps = {
  title: string;
  scope?: PreferenceScope;
  readOnly?: boolean;
};

/** The card the rows ship in, over the page surface so the two-layer shadow has something to sit on. */
const Group = ({ title, scope, readOnly }: GroupProps) => (
  <div className="w-[420px] max-w-full bg-[var(--page)] p-4">
    <PreferenceGroup title={title} scope={scope} readOnly={readOnly}>
      <ViewRow />
      <LockRow />
    </PreferenceGroup>
  </div>
);

const meta = {
  title: 'Settings/PreferenceGroup',
  component: Group,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The grouped-preferences card from the Settings design, plus the `PreferenceRow` ' +
          'idiom that fills it: a `--screen` surface with a hairline border and the soft ' +
          'two-layer shadow, a bold group title, and one or more label / control rows.\n\n' +
          'The scope chip is not decoration. Settings mixes per-user preferences with ' +
          'controls that change behaviour for every colleague at the clinic, and the two used ' +
          'to sit in undifferentiated cards - so an owner could change the whole clinic ' +
          'believing it was their own preference. A group declares who it affects and says so ' +
          'twice: a chip on the title row and a faint hint under it. `personal` and `device` ' +
          'are kept apart on purpose, because the theme lives in an un-namespaced ' +
          '`localStorage` key and does not follow the account; calling that "your account" ' +
          'would be a promise the storage does not keep.\n\n' +
          '`readOnly` belongs on the group rather than the surrounding band, because the ' +
          'organisation band mixes controls behind different permissions and a Supervisor can ' +
          'edit one group and not the next. The chip is deliberately not a StatusPill: it ' +
          'labels audience, not state.',
      },
    },
  },
  tags: ['autodocs'],
  args: { title: 'Appointments', scope: 'personal' },
} satisfies Meta<typeof Group>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Personal: Story = {
  name: 'Only you',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 3, name: 'Appointments' })).toBeVisible();
    await expect(canvas.getByText('Only you')).toBeVisible();
    await expect(canvas.getByText('These apply to your account on this clinic.')).toBeVisible();
    // Two rows, each a label block beside a live control.
    await expect(canvas.getByText('Default appointment view')).toBeVisible();
    await expect(canvas.getByText('The screen Appointments opens on')).toBeVisible();
    await expect(canvas.getByRole('combobox', { name: 'Appointment lock window' })).toHaveValue(
      '30'
    );
  },
};

export const Device: Story = {
  name: 'This device',
  args: { title: 'This browser', scope: 'device' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This device')).toBeVisible();
    await expect(canvas.getByText('Saved in this browser, not on your account.')).toBeVisible();
  },
};

export const Organisation: Story = {
  name: 'Whole clinic',
  args: { title: 'Scheduling', scope: 'organisation' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByText('Whole clinic');
    await expect(chip).toBeVisible();
    await expect(
      canvas.getByText('These apply to everyone at this clinic, not just you.')
    ).toBeVisible();
    /* The organisation chip is the only one painted in the brand ink - it is
       the warning. Measured against a personal chip in the sibling story by
       token rather than pixel: the border takes `--blue`, the label `--blue-text`. */
    const probe = document.createElement('span');
    probe.style.display = 'none';
    probe.style.color = 'var(--blue-text)';
    document.body.append(probe);
    const brandInk = getComputedStyle(probe).color;
    probe.remove();
    await expect(getComputedStyle(chip).color).toBe(brandInk);
  },
};

export const OrganisationReadOnly: Story = {
  name: 'Whole clinic, managed by an administrator',
  args: { title: 'Scheduling', scope: 'organisation', readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        'These apply to everyone at this clinic, not just you. Managed by a clinic administrator.'
      )
    ).toBeVisible();
    await expect(canvas.getByText('Whole clinic')).toBeVisible();
  },
};

export const Unscoped: Story = {
  name: 'No scope declared',
  args: { title: 'Notifications', scope: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 3, name: 'Notifications' })).toBeVisible();
    // No chip and no hint line: the title row is the title alone.
    for (const label of ['Only you', 'This device', 'Whole clinic']) {
      await expect(canvas.queryByText(label)).not.toBeInTheDocument();
    }
    await expect(canvas.queryByText(/These apply to/)).not.toBeInTheDocument();
  },
};

export const RowInteraction: Story = {
  name: 'Choosing an option in a row',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox', { name: 'Default appointment view' });
    await userEvent.selectOptions(select, 'list');
    await expect(select).toHaveValue('list');
    // The row keeps its label block on the left and the control on the right.
    const label = canvas.getByText('Default appointment view');
    await expect(select.getBoundingClientRect().left).toBeGreaterThan(
      label.getBoundingClientRect().right
    );
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { title: 'Scheduling', scope: 'organisation' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The chip is `flex-none whitespace-nowrap`: it keeps its width and the title gives way.
    await expect(canvas.getByText('Whole clinic')).toBeVisible();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};

export const Dark: Story = {
  name: 'Dark',
  globals: { theme: 'dark' },
  args: { title: 'Scheduling', scope: 'organisation' },
  play: async ({ canvasElement }) => {
    await expect(document.documentElement.dataset.theme).toBe('dark');
    await expect(within(canvasElement).getByText('Whole clinic')).toBeVisible();
  },
};
