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