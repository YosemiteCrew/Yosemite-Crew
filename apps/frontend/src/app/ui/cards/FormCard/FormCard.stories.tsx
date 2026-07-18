import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import FormCard from './index';
import type { FormsProps } from '@/app/features/forms/types/forms';
// The status micro-pill (.appointment-status) geometry ships in the shared table CSS.
import '@/app/ui/tables/DataTable.css';

const baseForm = {
  _id: 'form-1',
  name: 'New Patient Intake',
  category: 'Client',
  description: 'Initial client and patient data collection',
  usage: 'Onboarding',
  updatedBy: 'Dr. Sarah Weber',
  lastUpdated: '2026-07-15',
  status: 'published',
} as unknown as FormsProps;

const meta = {
  title: 'Cards/FormCard',
  component: FormCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Form summary card. Status renders as the design-system uppercase micro-pill (.appointment-status) above a full-width Secondary action.',
      },
    },
  },
  tags: ['autodocs'],
  args: { form: baseForm, handleViewForm: fn() },
} satisfies Meta<typeof FormCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Published: Story = {};

export const Draft: Story = {
  args: { form: { ...baseForm, name: 'Surgical Consent', status: 'draft' } as FormsProps },
};

export const Archived: Story = {
  args: { form: { ...baseForm, name: 'Legacy Boarding Form', status: 'archived' } as FormsProps },
};
