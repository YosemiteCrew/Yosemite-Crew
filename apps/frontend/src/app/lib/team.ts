import { RoleCode } from "@/app/lib/permissions";

export const allowDelete = (role: RoleCode) => {
  if (role === "OWNER") {
    return false;
  }
  return true;
};
