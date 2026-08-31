import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import SubLabels from './SubLabels';

const SECTIONS = [
  { key: 'signalment', name: 'Signalment' },
  { key: 'history', name: 'History' },
  { key: 'examination', name: 'Examination' },
  { key: 'plan', name: 'Plan' },
];

const meta = {
  title: 'Widgets/SubLabels',
  component: SubLabels,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The inset pill row used to move between the sections of a long form. It is a real ' +
          '`tablist`, so the selected pill is announced through `aria-selected` rather than by ' +
          'colour alone, and a section can carry a completion or error marker - which is what ' +
          'makes it navigation AND a progress summary in one row. A pill can also carry a link ' +
          'out to the page that owns its data, embedded in the pill rather than beside it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    labels: SECTIONS,
    activeLabel: 'signalment',
    setActiveLabel: fn(),
  },
} satisfies Meta<typeof SubLabels>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Four sections',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');
    await expect(tabs).toHaveLength(4);
    // Exactly one selected, and the selection is in the accessibility tree rather
    // than only in the pill's background colour.
    await expect(tabs.filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  },
};

export const Statuses: Story = {
  name: 'Complete and errored sections',
  args: {
    activeLabel: 'examination',
    statuses: { signalment: 'valid', history: 'valid', plan: 'error' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The markers are labelled images, not bare glyphs: "this section has errors"
       has to reach a screen reader, since the red icon alone carries it for
       nobody who cannot see it. */
    await expect(canvas.getAllByLabelText('Section complete')).toHaveLength(2);
    await expect(canvas.getByLabelText('Section has errors')).toBeInTheDocument();
  },
};

/** Holds the selection the way a form page does, so a click really moves it. */
const ControlledSubLabels = (args: React.ComponentProps<typeof SubLabels>) => {
  const [active, setActive] = useState(args.activeLabel);
  return (
    <SubLabels
      {...args}
      activeLabel={active}
      setActiveLabel={(key: string) => {
        setActive(key);
        args.setActiveLabel?.(key);
      }}
    />
  );
};

export const Selecting: Story = {
  name: 'Choosing a section',
  render: (args) => <ControlledSubLabels {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Plan' }));
    await expect(args.setActiveLabel).toHaveBeenCalledWith('plan');
    await expect(canvas.getByRole('tab', { name: 'Plan' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(canvas.getByRole('tab', { name: 'Signalment' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  },
};

export const Locked: Story = {
  name: 'Read-only (clicking disabled)',
  args: { disableClicking: true },
  play: async ({ args, canvasElement }) => {
    const tab = within(canvasElement).getByRole('tab', { name: 'History' });
    await expect(tab).toBeDisabled();
    await userEvent.click(tab, { pointerEventsCheck: 0 });
    await expect(args.setActiveLabel).not.toHaveBeenCalled();
  },
};

export const WithRedirect: Story = {
  name: 'A pill that links out to its source',
  args: {
    labels: [
      { key: 'signalment', name: 'Signalment' },
      {
        key: 'insurance',
        name: 'Insurance',
        redirectHref: '/companions',
        redirectLabel: 'Open the companion record',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The link is a sibling of the tab INSIDE the same pill, not a replacement
       for it: the section still has to be selectable while also offering the
       jump to where its data actually lives. */
    await expect(canvas.getByRole('tab', { name: 'Insurance' })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Open the companion record' })).toHaveAttribute(
      'href',
      '/companions'
    );
  },
};

export const RedirectHiddenWhenLocked: Story = {
  name: 'Read-only drops the link too',
  args: {
    disableClicking: true,
    labels: [
      { key: 'signalment', name: 'Signalment' },
      { key: 'insurance', name: 'Insurance', redirectHref: '/companions' },
    ],
  },
  play: async ({ canvasElement }) => {
    // A locked row should not leave one live way out of it.
    await expect(within(canvasElement).queryByRole('link')).toBeNull();
  },
};

export const Phone: Story = {
  name: 'Phone: the row wraps rather than overflowing',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    labels: [
      ...SECTIONS,
      { key: 'diagnostics', name: 'Diagnostics' },
      { key: 'medication', name: 'Medication' },
    ],
  },
  play: async () => {
    // Six pills cannot sit on one 375px line, so the container wraps them.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
