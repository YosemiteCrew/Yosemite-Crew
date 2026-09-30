import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import api from '@/app/services/axios';
import DermatologyAssessmentForm from './DermatologyAssessmentForm';

const previousAssessment = {
  id: 'derm-story-1',
  patientId: 'patient-story-1',
  encounterId: 'encounter-previous',
  assessedAt: '2026-09-20T10:00:00.000Z',
  affectedRegions: ['Paws', 'Ears'],
  primaryLesions: ['papules'],
  secondaryLesions: ['crusts'],
};

const stubDermatologyApi = () => {
  const previousAdapter = api.defaults.adapter;
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) =>
    Promise.resolve({
      data:
        config.method === 'post'
          ? { ...previousAssessment, id: 'derm-story-2', assessedAt: '2026-09-27T10:00:00.000Z' }
          : [previousAssessment],
      status: config.method === 'post' ? 201 : 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse);
  api.defaults.adapter = adapter;
  return () => {
    api.defaults.adapter = previousAdapter;
  };
};

const meta = {
  title: 'Workspace/DermatologyAssessmentForm',
  component: DermatologyAssessmentForm,
  parameters: { layout: 'padded' },
  args: {
    organisationId: 'org-storybook',
    patientId: 'patient-story-1',
    encounterId: 'encounter-current',
    assessedBy: 'clinician-story-1',
  },
  decorators: [
    (Story) => (
      <div className="w-[498px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DermatologyAssessmentForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompareAndRecordFindings: Story = {
  beforeEach: () => stubDermatologyApi(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Compare with previous visit')).toBeInTheDocument();
    await expect(canvas.getByText('Paws, Ears')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Paws' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Primary lesions' }), 'papules');
    await userEvent.click(canvas.getByRole('button', { name: 'Save findings' }));
    await expect(await canvas.findByText('Findings saved.')).toBeInTheDocument();
  },
};

export const EquineRegions: Story = {
  args: { species: 'Horse' },
  beforeEach: () => stubDermatologyApi(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const regions = await canvas.findByRole('group', { name: 'Affected body regions' });
    await expect(regions).toHaveAccessibleDescription('Regions for horses.');
    await expect(canvas.getByRole('checkbox', { name: 'Pasterns and hooves' })).toBeInTheDocument();
    await expect(canvas.queryByRole('checkbox', { name: 'Paws' })).not.toBeInTheDocument();
  },
};
