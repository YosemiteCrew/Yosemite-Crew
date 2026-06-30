import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class BloodBankError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "BloodBankError";
  }
}

type BloodType =
  | "DEA_1_POSITIVE"
  | "DEA_1_NEGATIVE"
  | "TYPE_A"
  | "TYPE_B"
  | "TYPE_AB"
  | "UNKNOWN";

type DonationStatus =
  | "COLLECTED"
  | "PROCESSED"
  | "AVAILABLE"
  | "TRANSFUSED"
  | "EXPIRED"
  | "DISCARDED";

export interface CrossmatchResult {
  recipientId: string;
  compatible: boolean;
  testedAt?: string;
  notes?: string;
}

export interface RegisterDonorParams {
  organisationId: string;
  patientId: string;
  bloodType: BloodType;
  lastScreeningAt?: Date;
  isActive?: boolean;
  notes?: string;
  registeredBy?: string;
}

export interface UpdateDonorParams {
  bloodType?: BloodType;
  lastScreeningAt?: Date;
  lastDonationAt?: Date;
  nextEligibleAt?: Date;
  isActive?: boolean;
  totalDonations?: number;
  disqualificationReason?: string;
  notes?: string;
}

export interface RecordDonationParams {
  donorId: string;
  organisationId: string;
  collectedAt: Date;
  collectedBy?: string;
  volumeMl: number;
  anticoagulant?: string;
  unitId?: string;
  expiresAt?: Date;
  crossmatchResults?: CrossmatchResult[];
  notes?: string;
}

export interface UpdateDonationParams {
  status?: DonationStatus;
  crossmatchResults?: CrossmatchResult[];
  notes?: string;
}

export interface ListDonorsParams {
  organisationId: string;
  bloodType?: BloodType;
  isActive?: boolean;
}

export interface ListDonationsParams {
  organisationId: string;
  donorId?: string;
  status?: DonationStatus;
}

const donorSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  bloodType: true,
  lastScreeningAt: true,
  lastDonationAt: true,
  nextEligibleAt: true,
  isActive: true,
  totalDonations: true,
  disqualificationReason: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BloodBankDonorSelect;

