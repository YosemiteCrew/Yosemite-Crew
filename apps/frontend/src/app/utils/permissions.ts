export const PERMISSIONS = {
  APPOINTMENTS_VIEW_ANY: "appointments:view:any",
  APPOINTMENTS_VIEW_OWN: "appointments:view:own",
  APPOINTMENTS_EDIT_ANY: "appointments:edit:any",
  APPOINTMENTS_EDIT_OWN: "appointments:edit:own",

  PRESCRIPTION_VIEW_ANY: "prescription:view:any",
  PRESCRIPTION_VIEW_OWN: "prescription:view:own",
  PRESCRIPTION_EDIT_ANY: "prescription:edit:any",
  PRESCRIPTION_EDIT_OWN: "prescription:edit:own",

  COMPANIONS_VIEW_ANY: "companions:view:any",
  COMPANIONS_EDIT_ANY: "companions:edit:any",

  TASKS_VIEW_ANY: "tasks:view:any",
  TASKS_VIEW_OWN: "tasks:view:own",
  TASKS_EDIT_ANY: "tasks:edit:any",
  TASKS_EDIT_OWN: "tasks:edit:own",

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

  SUBSCRIPTION_VIEW_ANY: "subscription:view:any",
  SUBSCRIPTION_EDIT_ANY: "subscription:edit:any",

  ANALYTICS_VIEW_ANY: "analytics:view:any",
  ANALYTICS_EDIT_ANY: "analytics:edit:any",
  ANALYTICS_VIEW_CLINICAL: "analytics:view:clinical",

  AUDIT_VIEW_ANY: "audit:view:any",

  ORG_DELETE: "org:delete",
  ORG_ONBOARDING: "org:onboarding",
  ORG_VIEW: "org:view",
  ORG_EDIT: "org:edit",

  SPECIALITIES_VIEW_ANY: "specialities:view:any",
  SPECIALITIES_EDIT_ANY: "specialities:edit:any",

  ROOM_VIEW_ANY: "room:view:any",
  ROOM_EDIT_ANY: "room:edit:any",

  DOCUMENT_VIEW_ANY: "document:view:any",
  DOCUMENT_EDIT_ANY: "document:edit:any",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = new Set<Permission>(
  Object.values(PERMISSIONS) as Permission[],
);

export function toPermissionArray(input: string[] | undefined): Permission[] {
  if (!input) {
    return [];
  }
  return input.filter((p): p is Permission =>
    ALL_PERMISSIONS.has(p as Permission),
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
    "appointments:view:own",
    "appointments:edit:any",
    "appointments:edit:own",

    "prescription:view:any",
    "prescription:view:own",
    "prescription:edit:any",
    "prescription:edit:own",

    "companions:view:any",
    "companions:edit:any",

    "tasks:view:any",
    "tasks:view:own",
    "tasks:edit:any",
    "tasks:edit:own",

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
    "billing:edit:limited",

    "subscription:view:any",
    "subscription:edit:any",

    "analytics:view:any",
    "analytics:edit:any",
    "analytics:view:clinical",

    "audit:view:any",

    "org:delete",
    "org:onboarding",
    "org:view",
    "org:edit",

    "specialities:view:any",
    "specialities:edit:any",

    "room:view:any",
    "room:edit:any",

    "document:view:any",
    "document:edit:any",
  ],

  ADMIN: [
    "appointments:view:any",
    "appointments:view:own",
    "appointments:edit:any",
    "appointments:edit:own",

    "prescription:view:any",
    "prescription:view:own",
    "prescription:edit:any",
    "prescription:edit:own",

    "companions:view:any",
    "companions:edit:any",

    "tasks:view:any",
    "tasks:view:own",
    "tasks:edit:any",
    "tasks:edit:own",

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
    "billing:edit:limited",

    "subscription:view:any",

    "analytics:view:any",
    "analytics:edit:any",
    "analytics:view:clinical",

    "audit:view:any",

    "org:view",
    "org:edit",

    "specialities:view:any",
    "specialities:edit:any",

    "room:view:any",
    "room:edit:any",

    "document:view:any",
    "document:edit:any",
  ],

  SUPERVISOR: [
    "appointments:view:any",
    "appointments:view:own",
    "appointments:edit:any",
    "appointments:edit:own",

    "prescription:view:any",
    "prescription:view:own",
    "prescription:edit:any",
    "prescription:edit:own",

    "companions:view:any",
    "companions:edit:any",

    "tasks:view:any",
    "tasks:view:own",
    "tasks:edit:any",
    "tasks:edit:own",

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
    "billing:edit:limited",

    "analytics:view:any",
    "analytics:edit:any",
    "analytics:view:clinical",

    "audit:view:any",

    "org:view",

    "specialities:view:any",
    "specialities:edit:any",

    "room:view:any",
    "room:edit:any",

    "document:view:any",
    "document:edit:any",
  ],

  VETERINARIAN: [
    "appointments:view:any",
    "appointments:view:own",
    "appointments:edit:own",
    "appointments:edit:any",

    "prescription:view:any",
    "prescription:view:own",
    "prescription:edit:own",

    "companions:view:any",
    "companions:edit:any",

    "tasks:view:any",
    "tasks:view:own",
    "tasks:edit:any",
    "tasks:edit:own",

    "inventory:view:any",
    "inventory:edit:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "teams:view:any",

    "billing:view:any",
    "billing:edit:any",
    "billing:edit:limited",

    "analytics:view:any",
    "analytics:view:clinical",

    "specialities:view:any",
    "specialities:edit:any",

    "room:view:any",
    "room:edit:any",

    "document:view:any",
  ],

  TECHNICIAN: [
    "appointments:view:any",
    "appointments:view:own",
    "appointments:edit:own",
    "appointments:edit:any",

    "prescription:view:any",
    "prescription:view:own",
    "prescription:edit:own",

    "companions:view:any",
    "companions:edit:any",

    "tasks:view:any",
    "tasks:view:own",
    "tasks:edit:any",
    "tasks:edit:own",

    "inventory:view:any",
    "inventory:edit:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "teams:view:any",

    "billing:view:any",
    "billing:edit:any",
    "billing:edit:limited",

    "specialities:view:any",
    "specialities:edit:any",

    "room:view:any",
    "room:edit:any",

    "document:view:any",
  ],

  ASSISTANT: [
    "appointments:view:any",
    "appointments:view:own",
    "appointments:edit:own",
    "appointments:edit:any",

    "prescription:view:any",
    "prescription:view:own",
    "prescription:edit:own",

    "companions:view:any",
    "companions:edit:any",

    "tasks:view:any",
    "tasks:view:own",
    "tasks:edit:any",
    "tasks:edit:own",

    "inventory:view:any",
    "inventory:edit:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "teams:view:any",

    "billing:view:any",
    "billing:edit:any",
    "billing:edit:limited",

    "specialities:view:any",
    "specialities:edit:any",

    "room:view:any",
    "room:edit:any",

    "document:view:any",
  ],

  RECEPTIONIST: [
    "appointments:view:any",
    "appointments:view:own",
    "appointments:edit:any",
    "appointments:edit:own",

    "prescription:view:any",
    "prescription:view:own",

    "companions:view:any",
    "companions:edit:any",

    "tasks:view:any",
    "tasks:view:own",
    "tasks:edit:any",
    "tasks:edit:own",

    "inventory:view:any",
    "inventory:edit:any",

    "forms:view:any",
    "forms:edit:any",

    "communication:view:any",
    "communication:edit:any",

    "teams:view:any",

    "billing:view:any",
    "billing:edit:any",
    "billing:edit:limited",

    "analytics:view:any",
    "analytics:view:clinical",

    "specialities:view:any",
    "specialities:edit:any",

    "room:view:any",
    "room:edit:any",

    "document:view:any",
  ],
};
