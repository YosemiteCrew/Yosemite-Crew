import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import { OrgBilling } from "src/models/organization.billing";

type OrgId = string | { toString(): string } | null | undefined;

export const getOrgBillingCurrency = async (orgId: OrgId) => {
  if (!orgId) return "usd";

  if (isReadFromPostgres()) {
    const id = typeof orgId === "string" ? orgId : orgId.toString();
    const billing = await prisma.organizationBilling.findUnique({
      where: { orgId: id },
      select: { currency: true },
    });
    return billing?.currency ?? "usd";
  }

  const billing = await OrgBilling.findOne({
    orgId,
  });
  return billing?.currency ?? "usd";
};
