import type { Meta, StoryObj } from '@storybook/react';
import rawAxios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import MigrationAudit from './MigrationAudit';

/**
 * Drives the real component against the real service layer, only the axios
 * ADAPTER is swapped - same shape as DeveloperFormDraftImport.stories.tsx (#3060)
 * and for the same reason: stubbing the service module would hide a change to
 * the request shape or response envelope.
 */
type Handler = (config: InternalAxiosRequestConfig) => { status?: number; body?: unknown };

const stubApi = (handler: Handler) => {
  const previous = api.defaults.adapter;
  api.defaults.adapter = async (config) => {
    const { status = 200, body = [] } = handler(config);
    if (status >= 400) {
      throw Object.assign(new Error(`Request failed with status ${status}`), {
        response: { status, data: body, config },
        config,
      });
    }
    return { data: body, status, statusText: 'OK', headers: {}, config } as AxiosResponse;
  };
  return () => {
    api.defaults.adapter = previous;
  };
};

// axios.put targets the presigned S3 URL directly (an absolute, non-API
// origin, deliberately with `withCredentials: false`), which is a different
// axios instance from the api client stubbed above - stub the plain axios
// default adapter too so the direct upload never leaves this story either.
const stubDirectUpload = () => {
  const previous = rawAxios.defaults.adapter;
  rawAxios.defaults.adapter = async (config: InternalAxiosRequestConfig) =>
    ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }) as AxiosResponse;
  return () => {
    rawAxios.defaults.adapter = previous;
  };
};

const ORG_ID = 'org-storybook';
const OTHER_ORG_ID = 'org-storybook-2';
const PRESIGNED_URL =
  'https://yosemite-crew-migration.s3.eu-central-1.amazonaws.com/orgs/org-storybook/f.csv?X-Amz-Signature=storybook';

const OWNER_MEMBERSHIP: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

const seedStores = () => {
  const authSnapshot = useAuthStore.getState();
  const orgSnapshot = useOrgStore.getState();

  useAuthStore.setState({
    status: 'authenticated',
    role: 'owner',
    user: {
      userId: 'owner-storybook',
      email: 'owner@example.test',
      authProfile: null,
      loginMethod: 'emailpassword',
      emailVerified: true,
      getUsername: () => 'owner-storybook',
    },
    attributes: { sub: 'owner-storybook', email: 'owner@example.test', email_verified: 'true' },
  });
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: {
      [ORG_ID]: OWNER_MEMBERSHIP,
      [OTHER_ORG_ID]: {
        ...OWNER_MEMBERSHIP,
        organizationReference: `Organization/${OTHER_ORG_ID}`,
      },
    },
    status: 'loaded',
  });

  return () => {
    useAuthStore.setState(authSnapshot);
    useOrgStore.setState(orgSnapshot);
  };
};

const setup = (handler: Handler) => () => {
  clearInFlightGetRequests();
  const restoreStores = seedStores();
  const restoreApi = stubApi(handler);
  const restoreUpload = stubDirectUpload();
  return () => {
    restoreUpload();
    restoreApi();
    restoreStores();
    clearInFlightGetRequests();
  };
};

const csvFile = (name: string) => new File(['external_id\n1'], name, { type: 'text/csv' });

const meta = {
  title: 'Onboarding/MigrationAudit',
  component: MigrationAudit,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/migration-audit' },
    },
    docs: {
      description: {
        component:
          "Review surface for #3056's read-only migration-audit API: upload the owners/animals/" +
          'appointments CSVs (attachments optional), create a run, poll until it completes, then ' +
          'review the summary and every finding before deciding whether to proceed with an import.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: setup(() => ({ body: [] })),
} satisfies Meta<typeof MigrationAudit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RunToCompletion: Story = {
  name: 'Upload, create the run, and review the completed findings',
  beforeEach: setup((config) => {
    const method = config.method?.toLowerCase();
    const url = config.url ?? '';
    if (method === 'post' && url.endsWith('/upload-url')) {
      // uploadMigrationAuditFile rejects anything that is not an https
      // *.amazonaws.com host, so the stub has to be shaped like a real
      // presigned S3 URL or the upload never happens.
      return { status: 200, body: { url: PRESIGNED_URL, key: `orgs/${ORG_ID}/f.csv` } };
    }
    if (method === 'post') {
      return { status: 201, body: { id: 'run-storybook', status: 'PENDING' } };
    }
    if (method === 'get') {
      return {
        status: 200,
        body: {
          id: 'run-storybook',
          status: 'COMPLETED',
          summary: {
            OWNERS: {
              status: 'ASSESSED',
              totalRows: 2,
              duplicateIdentifiers: 0,
              orphanReferences: 0,
            },
            ANIMALS: {
              status: 'ASSESSED',
              totalRows: 2,
              duplicateIdentifiers: 0,
              orphanReferences: 1,
            },
            APPOINTMENTS: {
              status: 'ASSESSED',
              totalRows: 2,
              duplicateIdentifiers: 0,
              orphanReferences: 0,
            },
          },
          errorMessage: null,
          createdAt: '2026-09-12T00:00:00.000Z',
          completedAt: '2026-09-12T00:00:05.000Z',
          outcome: {
            resourceType: 'OperationOutcome',
            issue: [
              {
                severity: 'error',
                code: 'orphan_reference',
                diagnostics:
                  'animals.csv row 2 references owner_external_id not present in owners.csv.',
                expression: ['animals.csv[row 2]'],
              },
            ],
          },
        },
      };
    }
    return { body: [] };
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.upload(await canvas.findByLabelText('Owners'), csvFile('owners.csv'));
    await userEvent.upload(canvas.getByLabelText('Animals'), csvFile('animals.csv'));
    await userEvent.upload(canvas.getByLabelText('Appointments'), csvFile('appointments.csv'));
    await userEvent.click(canvas.getByRole('button', { name: 'Run migration audit' }));

    await waitFor(() => expect(canvas.getByText(/Reading the uploaded files/)).toBeInTheDocument());
    await waitFor(() => expect(canvas.getByText('Findings (1)')).toBeInTheDocument(), {
      timeout: 10_000,
    });
    await expect(canvas.getByText('Row 2')).toBeInTheDocument();
  },
};

export const OrganisationSwitch: Story = {
  name: "Switching organisation clears the previous one's report",
  beforeEach: RunToCompletion.beforeEach,
  play: async (context) => {
    await RunToCompletion.play?.(context);
    const canvas = within(context.canvasElement);

    useOrgStore.setState({ primaryOrgId: OTHER_ORG_ID });

    await waitFor(() => expect(canvas.queryByText('Findings (1)')).not.toBeInTheDocument());
    await expect(await canvas.findByLabelText('Owners')).toHaveValue('');
  },
};

export const UploadFails: Story = {
  name: 'Upload request fails',
  beforeEach: setup((config) => {
    if (config.method?.toLowerCase() === 'post' && (config.url ?? '').endsWith('/upload-url')) {
      return { status: 500, body: { message: 'Internal Server Error' } };
    }
    return { body: [] };
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(await canvas.findByLabelText('Owners'), csvFile('owners.csv'));
    await userEvent.upload(canvas.getByLabelText('Animals'), csvFile('animals.csv'));
    await userEvent.upload(canvas.getByLabelText('Appointments'), csvFile('appointments.csv'));
    await userEvent.click(canvas.getByRole('button', { name: 'Run migration audit' }));

    await waitFor(() =>
      expect(
        canvas.getByText('Could not start the migration audit. Please try again.')
      ).toBeInTheDocument()
    );
  },
};
