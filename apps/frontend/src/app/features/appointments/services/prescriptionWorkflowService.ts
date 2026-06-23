import { postData } from '@/app/services/axios';

export type PrescriptionWorkflowBody = Record<string, unknown>;
export type PrescriptionWorkflowResult = Record<string, unknown>;

const prescriptionAction = async (
  organisationId: string,
  prescriptionId: string,
  action: '$reserve' | '$dispense' | '$return' | '$void-dispense' | '$not-dispensed' | '$finalize',
  body: PrescriptionWorkflowBody = {}
) => {
  const res = await postData<PrescriptionWorkflowResult>(
    `/v1/prescriptions/organisations/${organisationId}/${prescriptionId}/${action}`,
    body
  );
  return res.data;
};

export const reservePrescription = (
  organisationId: string,
  prescriptionId: string,
  body: PrescriptionWorkflowBody = {}
) => prescriptionAction(organisationId, prescriptionId, '$reserve', body);

export const dispensePrescription = (
  organisationId: string,
  prescriptionId: string,
  body: PrescriptionWorkflowBody = {}
) => prescriptionAction(organisationId, prescriptionId, '$dispense', body);

export const returnPrescriptionDispense = (
  organisationId: string,
  prescriptionId: string,
  body: PrescriptionWorkflowBody = {}
) => prescriptionAction(organisationId, prescriptionId, '$return', body);

export const voidPrescriptionDispense = (
  organisationId: string,
  prescriptionId: string,
  body: PrescriptionWorkflowBody = {}
) => prescriptionAction(organisationId, prescriptionId, '$void-dispense', body);

export const notDispensedPrescription = (
  organisationId: string,
  prescriptionId: string,
  body: PrescriptionWorkflowBody = {}
) => prescriptionAction(organisationId, prescriptionId, '$not-dispensed', body);

export const finalizePrescription = (
  organisationId: string,
  prescriptionId: string,
  body: PrescriptionWorkflowBody = {}
) => prescriptionAction(organisationId, prescriptionId, '$finalize', body);
