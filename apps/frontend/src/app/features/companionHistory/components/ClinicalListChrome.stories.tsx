import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import React, { useState } from 'react';
import { IoMedkitOutline } from 'react-icons/io5';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  ClinicalListEmpty,
  ClinicalListError,
  ClinicalListHeader,
  ClinicalListLoadingRows,
  cardClass,
  formatDate,
  metaClass,
  rowClass,
  titleClass,
} from './ClinicalListChrome';

/**
 * Sample rows for the card body under the header. `ClinicalListHeader` itself
 * takes no row data - the caller (ProblemList, AllergyList, ...) owns the list
 * and picks which of these three bodies to render. These stand in for that so
 * the header's count pill has something real to count.
 */
const SAMPLE_PROBLEMS = [
  { id: 'p1', name: 'Osteoarthritis, left hip', onset: '2026-01-12' },
  { id: 'p2', name: 'Chronic kidney disease, stage 2', onset: '2025-02-03' },
];

const SampleRows = () => (
  <ul className="divide-y divide-[var(--divider)]">
    {SAMPLE_PROBLEMS.map((problem) => (
      <li key={problem.id} className={rowClass}>
        <span>
          <span className={titleClass}>{problem.name}</span>
          <span className={`${metaClass} mt-0.5 block`}>Onset {formatDate(problem.onset)}</span>
        </span>
        <StatusPill label="Active" tone="warning" />
      </li>
    ))}
  </ul>
);

const meta = {
  title: 'CompanionHistory/ClinicalListChrome',
  component: ClinicalListHeader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Section header shared by the clinical-record lists in the companion history ' +
          '(problem list, allergies, and any list built on the same ClinicalListChrome ' +
          "pieces). It shows the list's icon and title, an 'N active' count pill once data " +
          'has loaded (withheld while loading, on error, or when the count is zero, so a ' +
          'stale or meaningless number is never shown), and, for callers with edit rights, ' +
          "a toggle button that swaps between the add label and 'Close' as the inline " +
          'create form opens and closes. The rest of ClinicalListChrome - the loading ' +
          'skeleton, empty message and error banner - fills the body below it in these ' +
          'stories, the same way ProblemList and AllergyList compose it.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    loading: { control: 'boolean' },
    canEdit: { control: 'boolean' },
    showForm: { control: 'boolean' },
    icon: { control: false },
  },
  args: {
    icon: <IoMedkitOutline size={18} />,
    headingId: 'problem-list-heading',
    title: 'Problem list',
    activeCount: 2,
    loading: false,
    error: null,
    canEdit: true,
    showForm: false,
    onToggle: fn(),
    addLabel: 'Add problem',
  },
  render: (args) => (
    <section className={cardClass} style={{ maxWidth: 480 }} aria-labelledby={args.headingId}>
      <ClinicalListHeader {...args} />
      {args.error ? (
        <ClinicalListError error={args.error} />
      ) : args.loading ? (
        <ClinicalListLoadingRows />
      ) : args.activeCount === 0 ? (
        <ClinicalListEmpty message="No problems recorded for this patient yet." />
      ) : (
        <SampleRows />
      )}
    </section>
  ),
} satisfies Meta<typeof ClinicalListHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: { activeCount: 0 },
};

export const ErrorState: Story = {
  name: 'Load failed',
  args: { error: 'Could not load problems.' },
};

export const ReadOnly: Story = {
  name: 'No edit permission',
  args: { canEdit: false },
};

/**
 * `ClinicalListHeader`'s args are static per story, so this demo keeps its own
 * `showForm` state (the way `ProblemList` really does) to give the toggle
 * button something to actually flip - real interactive behaviour worth a
 * play() assertion, unlike the presentational stories above.
 */
const ToggleDemo = () => {
  const [showForm, setShowForm] = useState(false);
  return (
    <section className={cardClass} style={{ maxWidth: 480 }} aria-labelledby="toggle-demo-heading">
      <ClinicalListHeader
        icon={<IoMedkitOutline size={18} />}
        headingId="toggle-demo-heading"
        title="Problem list"
        activeCount={2}
        loading={false}
        canEdit
        showForm={showForm}
        onToggle={() => setShowForm((open) => !open)}
        addLabel="Add problem"
      />
      {showForm ? (
        <p className="px-4 py-3 text-[12.5px] text-[var(--ink-faint)]">
          Add-problem form goes here.
        </p>
      ) : (
        <SampleRows />
      )}
    </section>
  );
};

export const TogglingTheForm: Story = {
  name: 'Toggling the add form',
  render: () => <ToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button', { name: 'Add problem' });
    await expect(openButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(openButton);

    const closeButton = canvas.getByRole('button', { name: 'Close' });
    await expect(closeButton).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Add-problem form goes here.')).toBeVisible();
  },
};
