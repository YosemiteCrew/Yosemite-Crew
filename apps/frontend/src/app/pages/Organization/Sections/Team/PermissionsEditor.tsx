import Accordion from "@/app/components/Accordion/Accordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import {
  Permission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  RoleCode,
} from "@/app/utils/permissions";
import React, { useEffect } from "react";

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

export function uniq<T>(arr: T[]) {
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

export function computeEffectivePermissions(args: {
  role: RoleCode;
  extraPerissions?: Permission[]; // keep your backend spelling
  revokedPermissions?: Permission[];
}): Permission[] {
  const roleDefaults = ROLE_PERMISSIONS[args.role] ?? [];
  const extra = args.extraPerissions ?? [];
  const revoked = args.revokedPermissions ?? [];

  const revokedSet = new Set(revoked);
  return uniq([...roleDefaults, ...extra]).filter((p) => !revokedSet.has(p));
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

function samePermissionSet(a: Permission[], b: Permission[]) {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  for (const p of b) if (!aSet.has(p)) return false;
  return true;
}

function computeSavePayload(draft: Permission[], roleDefaults: Permission[]) {
  const draftSet = new Set(draft);
  const defaultsSet = new Set(roleDefaults);

  const extraPerissions = draft.filter((p) => !defaultsSet.has(p));
  const revokedPermissions = roleDefaults.filter((p) => !draftSet.has(p));

  return {
    extraPerissions: uniq(extraPerissions),
    revokedPermissions: uniq(revokedPermissions),
  };
}

type PermissionsEditorProps = {
  role: RoleCode;
  value: Permission[];
  onSave: (payload: {
    extraPerissions: Permission[];
    revokedPermissions: Permission[];
  }) => Promise<void> | void;
};

const PermissionsEditor = ({ value, onSave, role }: PermissionsEditorProps) => {
  const roleDefaults = React.useMemo(
    () => ROLE_PERMISSIONS[role] ?? [],
    [role],
  );

  const [draft, setDraft] = React.useState<Permission[]>(value);
  const [saving, setSaving] = React.useState(false);

  // reset draft when member/value changes (or role changes)
  useEffect(() => {
    setDraft(value);
  }, [value, role]);

  const isDirty = React.useMemo(
    () => !samePermissionSet(draft, value),
    [draft, value],
  );

  const toggle = React.useCallback(
    (kind: "view" | "edit", row: PermissionRow, nextChecked: boolean) => {
      setDraft((prev) => {
        const viewCandidates = row.view ?? [];
        const editCandidates = row.edit ?? [];

        // ✅ Rule: turning VIEW off also turns EDIT off
        if (!nextChecked && kind === "view") {
          return removeAll(prev, uniq([...viewCandidates, ...editCandidates]));
        }

        const candidates = kind === "view" ? viewCandidates : editCandidates;
        const priority =
          kind === "view" ? row.viewEnablePriority : row.editEnablePriority;

        if (!candidates.length) return prev;

        // Uncheck => remove all in that group
        if (!nextChecked) {
          return removeAll(prev, candidates);
        }

        // Check => remove conflicts in that group, add the chosen permission
        const toAdd = pickEnablePermission(roleDefaults, priority);
        if (!toAdd) return prev;

        let next = uniq([...removeAll(prev, candidates), toAdd]);

        // ✅ Rule: turning EDIT on also turns VIEW on
        if (
          kind === "edit" &&
          viewCandidates.length &&
          !hasAny(next, viewCandidates)
        ) {
          const viewToAdd = pickEnablePermission(
            roleDefaults,
            row.viewEnablePriority ?? viewCandidates,
          );
          if (viewToAdd) next = uniq([...next, viewToAdd]);
        }

        return next;
      });
    },
    [roleDefaults],
  );

  const resetToRoleDefaults = React.useCallback(() => {
    setDraft(uniq(roleDefaults));
  }, [roleDefaults]);

  const cancelChanges = React.useCallback(() => {
    setDraft(value);
  }, [value]);

  const saveChanges = React.useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = computeSavePayload(draft, roleDefaults);
      await onSave(payload);
      // parent should update `value` after save (refetch or optimistic),
      // but we also keep draft as-is; effect will sync when value changes
    } finally {
      setSaving(false);
    }
  }, [draft, onSave, roleDefaults, saving]);

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
            const viewChecked = hasAny(draft, row.view);
            const editChecked = hasAny(draft, row.edit);
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
        {isDirty && (
          <div className="flex w-full gap-3 mt-6">
            <Secondary
              text="Cancel"
              onClick={cancelChanges}
              href="#"
              isDisabled={saving}
              className="w-full"
            />
            <Primary
              onClick={saveChanges}
              isDisabled={saving}
              href="#"
              classname="w-full"
              text={saving ? "Saving..." : "Save"}
            />
          </div>
        )}
      </div>
    </Accordion>
  );
};

export default PermissionsEditor;
