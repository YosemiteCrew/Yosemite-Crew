import type { TemplateKind } from '@yosemite-crew/types';
import { getData } from '@/app/services/axios';

export type TemplateResolveParams = {
  organisationId: string;
  kind: TemplateKind;
  appointmentId?: string;
  encounterId?: string;
  patientId?: string;
  species?: string;
  serviceId?: string;
  packageId?: string;
  mode?: 'OUTPATIENT' | 'INPATIENT';
  ownerUserId?: string;
};

export type TemplateResolveResponse = Record<string, unknown>;

export const resolveTemplate = async (params: TemplateResolveParams) => {
  const res = await getData<TemplateResolveResponse>('/v1/templates/pms/resolve', params);
  return res.data;
};
