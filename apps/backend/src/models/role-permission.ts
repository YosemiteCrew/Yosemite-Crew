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
  // Task
  | "tasks:view:any"
  | "tasks:edit:any"
  | "tasks:view:own"
  | "tasks:edit:own"
  //Prescription
  | "prescription:view:any"
  | "prescription:view:own"
  | "prescription:edit:any"
  | "prescription:edit:own"
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
  // Speciality
  | "specialities:view:any"
  | "specialities:edit:any"
  // Room
  | "room:view:any"
  | "room:edit:any"
  // Documents
  | "document:view:any"
  | "document:edit:any"
  // Org-level
  | "subscription:view:any"
  | "subscription:edit:any"
  | "org:onboarding"
  | "org:view"
  | "org:edit"
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