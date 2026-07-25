export interface UserOrganizationMongo {
  fhirId?: string;
  practitionerReference: string;
  organizationReference: string;
  roleCode: string;
  roleDisplay?: string;
  active: boolean;
  extraPermissions?: string[];
  revokedPermissions?: string[];
  effectivePermissions?: string[];
}

export type UserOrganizationDocument = UserOrganizationMongo & {
  _id: string;
};
