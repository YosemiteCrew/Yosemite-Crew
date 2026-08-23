import { prisma } from "@yosemite-crew/database";

type VerifiableOrg = {
  verificationOverride: boolean | null;
  healthAndSafetyCertNo: string | null;
  animalWelfareComplianceCertNo: string | null;
  fireAndEmergencyCertNo: string | null;
};

/**
 * A business is considered compliant once it has recorded at least one
 * regulatory certificate number.
 */
export function hasComplianceCertificate(org: VerifiableOrg): boolean {
  return Boolean(
    org.healthAndSafetyCertNo ??
    org.animalWelfareComplianceCertNo ??
    org.fireAndEmergencyCertNo,
  );
}

/**
 * Effective verification state. A manual override set by the verification
 * authority always wins; otherwise it is derived from an active Stripe Connect
 * account (able to accept payments) plus at least one compliance certificate.
 */
export function computeIsVerified(
  org: VerifiableOrg,
  canAcceptPayments: boolean,
): boolean {
  if (org.verificationOverride !== null) {
    return org.verificationOverride;
  }
  return canAcceptPayments && hasComplianceCertificate(org);
}

/**
 * Recomputes and persists Organization.isVerified from the current Stripe
 * Connect status and compliance certificates, honouring any manual override.
 * Safe to call from webhook, org-update, and override paths. Returns the
 * effective value, or null when the organisation does not exist.
 */
export async function recomputeOrganizationVerification(
  orgId: string,
): Promise<boolean | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      verificationOverride: true,
      healthAndSafetyCertNo: true,
      animalWelfareComplianceCertNo: true,
      fireAndEmergencyCertNo: true,
    },
  });
  if (!org) return null;

  const billing = await prisma.organizationBilling.findUnique({
    where: { orgId },
    select: { canAcceptPayments: true },
  });

  const isVerified = computeIsVerified(
    org,
    billing?.canAcceptPayments ?? false,
  );
  await prisma.organization.update({
    where: { id: orgId },
    data: { isVerified },
  });
  return isVerified;
}
