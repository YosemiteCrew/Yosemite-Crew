import { useLayoutEffect, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import type { UserOrganization } from '@yosemite-crew/types';
import { expect, userEvent, within } from 'storybook/test';

import api from '@/app/services/axios';
import type { StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import type { CareReminder } from '@/app/services/careReminderService';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { CareRemindersPage } from './CareRemindersPage';

const ORG_ID = 'org-care-reminders-page-story';

const OWNER: UserOrganization = {
  practitionerReference: 'Practitioner/story-vet',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

const companion = (id: string, name: string) =>
  ({ id, name, organisationId: ORG_ID }) as unknown as StoredCompanion;

const PENDING: CareReminder = {
  id: 'reminder-milo',
  patientId: 'pet-milo',
  reminderType: 'ANNUAL_CHECKUP',
  dueDate: '2026-10-14T11:00:00.000Z',
  sendAt: null,
  status: 'PENDING',
  sendingAt: null,
  lastAttemptAt: null,
  lastDelivery: null,
};

const REAL_ADAPTER = api.defaults.adapter;

const careReminderAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  const url = String(config.url ?? '');
  let data: unknown;
  if (method === 'get' && url.endsWith('/care-reminders')) {
    data = [PENDING];
  } else if (method === 'post' && url.endsWith('/send')) {
    data = { ...PENDING, status: 'SENT' };
  } else if (method === 'post' && url.endsWith('/bulk')) {
    data = { created: 1 };
  } else {
    throw new Error(`Unstubbed request in CareRemindersPage story: ${url}`);
  }
  const response: AxiosResponse = { data, status: 200, statusText: 'OK', headers: {}, config };
  return response;
};

const PageFixture = ({ children }: { children: ReactNode }) => {
  useLayoutEffect(() => {
    const orgSnapshot = useOrgStore.getState();
    const companionSnapshot = useCompanionStore.getState();
    const previousAdapter = api.defaults.adapter;
    api.defaults.adapter = careReminderAdapter;
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: OWNER },
      status: 'loaded',
    });
    useCompanionStore.setState({
      companionsById: {
        'pet-milo': companion('pet-milo', 'Milo'),
        'pet-luna': companion('pet-luna', 'Luna'),
      },
      companionsIdsByOrgId: { [ORG_ID]: ['pet-milo', 'pet-luna'] },
      status: 'loaded',
    });
    return () => {
      api.defaults.adapter = previousAdapter ?? REAL_ADAPTER;
      useOrgStore.setState(orgSnapshot);
      useCompanionStore.setState(companionSnapshot);
    };
  }, []);
  return <>{children}</>;
};

const meta = {
  title: 'Care reminders/CareRemindersPage',
  component: CareRemindersPage,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFixture>
        <Story />
      </PageFixture>
    ),
  ],
} satisfies Meta<typeof CareRemindersPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReviewAndSchedule: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Milo · Annual check-up')).toBeVisible();
    await expect(canvas.getByText('No recipients selected.')).toBeVisible();
    await userEvent.selectOptions(canvas.getByLabelText('Companions'), ['pet-milo', 'pet-luna']);
    await expect(canvas.getByText('Selected (2): Milo, Luna')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Schedule 2 reminders' })).toBeDisabled();
  },
};

export const SendNow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Send now' }));
    await expect(await canvas.findByRole('status')).toHaveTextContent('Delivery result updated.');
  },
};
