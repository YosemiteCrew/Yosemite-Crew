import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import DocumentsCard from './index';
import type { OrganizationDocument } from '../../../features/documents/types/document';

const baseDocument: OrganizationDocument = {
  _id: 'doc-1',
  organisationId: 'org-1',
  title: 'Cancellation Policy',
  description: 'What clients are charged when they cancel inside 24 hours',
  fileUrl: 'https://example.com/cancellation-policy.pdf',
  category: 'CANCELLATION_POLICY',
};

/**
 * The card the documents table falls back to below `xl`. Two of them sit side
 * by side on tablet (`calc(50% - 12px)`) and stack full-width on phone, so the
 * stories render it inside the same wrapping flex row the table uses.
 */
const meta = {
  title: 'Cards/DocumentsCard',
  component: DocumentsCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Compact summary of one organisation document — title, description and category over a full-width "View" action. ' +
          'This is the sub-`xl` fallback for `DocumentsTable`: `--neutral-0` surface, radius 16, hairline border and the ' +
          'shared `--sh03`/`--sh05` card shadow. The category is title-cased for display, so `CANCELLATION_POLICY` reads as "Cancellation policy".',
      },
    },
  },
  tags: ['autodocs'],
  args: { document: baseDocument, handleViewDocument: fn() },
  decorators: [
    (StoryFn) => (
      <div className="flex flex-wrap gap-4 sm:gap-6">
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof DocumentsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * Long title and description. Nothing truncates, so the card grows and the
 * "View" action stays pinned to the bottom by `justify-between`.
 */
export const LongContent: Story = {
  args: {
    document: {
      ...baseDocument,
      _id: 'doc-2',
      title: 'Terms and Conditions for Boarding, Grooming and Day Care Services',
      description:
        'Covers liability, vaccination requirements, feeding instructions, medication handling and the late-collection fee schedule that applies to every overnight stay.',
      category: 'TERMS_AND_CONDITIONS',
    },
  },
};

/**
 * `description` is optional. The label still renders, so this is the state to
 * check when the description row looks unbalanced.
 */
export const WithoutDescription: Story = {
  args: {
    document: {
      ...baseDocument,
      _id: 'doc-3',
      title: 'Fire Safety Notice',
      description: undefined,
      category: 'FIRE_SAFETY',
    },
  },
};
