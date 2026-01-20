import { RoleCode } from "./permissions";

export const allowDelete = (role: RoleCode) => {
  if (role === "OWNER") {
    return false;
  }
  return true;
};
