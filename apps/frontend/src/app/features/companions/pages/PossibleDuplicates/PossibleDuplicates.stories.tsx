import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import type { AxiosResponse } from 'axios';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useOrgStore } from '@/app/stores/orgStore';
import PossibleDuplicates from './PossibleDuplicates';

const ORG_ID = 'duplicate-review-story';
const MATCHES = [
  {
    patientA: { id: 'patient-poppy-a', name: 'Poppy', dateOfBirth: '2020-01-02T00:00:00.000Z' },
    patientB: { id: 'patient-poppy-b', name: 'Poppy', dateOfBirth: '2020-01-02T00:00:00.000Z' },
    matchingOn: 'name-and-birth-date',
  },
  {
    patientA: { id: 'patient-milo-a', name: 'Milo', dateOfBirth: '2019-05-14T00:00:00.000Z' },
    patientB: {
      id: 'patient-milo-b',
      name: 'Clementine Blossom-Windermere of Silverlake',
      dateOfBirth: '2021-08-09T00:00:00.000Z',
    },
    matchingOn: 'microchip',
  },
];

const meta = {
  title: 'Companions/PossibleDuplicates',
  component: PossibleDuplicates,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    const orgSnapshot = useOrgStore.getState();
    const previousAdapter = api.defaults.adapter;
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      status: 'loaded',
      membershipsByOrgId: {
        [ORG_ID]: {
          practitionerReference: 'Practitioner/duplicate-review-story',
          organizationReference: `Organization/${ORG_ID}`,
          roleCode: '',
          roleDisplay: 'Front desk',
          active: true,
          extraPermissions: [PERMISSIONS.COMPANIONS_VIEW_ANY, PERMISSIONS.COMPANIONS_EDIT_ANY],
          revokedPermissions: [],
        },
      },
    });
    api.defaults.adapter = async (config) =>
      ({
        data: config.method === 'post' ? {} : { matches: MATCHES },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }) as AxiosResponse;
    clearInFlightGetRequests();
    return () => {
      useOrgStore.setState(orgSnapshot);
      api.defaults.adapter = previousAdapter;
      clearInFlightGetRequests();
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Poppy')).toBeInTheDocument());
    expect(canvas.getByText('Same name and birth date')).toBeInTheDocument();
    expect(canvas.getByText('Same microchip')).toBeInTheDocument();
  },
} satisfies Meta<typeof PossibleDuplicates>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReviewQueue: Story = {};
