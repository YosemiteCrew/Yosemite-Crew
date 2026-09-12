import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import type { DraftImportView } from '@/app/services/formDraftImportService';
import DeveloperFormDraftImport from './DeveloperFormDraftImport';

/**
 * Drives the real component against the real service layer, only the axios
 * ADAPTER is swapped - same shape as DeveloperApiKeys.stories.tsx, and for the
 * same reason: stubbing the service module would hide a change to the request
 * shape or the `{ data }` envelope.
 *
 * The forms-loading side effect (source-form dropdown options) is left to
 * resolve to an empty list here rather than faked through the FHIR
 * questionnaire mapping it would otherwise require - that path is exercised
 * for real in DraftImportForm.stories.tsx and the page's own jest test, which
 * seed the forms store directly.
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

const ORG_ID = 'org-storybook';

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
    role: 'developer',
    user: {
      userId: 'dev-storybook',
      email: 'ravi@example.test',
      authProfile: null,
      loginMethod: 'emailpassword',
      emailVerified: true,
      getUsername: () => 'dev-storybook',
    },
    attributes: { sub: 'dev-storybook', email: 'ravi@example.test', email_verified: 'true' },
  });
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: OWNER_MEMBERSHIP },
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
  return () => {
    restoreApi();
    restoreStores();
    clearInFlightGetRequests();
  };
};

const VIEW: DraftImportView = {
  id: 'd1',
  organisationId: ORG_ID,
  sourceFormId: null,
  draftFormId: 'draft-form-1',
  suppliedText: 'Patient name | input | required\nConsent to treatment | boolean | required',
  fields: [
    { id: 'patient-name', type: 'input', label: 'Patient name', required: true, sourceLine: 1 },
    {
      id: 'consent-to-treatment',
      type: 'boolean',
      label: 'Consent to treatment',
      required: true,
      sourceLine: 2,
    },
  ],
  unsupportedConstructs: [],
  diff: [],
  stale: false,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

const meta = {
  title: 'Developers/DeveloperFormDraftImport',
  component: DeveloperFormDraftImport,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/developers/form-draft-import' },
    },
    docs: {
      description: {
        component:
          "Review surface for #3055's deterministic supplied-text-to-draft-form import: paste " +
          'text, preview the proposed fields and the diff against an existing form, then keep ' +
          '(via the existing form editor/publish flow, untouched here) or discard.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: setup(() => ({ body: [] })),
} satisfies Meta<typeof DeveloperFormDraftImport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateAndReview: Story = {
  name: 'Paste text, preview the draft',
  beforeEach: setup((config) => {
    if (config.method?.toLowerCase() === 'post') {
      return { status: 201, body: { data: VIEW } };
    }
    return { body: [] };
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      await canvas.findByLabelText(/Supplied form text/),
      'Patient name | input | required\nConsent to treatment | boolean | required'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Preview import' }));

    await waitFor(() => expect(canvas.getByText('Proposed fields (2)')).toBeInTheDocument());
    await expect(canvas.getByText('Patient name')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Discard draft' })).toBeInTheDocument();
  },
};

export const ImportFailed: Story = {
  name: 'Import request fails',
  beforeEach: setup((config) => {
    if (config.method?.toLowerCase() === 'post') {
      return { status: 400, body: { message: 'No supported fields were found in suppliedText' } };
    }
    return { body: [] };
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText(/Supplied form text/), 'not a real field');
    await userEvent.click(canvas.getByRole('button', { name: 'Preview import' }));
    await waitFor(() =>
      expect(canvas.getByText(/Could not import the supplied text/)).toBeInTheDocument()
    );
  },
};

export const DiscardAlreadyPublished: Story = {
  name: 'Discard refused - already published',
  beforeEach: setup((config) => {
    if (config.method?.toLowerCase() === 'post') return { status: 201, body: { data: VIEW } };
    if (config.method?.toLowerCase() === 'delete') {
      return {
        status: 409,
        body: {
          message: 'This draft has already been published and can no longer be discarded here',
        },
      };
    }
    return { body: [] };
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByLabelText(/Supplied form text/),
      'Patient name | input | required'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Preview import' }));
    await canvas.findByText('Proposed fields (2)');

    await userEvent.click(canvas.getByRole('button', { name: 'Discard draft' }));
    await waitFor(() =>
      expect(canvas.getByText(/already have been published/)).toBeInTheDocument()
    );
  },
};
