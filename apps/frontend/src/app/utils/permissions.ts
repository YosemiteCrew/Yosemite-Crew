export const PERMISSIONS = {
  APPOINTMENTS_VIEW_ANY: "appointments:view:any",
  APPOINTMENTS_VIEW_OWN: "appointments:view:own",
  APPOINTMENTS_EDIT_ANY: "appointments:edit:any",
  APPOINTMENTS_EDIT_OWN: "appointments:edit:own",

  COMPANIONS_VIEW_ANY: "companions:view:any",
  COMPANIONS_VIEW_OWN: "companions:view:own",
  COMPANIONS_EDIT_ANY: "companions:edit:any",
  COMPANIONS_EDIT_OWN: "companions:edit:own",

  PROCEDURES_VIEW_ANY: "procedures:view:any",
  PROCEDURES_VIEW_OWN: "procedures:view:own",
  PROCEDURES_EDIT_ANY: "procedures:edit:any",
  PROCEDURES_EDIT_OWN: "procedures:edit:own",

  INVENTORY_VIEW_ANY: "inventory:view:any",
  INVENTORY_EDIT_ANY: "inventory:edit:any",

  FORMS_VIEW_ANY: "forms:view:any",
  FORMS_EDIT_ANY: "forms:edit:any",

  COMMUNICATION_VIEW_ANY: "communication:view:any",
  COMMUNICATION_EDIT_ANY: "communication:edit:any",

  TEAMS_VIEW_ANY: "teams:view:any",
  TEAMS_EDIT_ANY: "teams:edit:any",

  BILLING_VIEW_ANY: "billing:view:any",
  BILLING_EDIT_ANY: "billing:edit:any",
  BILLING_EDIT_LIMITED: "billing:edit:limited",

  ANALYTICS_VIEW_ANY: "analytics:view:any",
  ANALYTICS_EDIT_ANY: "analytics:edit:any",
  ANALYTICS_VIEW_CLINICAL: "analytics:view:clinical",

  AUDIT_VIEW_ANY: "audit:view:any",

  ORG_DELETE: "org:delete",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = new Set<Permission>(
  Object.values(PERMISSIONS) as Permission[]
);

export function toPermissionArray(input: string[] | undefined): Permission[] {
  if (!input) {
    return [];
  }
  return input.filter((p): p is Permission =>
    ALL_PERMISSIONS.has(p as Permission)
  );
}

export type RoleCode =
  | "OWNER"
  | "ADMIN"
  | "SUPERVISOR"
  | "VETERINARIAN"
  | "TECHNICIAN"
  | "ASSISTANT"
  | "RECEPTIONIST";

/**
 * Baseline permissions per role.
 * This is just your table converted into permission strings.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  OWNER: [
    "appointments:view:any",
    "appointments:edit:any",

    "companions:view:any",
    "companions:edit:any",

    "procedures:view:any",
    "procedures:edit:any",

    "inventory:view:any",
    "inventory:edit:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "teams:view:any",
    "teams:edit:any",

    "billing:view:any",
    "billing:edit:any",

    "analytics:view:any",
    "analytics:edit:any",

    "audit:view:any",

    "org:delete",
  ],

  ADMIN: [
    "appointments:view:any",
    "appointments:edit:any",

    "companions:view:any",
    "companions:edit:any",

    "procedures:view:any",
    "procedures:edit:any",

    "inventory:view:any",
    "inventory:edit:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "teams:view:any",
    "teams:edit:any",

    "billing:view:any",
    "billing:edit:any",

    "analytics:view:any",
    "analytics:edit:any",

    "audit:view:any",
    // no org:delete
  ],

  SUPERVISOR: [
    "appointments:view:any",
    "appointments:edit:any",

    "companions:view:any",
    "companions:edit:any",

    "procedures:view:any",
    "procedures:edit:any",

    "inventory:view:any",
    "inventory:edit:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "teams:view:any",

    "billing:view:any",
    "billing:edit:any",

    "analytics:view:any",
    "analytics:edit:any",

    "audit:view:any",
  ],

  VETERINARIAN: [
    // own appointments
    "appointments:view:own",
    "appointments:edit:own",

    "companions:view:any",
    "companions:edit:any",

    "procedures:view:any",
    "procedures:edit:any",

    "inventory:view:any",
    "inventory:edit:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "billing:view:any",
    "billing:edit:limited",

    "analytics:view:clinical",
    "audit:view:any",
  ],

  TECHNICIAN: [
    "appointments:view:any",
    "appointments:edit:any",

    "companions:view:any",
    "companions:edit:any",

    "procedures:view:any",
    "procedures:edit:any",

    "inventory:view:any",
    "inventory:edit:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "billing:view:any",
    "billing:edit:any",

    "analytics:view:any",
    // no audit
  ],

  ASSISTANT: [
    "appointments:view:any",
    "appointments:edit:any",

    "companions:view:any",
    "companions:edit:any",

    "procedures:view:any",

    "inventory:view:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "billing:view:any",

    "analytics:view:any",
    // no audit, no teams
  ],

  RECEPTIONIST: [
    "appointments:view:any",
    "appointments:edit:any",

    "companions:view:any",

    "procedures:view:any",

    "inventory:view:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "billing:view:any",
    "billing:edit:any",

    "analytics:view:any",
    // no audit, no teams
  ],
};
