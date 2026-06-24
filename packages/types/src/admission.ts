export type Admission = {
  encounterId: string;
  organisationId: string;
  patientId?: string;
  companionId?: string;
  unitId?: string;
  expectedStayDays?: number;
  admittedAt: Date;
  admittedBy?: string;
  dischargedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
