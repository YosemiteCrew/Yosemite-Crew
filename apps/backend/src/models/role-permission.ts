// src/rbac/permissions.ts

export type Permission =
  // Appointments / Scheduling
  | "appointments:view:any"
  | "appointments:view:own"
  | "appointments:edit:any"
  | "appointments:edit:own"
  // Companions / Medical Records
  | "companions:view:any"
  | "companions:edit:any"
  | "companions:view:own"
  | "companions:edit:own"
  // Procedures / Diagnostics
  | "procedures:view:any"
  | "procedures:edit:any"
  | "procedures:view:own"
  | "procedures:edit:own"
  // Inventory
  | "inventory:view:any"
  | "inventory:edit:any"
  // Forms / Consents / Reports
  | "forms:view:any"
  | "forms:edit:any"
  // Communication
  | "communication:view:any"
  | "communication:edit:any"
  // Teams & Roles
  | "teams:view:any"
  | "teams:edit:any"
  // Finance & Billing
  | "billing:view:any"
  | "billing:edit:any"
  | "billing:edit:limited"
  // Analytics & Reports
  | "analytics:view:any"
  | "analytics:edit:any"
  | "analytics:view:clinical"
  // Compliance / Audit
  | "audit:view:any"
  // Org-level
  | "org:delete";

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
