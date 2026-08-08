import { prisma } from "src/config/prisma";
import { AuthUserMobileService } from "src/services/authUserMobile.service";

type ParentAddress = {
  city?: string | null;
  postalCode?: string | null;
};

export const getParentAddressForAuthUser = async (
  authUserId: string | null | undefined,
): Promise<ParentAddress | null | undefined> => {
  if (!authUserId) {
    return null;
  }

  const authUser = await AuthUserMobileService.getByProviderUserId(authUserId);

  const parentId = authUser?.parentId ?? null;
  const parent = parentId
    ? await prisma.parent.findFirst({
        where: { id: parentId },
        include: { address: true },
      })
    : null;
  return parent?.address ?? null;
};
