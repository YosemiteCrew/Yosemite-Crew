export type Admission = {
  encounterId: string;
  organisationId: string;
  patientId?: string;
  companionId?: string;
  unitId?: string;
  expectedStayDays?: number;
  admittedAt: Date;
  dischargedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
