import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { UserOrganization } from '@yosemite-crew/types';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import type { MedicalCertificate } from '@/app/features/companionHistory/services/medicalCertificateService';
import MedicalCertificatesPanel from './MedicalCertificatesPanel';

const ORG_ID = 'org-storybook-medical-certificates';
const PATIENT_ID = 'patient-storybook-miso';
const CLIENT_ID = 'client-storybook-miso';

const membership: UserOrganization = {
  practitionerReference: 'Practitioner/staff-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: [],
};

let records: MedicalCertificate[] = [];

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const adapter: AxiosAdapter = (config) => {
  const url = String(config.url ?? '');
  const method = String(config.method ?? 'get').toLowerCase();
  if (!url.includes('/medical-certificates')) return Promise.resolve(respond(config, []));
  if (method === 'post' && url.endsWith('/issue')) {
    records = records.map((record) =>
      url.includes(record.id)
        ? {
            ...record,
            status: 'ISSUED',
            issueNumber: `CERT-${record.id}`,
            issuedAt: new Date().toISOString(),
          }
        : record
    );
    return Promise.resolve(
      respond(
        config,
        records.find((record) => url.includes(record.id))
      )
    );
  }
  if (method === 'post' && url.endsWith('/revoke')) {
    records = records.map((record) =>
      url.includes(record.id) ? { ...record, status: 'REVOKED' } : record
    );
    return Promise.resolve(
      respond(
        config,
        records.find((record) => url.includes(record.id))
      )
    );
  }
  if (method === 'post') {
    const body = JSON.parse(String(config.data ?? '{}')) as Partial<MedicalCertificate>;
    const created: MedicalCertificate = {
      id: `cert-${records.length + 1}`,
      organisationId: ORG_ID,
      patientId: PATIENT_ID,
      clientId: CLIENT_ID,
      certificateType: 'HEALTH_CERTIFICATE',
      status: 'DRAFT',
      issueNumber: null,
      issuedAt: null,
      expiresAt: null,
      issuedBy: null,
      validForTravel: false,
      destinationCountry: null,
      clinicalFindings: null,
      restrictions: null,
      notes: null,
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...body,
    };
    records = [created, ...records];
    return Promise.resolve(respond(config, created));
  }
  return Promise.resolve(respond(config, records));
};

const REAL_ADAPTER = api.defaults.adapter;

const meta = {
  title: 'CompanionHistory/MedicalCertificatesPanel',
  component: MedicalCertificatesPanel,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    companionId: PATIENT_ID,
    clientId: CLIENT_ID,
    patientName: 'Miso',
  },
  beforeEach: () => {
    const orgSnapshot = useOrgStore.getState();
    const authSnapshot = useAuthStore.getState();
    const oldAdapter = api.defaults.adapter;
    records = [
      {
        id: 'cert-issued',
        organisationId: ORG_ID,
        patientId: PATIENT_ID,
        clientId: CLIENT_ID,
        certificateType: 'VACCINATION_CERTIFICATE',
        status: 'ISSUED',
        issueNumber: 'CERT-2026-001',
        issuedAt: '2026-02-01T00:00:00.000Z',
        expiresAt: null,
        issuedBy: 'staff-1',
        validForTravel: false,
        destinationCountry: null,
        clinicalFindings: 'Vaccinations are current.',
        restrictions: null,
        notes: null,
        revokedAt: null,
        revokedReason: null,
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
    ];
    api.defaults.adapter = adapter;
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      membershipsByOrgId: { [ORG_ID]: membership },
      status: 'loaded',
    });
    useAuthStore.setState({
      user: {
        userId: 'staff-1',
        email: 'staff@example.test',
        authProfile: null,
        loginMethod: null,
        emailVerified: true,
        getUsername: () => 'staff-1',
      },
    });
    clearInFlightGetRequests();
    return () => {
      api.defaults.adapter = oldAdapter ?? REAL_ADAPTER;
      useOrgStore.setState(orgSnapshot);
      useAuthStore.setState(authSnapshot);
      clearInFlightGetRequests();
    };
  },
} satisfies Meta<typeof MedicalCertificatesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PatientRecord: Story = {};