const donationSelect = {
  id: true,
  donorId: true,
  organisationId: true,
  collectedAt: true,
  collectedBy: true,
  volumeMl: true,
  anticoagulant: true,
  unitId: true,
  expiresAt: true,
  crossmatchResults: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BloodDonationCollectionSelect;

const assertDonor = async (id: string, organisationId: string) => {
  const record = await prisma.bloodBankDonor.findFirst({
    where: { id, organisationId },
    select: donorSelect,
  });
  if (!record) {
    throw new BloodBankError("Blood bank donor not found.", 404);
  }
  return record;
};

const assertDonation = async (id: string, organisationId: string) => {
  const record = await prisma.bloodDonationCollection.findFirst({
    where: { id, organisationId },
    select: donationSelect,
  });
  if (!record) {
    throw new BloodBankError("Blood donation collection not found.", 404);
  }
  return record;
};

export const BloodBankService = {
  // Donor management
  async registerDonor(params: RegisterDonorParams) {
    const { organisationId, patientId, registeredBy, ...rest } = params;

    const existing = await prisma.bloodBankDonor.findUnique({
      where: { patientId },
      select: { id: true },
    });
    if (existing) {
      throw new BloodBankError(
        "Patient is already registered as a blood donor.",
        409,
      );
    }

    const donor = await prisma.bloodBankDonor.create({
      data: {
        organisationId,
        patientId,
        bloodType: rest.bloodType,
        lastScreeningAt: rest.lastScreeningAt ?? null,
        isActive: rest.isActive ?? true,
        notes: rest.notes ?? null,
      },
      select: donorSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "BLOOD_DONOR_REGISTERED",
      actorType: "PMS_USER",
      actorId: registeredBy ?? null,
      entityType: "COMPANION",
      entityId: donor.id,
      metadata: { bloodType: rest.bloodType },
    });

    return donor;
  },

  async getDonor(id: string, organisationId: string) {
    return assertDonor(id, organisationId);
  },

  async getDonorByPatient(patientId: string, organisationId: string) {
    const donor = await prisma.bloodBankDonor.findFirst({
      where: { patientId, organisationId },
      select: donorSelect,
    });
    if (!donor) {
      throw new BloodBankError(
        "No blood bank record found for this patient.",
        404,
      );
    }
    return donor;
  },

  async listDonors(params: ListDonorsParams) {
    const { organisationId, bloodType, isActive } = params;
    return prisma.bloodBankDonor.findMany({
      where: {
        organisationId,
        ...(bloodType ? { bloodType } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: donorSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async updateDonor(
    id: string,
    organisationId: string,
    params: UpdateDonorParams,
  ) {
    await assertDonor(id, organisationId);

    const data: Prisma.BloodBankDonorUpdateInput = {};
    if (params.bloodType !== undefined) data.bloodType = params.bloodType;
    if (params.lastScreeningAt !== undefined)
      data.lastScreeningAt = params.lastScreeningAt;
    if (params.lastDonationAt !== undefined)
      data.lastDonationAt = params.lastDonationAt;
    if (params.nextEligibleAt !== undefined)
      data.nextEligibleAt = params.nextEligibleAt;
    if (params.isActive !== undefined) data.isActive = params.isActive;
    if (params.totalDonations !== undefined)
      data.totalDonations = params.totalDonations;
    if (params.disqualificationReason !== undefined)
      data.disqualificationReason = params.disqualificationReason;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.bloodBankDonor.update({
      where: { id },
      data,
      select: donorSelect,
    });
  },

  // Donation / collection management
  async recordDonation(params: RecordDonationParams) {
    const { donorId, organisationId, collectedBy, crossmatchResults, ...rest } =
      params;

    await assertDonor(donorId, organisationId);

    const donation = await prisma.bloodDonationCollection.create({
      data: {
        donorId,
        organisationId,
        collectedAt: rest.collectedAt,
        collectedBy: collectedBy ?? null,
        volumeMl: rest.volumeMl,
        anticoagulant: rest.anticoagulant ?? null,
        unitId: rest.unitId ?? null,
        expiresAt: rest.expiresAt ?? null,
        crossmatchResults: crossmatchResults
          ? (crossmatchResults as unknown as Prisma.InputJsonValue)
          : undefined,
        notes: rest.notes ?? null,
      },
      select: donationSelect,
    });

    await prisma.bloodBankDonor.update({
      where: { id: donorId },
      data: {
        lastDonationAt: rest.collectedAt,
        totalDonations: { increment: 1 },
      },
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: "",
      eventType: "BLOOD_DONATION_COLLECTED",
      actorType: "PMS_USER",
      actorId: collectedBy ?? null,
      entityType: "COMPANION",
      entityId: donation.id,
      metadata: {
        donorId,
        volumeMl: rest.volumeMl,
        unitId: rest.unitId ?? null,
      },
    });

    return donation;
  },

  async getDonation(id: string, organisationId: string) {
    return assertDonation(id, organisationId);
  },

  async listDonations(params: ListDonationsParams) {
    const { organisationId, donorId, status } = params;
    return prisma.bloodDonationCollection.findMany({
      where: {
        organisationId,
        ...(donorId ? { donorId } : {}),
        ...(status ? { status } : {}),
      },
      select: donationSelect,
      orderBy: { collectedAt: "desc" },
    });
  },

  async updateDonation(
    id: string,
    organisationId: string,
    params: UpdateDonationParams,
  ) {
    await assertDonation(id, organisationId);

    const data: Prisma.BloodDonationCollectionUpdateInput = {};
    if (params.status !== undefined) data.status = params.status;
    if (params.crossmatchResults !== undefined)
      data.crossmatchResults =
        params.crossmatchResults as unknown as Prisma.InputJsonValue;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.bloodDonationCollection.update({
      where: { id },
      data,
      select: donationSelect,
    });
  },
};
