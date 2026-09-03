import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import DocumentsTable from './DocumentsTable';
import type { OrganizationDocument } from '@/app/features/documents/types/document';

const ORG_ID = 'org-documents-table-story';

const SEED: Array<[string, string, OrganizationDocument['category']]> = [
  [
    'Terms of service',
    'The agreement every client accepts at registration.',
    'TERMS_AND_CONDITIONS',
  ],
  [
    'Privacy policy',
    'How the practice stores and shares client and patient data.',
    'PRIVACY_POLICY',
  ],
  [
    'Cancellation policy',
    'Notice periods and the fee charged for a missed appointment.',
    'CANCELLATION_POLICY',
  ],
  [
    'Fire safety plan',
    'Evacuation routes, assembly point and the ward warden rota.',
    'FIRE_SAFETY',
  ],
  ['Anaesthesia consent', 'Signed before any procedure requiring sedation.', 'GENERAL'],
  ['Practice handbook', 'Opening hours, escalation ladder and out-of-hours cover.', 'GENERAL'],
];

const makeDocument = (index: number): OrganizationDocument => {
  const [title, description, category] = SEED[index % SEED.length];
  return {
    _id: `doc-${index + 1}`,
    organisationId: ORG_ID,
    title,
    description,
    fileUrl: `https://example.test/documents/doc-${index + 1}.pdf`,
    category,
  };
};

const DOCUMENTS: OrganizationDocument[] = SEED.map((_, index) => makeDocument(index));

const meta = {
  title: 'Tables/DocumentsTable',
  component: DocumentsTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The organisation's document register. Like every table in this folder it renders the " +
          'row layout above the breakpoint and a `DocumentsCard` list below it, so the same data ' +
          'is readable on a phone without a horizontal scroll. The category is title-cased for ' +
          'display while the stored value stays the SCREAMING_CASE enum.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: DOCUMENTS,
    setActive: fn(),
    setView: fn(),
  },
} satisfies Meta<typeof DocumentsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'The document register',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Terms of service').length).toBeGreaterThan(0);

    /* The stored category is `TERMS_AND_CONDITIONS`; the table shows a readable
       form. Asserting the rendered string is what catches the enum leaking into
       the UI, which a snapshot of the raw row would not. */
    await expect(canvas.queryByText('TERMS_AND_CONDITIONS')).toBeNull();
  },
};

export const OpensADocument: Story = {
  name: 'Viewing a document',
  play: async ({ args, canvasElement }) => {
    const view = within(canvasElement).getAllByRole('button')[0];
    await userEvent.click(view);
    // Both handlers fire: one selects the row, the other opens the panel. A table
    // that only called `setActive` would open an empty drawer.
    await expect(args.setActive).toHaveBeenCalledTimes(1);
    await expect(args.setView).toHaveBeenCalledWith(true);
  },
};

export const Empty: Story = {
  name: 'No documents uploaded',
  args: { filteredList: [] },
  play: async ({ canvasElement }) => {
    /* An empty register is the normal state for a new practice, so it gets a
       message rather than a bare header with nothing under it. Matched exactly:
       Storybook's preview decorator puts the STORY NAME in an sr-only h1, so a
       loose /no /i also matches "No documents uploaded". */
    await expect(within(canvasElement).getByText('No documents yet')).toBeInTheDocument();
  },
};

export const LongDescription: Story = {
  name: 'A description that runs long',
  args: {
    filteredList: [
      {
        ...makeDocument(0),
        title: 'Consent to treatment, anaesthesia and out-of-hours transfer of care',
        description:
          'Covers the practice standard for informed consent including the risks disclosed ' +
          'before induction, the named clinician responsible for the procedure, and the ' +
          'arrangements for transfer to the overnight referral centre if recovery is not ' +
          'complete by close of business.',
      },
      ...DOCUMENTS.slice(1),
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Document titles and descriptions are free text a practice types itself, so this is ' +
          'the case that decides whether the row clamps or grows several lines taller than its ' +
          'neighbours.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the rows become cards',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    /* The card list is the whole reason this table has a phone story: four
       columns of free text cannot fit 375px, so below the breakpoint the row
       layout is swapped out rather than squeezed. The page must not scroll
       sideways either way. */
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
