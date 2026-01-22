import Accordion from "@/app/components/Accordion/Accordion";
import {
  Permission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  RoleCode,
} from "@/app/utils/permissions";
import React from "react";

type PermissionRow = {
  key: string;
  label: string;
  view?: Permission[];
  edit?: Permission[];
  viewEnablePriority?: Permission[];
  editEnablePriority?: Permission[];
  viewLabel?: string;
  editLabel?: string;
};

const PERMISSION_ROWS: PermissionRow[] = [
  {
    key: "appointments",
    label: "Appointments",
    view: [
      PERMISSIONS.APPOINTMENTS_VIEW_ANY,
      PERMISSIONS.APPOINTMENTS_VIEW_OWN,
    ],
    edit: [
      PERMISSIONS.APPOINTMENTS_EDIT_ANY,
      PERMISSIONS.APPOINTMENTS_EDIT_OWN,
    ],
    viewEnablePriority: [
      PERMISSIONS.APPOINTMENTS_VIEW_ANY,
      PERMISSIONS.APPOINTMENTS_VIEW_OWN,
    ],
    editEnablePriority: [
      PERMISSIONS.APPOINTMENTS_EDIT_ANY,
      PERMISSIONS.APPOINTMENTS_EDIT_OWN,
    ],
  },
  {
    key: "prescriptions",
    label: "Prescriptions",
    view: [
      PERMISSIONS.PRESCRIPTION_VIEW_ANY,
      PERMISSIONS.PRESCRIPTION_VIEW_OWN,
    ],
    edit: [
      PERMISSIONS.PRESCRIPTION_EDIT_ANY,
      PERMISSIONS.PRESCRIPTION_EDIT_OWN,
    ],
    viewEnablePriority: [
      PERMISSIONS.PRESCRIPTION_VIEW_ANY,
      PERMISSIONS.PRESCRIPTION_VIEW_OWN,
    ],
    editEnablePriority: [
      PERMISSIONS.PRESCRIPTION_EDIT_ANY,
      PERMISSIONS.PRESCRIPTION_EDIT_OWN,
    ],
  },
  {
    key: "companions",
    label: "Companions",
    view: [PERMISSIONS.COMPANIONS_VIEW_ANY],
    edit: [PERMISSIONS.COMPANIONS_EDIT_ANY],
    viewEnablePriority: [PERMISSIONS.COMPANIONS_VIEW_ANY],
    editEnablePriority: [PERMISSIONS.COMPANIONS_EDIT_ANY],
  },
  {
    key: "tasks",
    label: "Tasks",
    view: [PERMISSIONS.TASKS_VIEW_ANY, PERMISSIONS.TASKS_VIEW_OWN],
    edit: [PERMISSIONS.TASKS_EDIT_ANY, PERMISSIONS.TASKS_EDIT_OWN],
    viewEnablePriority: [
      PERMISSIONS.TASKS_VIEW_ANY,
      PERMISSIONS.TASKS_VIEW_OWN,
    ],
    editEnablePriority: [
      PERMISSIONS.TASKS_EDIT_ANY,
      PERMISSIONS.TASKS_EDIT_OWN,
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    view: [PERMISSIONS.INVENTORY_VIEW_ANY],
    edit: [PERMISSIONS.INVENTORY_EDIT_ANY],
    viewEnablePriority: [PERMISSIONS.INVENTORY_VIEW_ANY],
    editEnablePriority: [PERMISSIONS.INVENTORY_EDIT_ANY],
  },
  {
    key: "forms",
    label: "Forms",
    view: [PERMISSIONS.FORMS_VIEW_ANY],
    edit: [PERMISSIONS.FORMS_EDIT_ANY],
    viewEnablePriority: [PERMISSIONS.FORMS_VIEW_ANY],
    editEnablePriority: [PERMISSIONS.FORMS_EDIT_ANY],
  },
  {
    key: "communication",
    label: "Communication",
    view: [PERMISSIONS.COMMUNICATION_VIEW_ANY],
    edit: [PERMISSIONS.COMMUNICATION_EDIT_ANY],
    viewEnablePriority: [PERMISSIONS.COMMUNICATION_VIEW_ANY],
    editEnablePriority: [PERMISSIONS.COMMUNICATION_EDIT_ANY],
  },
  {
    key: "teams",
    label: "Teams",
    view: [PERMISSIONS.TEAMS_VIEW_ANY],
    edit: [PERMISSIONS.TEAMS_EDIT_ANY],
    viewEnablePriority: [PERMISSIONS.TEAMS_VIEW_ANY],
    editEnablePriority: [PERMISSIONS.TEAMS_EDIT_ANY],
  },
  {
    key: "billing",
    label: "Billing",
    view: [PERMISSIONS.BILLING_VIEW_ANY],
    edit: [PERMISSIONS.BILLING_EDIT_ANY, PERMISSIONS.BILLING_EDIT_LIMITED],
    viewEnablePriority: [PERMISSIONS.BILLING_VIEW_ANY],
    editEnablePriority: [
      PERMISSIONS.BILLING_EDIT_ANY,
      PERMISSIONS.BILLING_EDIT_LIMITED,
    ],
    editLabel: "Edit (Any/Limited)",
  },
  {
    key: "subscription",
    label: "Subscriptions",
    view: [PERMISSIONS.SUBSCRIPTION_VIEW_ANY],
    edit: [PERMISSIONS.SUBSCRIPTION_EDIT_ANY],
    viewEnablePriority: [PERMISSIONS.SUBSCRIPTION_VIEW_ANY],
    editEnablePriority: [PERMISSIONS.SUBSCRIPTION_EDIT_ANY],
  },
  {
    key: "analytics",
    label: "Analytics",
    view: [PERMISSIONS.ANALYTICS_VIEW_ANY, PERMISSIONS.ANALYTICS_VIEW_CLINICAL],
    edit: [PERMISSIONS.ANALYTICS_EDIT_ANY],
    viewEnablePriority: [
      PERMISSIONS.ANALYTICS_VIEW_ANY,
      PERMISSIONS.ANALYTICS_VIEW_CLINICAL,
    ],
    editEnablePriority: [PERMISSIONS.ANALYTICS_EDIT_ANY],
    viewLabel: "View (Any/Clinical)",
  },
  {
    key: "audit",
    label: "Audit Logs",
    view: [PERMISSIONS.AUDIT_VIEW_ANY],
    viewEnablePriority: [PERMISSIONS.AUDIT_VIEW_ANY],
  },
  {
    key: "org",
    label: "Organization",
    view: [PERMISSIONS.ORG_VIEW],
    edit: [PERMISSIONS.ORG_EDIT],
    viewEnablePriority: [PERMISSIONS.ORG_VIEW],
    editEnablePriority: [PERMISSIONS.ORG_EDIT],
  },
  {
    key: "specialities",
    label: "Specialities",
    view: [PERMISSIONS.SPECIALITIES_VIEW_ANY],
    edit: [PERMISSIONS.SPECIALITIES_EDIT_ANY],
    viewEnablePriority: [PERMISSIONS.SPECIALITIES_VIEW_ANY],
    editEnablePriority: [PERMISSIONS.SPECIALITIES_EDIT_ANY],
  },
  {
    key: "rooms",
    label: "Rooms",
    view: [PERMISSIONS.ROOM_VIEW_ANY],
    edit: [PERMISSIONS.ROOM_EDIT_ANY],
    viewEnablePriority: [PERMISSIONS.ROOM_VIEW_ANY],
    editEnablePriority: [PERMISSIONS.ROOM_EDIT_ANY],
  },
  {
    key: "documents",
    label: "Documents",
    view: [PERMISSIONS.DOCUMENT_VIEW_ANY],
    edit: [PERMISSIONS.DOCUMENT_EDIT_ANY],
    viewEnablePriority: [PERMISSIONS.DOCUMENT_VIEW_ANY],
    editEnablePriority: [PERMISSIONS.DOCUMENT_EDIT_ANY],
  },
];

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function hasAny(perms: Permission[], candidates?: Permission[]) {
  if (!candidates?.length) return false;
  const set = new Set(perms);
  return candidates.some((p) => set.has(p));
}

function removeAll(perms: Permission[], candidates?: Permission[]) {
  if (!candidates?.length) return perms;
  const remove = new Set(candidates);
  return perms.filter((p) => !remove.has(p));
}

function pickEnablePermission(
  roleDefaults: Permission[],
  enablePriority?: Permission[],
): Permission | null {
  if (!enablePriority?.length) return null;
  const defaultsSet = new Set(roleDefaults);
  const fromDefaults = enablePriority.find((p) => defaultsSet.has(p));
  if (fromDefaults) return fromDefaults;
  return enablePriority[0] ?? null;
}

type PermissionsEditorProps = {
  role: RoleCode;
  value: Permission[];
  onChange: (next: Permission[]) => void;
};

const PermissionsEditor = ({
  value,
  onChange,
  role,
}: PermissionsEditorProps) => {
  const roleDefaults = React.useMemo(
    () => ROLE_PERMISSIONS[role] ?? [],
    [role],
  );

  const toggle = React.useCallback(
    (kind: "view" | "edit", row: PermissionRow, nextChecked: boolean) => {
      const candidates = kind === "view" ? row.view : row.edit;
      const priority =
        kind === "view" ? row.viewEnablePriority : row.editEnablePriority;
      if (!candidates?.length) return;
      if (!nextChecked) {
        onChange(removeAll(value, candidates));
        return;
      }
      const toAdd = pickEnablePermission(roleDefaults, priority);
      if (!toAdd) return;
      const cleaned = removeAll(value, candidates);
      onChange(uniq([...cleaned, toAdd]));
    },
    [onChange, roleDefaults, value],
  );

  const resetToRoleDefaults = React.useCallback(() => {
    onChange(uniq(roleDefaults));
  }, [onChange, roleDefaults]);

  return (
    <Accordion
      title="Permissions"
      defaultOpen={false}
      showEditIcon={false}
      isEditing={false}
    >
      <div className={""}>
        <div className="flex items-center justify-end pb-3">
          <div className="font-satoshi text-[18px] text-[#2b2b2a] font-medium hidden">
            Permissions
          </div>
          <button
            type="button"
            onClick={resetToRoleDefaults}
            className="text-caption-1 px-2 py-1.5 text-text-brand"
          >
            Reset to role defaults
          </button>
        </div>
        <div className="flex flex-col overflow-hidden">
          <div className="flex w-full items-center py-3 justify-between border-b border-b-grey-light px-2 bg-white">
            <div className="text-body-4 text-[#747473]">Permission</div>
            <div className="flex gap-10 items-center">
              <div className="text-body-4 text-[#747473] w-[72px] text-center">
                View
              </div>
              <div className="text-body-4 text-[#747473] w-[72px] text-center">
                Edit
              </div>
            </div>
          </div>
          {PERMISSION_ROWS.map((row) => {
            const viewChecked = hasAny(value, row.view);
            const editChecked = hasAny(value, row.edit);
            const viewDisabled = !row.view?.length;
            const editDisabled = !row.edit?.length;
            return (
              <div
                key={row.key}
                className="flex w-full items-center py-3 justify-between border-b border-b-grey-light px-2 bg-white last:border-b-0"
              >
                <div className="flex flex-col">
                  <div className="text-body-3 text-text-primary">
                    {row.label}
                  </div>
                </div>
                <div className="flex gap-10 items-center">
                  <div className="w-[72px] flex justify-center">
                    {viewDisabled ? (
                      <span className="text-[#c2c2c1]">—</span>
                    ) : (
                      <input
                        type="checkbox"
                        name={`${row.key}-view`}
                        checked={viewChecked}
                        onChange={(e) => toggle("view", row, e.target.checked)}
                        className="h-2 w-2"
                      />
                    )}
                  </div>
                  <div className="w-[72px] flex justify-center">
                    {editDisabled ? (
                      <span className="text-[#c2c2c1]">—</span>
                    ) : (
                      <input
                        type="checkbox"
                        name={`${row.key}-edit`}
                        checked={editChecked}
                        onChange={(e) => toggle("edit", row, e.target.checked)}
                        className="h-2 w-2"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Accordion>
  );
};

export default PermissionsEditor;
