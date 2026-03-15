import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import { ParentModel } from "src/models/parent";
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

  if (isReadFromPostgres()) {
    const parentId =
      typeof authUser?.parentId === "string"
        ? authUser.parentId
        : authUser?.parentId?.toString();
    const parent = parentId
      ? await prisma.parent.findFirst({
          where: { id: parentId },
          include: { address: true },
        })
      : null;
    return parent?.address ?? null;
  }

  const parent = await ParentModel.findById(authUser?.parentId);
  return parent?.address;
};
