import { useLayoutEffect, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';
import { expect, userEvent, within } from 'storybook/test';

import api from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import PracticeProfileFields from './PracticeProfileFields';

const ORG_ID = 'org-practice-profile-fields-story';
const OWNER: UserOrganization = {
  practitionerReference: 'Practitioner/story-vet',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

const FIELD = {
  id: 'field-contact-time',
  fieldKey: 'contact-time',
  label: 'Preferred contact time',
  type: 'SELECT' as const,
  options: ['Morning', 'Afternoon', 'Evening'],
  value: 'Afternoon',
};

const REAL_ADAPTER = api.defaults.adapter;

const practiceFieldsAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  const url = String(config.url ?? '');
  let data: unknown = [FIELD];
  if (method === 'post') {
    data = {
      ...FIELD,
      id: 'field-new',
      label: (config.data as { label: string }).label,
      type: (config.data as { type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' }).type,
    };
  } else if (method === 'delete' || method === 'put') {
    data = { success: true };
  } else if (!url.includes('/PATIENT/')) {
    throw new Error(`Unstubbed request in PracticeProfileFields story: ${url}`);
  }
  const response: AxiosResponse = {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
  return response;
};

const ApiFixture = ({ children }: { children: ReactNode }) => {
  useLayoutEffect(() => {
    const snapshot = useOrgStore.getState();
    const previousAdapter = api.defaults.adapter;
    api.defaults.adapter = practiceFieldsAdapter;
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: {
        [ORG_ID]: { _id: ORG_ID, name: 'Practice fields story' } as unknown as Organisation,
      },
      membershipsByOrgId: { [ORG_ID]: OWNER },
      status: 'loaded',
    });
    return () => {
      api.defaults.adapter = previousAdapter ?? REAL_ADAPTER;
      useOrgStore.setState(snapshot);
    };
  }, []);
  return <>{children}</>;
};

const meta = {
  title: 'Companions/PracticeProfileFields',
  component: PracticeProfileFields,
  parameters: { layout: 'padded' },
  args: { entityType: 'PATIENT', entityId: 'patient-poppy' },
  decorators: [
    (Story) => (
      <ApiFixture>
        <div className="w-full max-w-[640px]">
          <Story />
        </div>
      </ApiFixture>
    ),
  ],
} satisfies Meta<typeof PracticeProfileFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PatientProfile: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Practice fields')).toBeVisible();
    await expect(canvas.getByText('Preferred contact time')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Add field' }));
    await expect(canvas.getByRole('dialog', { name: 'Manage practice fields' })).toBeVisible();
    await expect(canvas.getByText(/Saved answers are kept/)).toBeVisible();
  },
};
