import React, { useEffect, useMemo, useState } from 'react';
import { LuPrinter, LuSave } from 'react-icons/lu';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import ServicesPackagesEditor from '@/app/features/appointments/pages/AppointmentWorkspace/components/ServicesPackagesEditor';
import PrescriptionEditor from '@/app/features/appointments/pages/AppointmentWorkspace/components/PrescriptionEditor';
import InpatientSchedule from '@/app/features/appointments/pages/AppointmentWorkspace/components/InpatientSchedule';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  AppointmentEncounter,
  ScheduleTask,
  ScheduleTaskStatus,
} from '@/app/features/appointments/types/workspace';
import {
  deletePrescriptionArtifact,
  savePrescriptionArtifact,
} from '@/app/features/appointments/services/workspaceClinicalService';
import { finalizePrescription } from '@/app/features/appointments/services/prescriptionWorkflowService';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import { fetchPrescriptionLabelPdf } from '@/app/features/inventory/services/dispensaryService';
import {
  deletePrescriptionTreatmentItem,
  getAppointmentWorkspaceBootstrap,
  normalizeWorkspaceBootstrapForEncounter,
  persistTreatmentItems,
} from '@/app/features/appointments/services/workspaceAggregateService';
import { mapApiItemToInventoryItem } from '@/app/features/inventory/pages/Inventory/utils';
import {
  backfillPrescriptionFromInventory,
  DEFAULT_DURATION_UNIT,
  getPrescriptionSaveErrors,
  inventoryToPrescriptionItem,
} from '@/app/features/appointments/lib/inventoryPrescription';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { useTaskStore } from '@/app/stores/taskStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import {
  changeTaskStatus,
  createTask,
  loadTasksForPrimaryOrg,
  updateTask,
} from '@/app/features/tasks/services/taskService';
import type { Task } from '@/app/features/tasks/types/task';
import {
  categoryFromLabel,
  getTaskCategoryLabel,
} from '@/app/features/tasks/constants/taskTaxonomy';
import { useLoadTeam, useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  getInpatientScheduleForEncounter,
  listPrescriptionTemplatesForWorkspace,
  listScheduleTaskTemplates,
  resolvePrescriptionTemplate,
  resolveScheduleTasksFromTemplate,
} from '@/app/features/appointments/services/workspaceTemplateService';
import { formatStampTime } from '@/app/lib/appointmentWorkspace';
import type { PrescriptionTemplateOption } from '@/app/features/appointments/services/workspaceTemplateService';
import type { TemplateLike } from '@yosemite-crew/types';
import type {
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
} from '@/app/features/organization/types/revamp';
import {
  computePackageBreakdownItem,
  computePackageTotals,
} from '@/app/features/organization/services/catalogCalculations';

type TreatmentStepProps = {
  appointmentId: string;
  organisationId?: string;
  encounterId?: string;
  authorId?: string;
  encounter: AppointmentEncounter;
  /** Resolve (creating via check-in if needed) the encounter id for clinical persistence. */
  ensureEncounterId?: () => Promise<string | undefined>;
  onOpenInvoice: () => void;
};

const PRESCRIPTION_INVENTORY_CATEGORIES = new Set([
  'medicine',
  'vaccine',
  'supplement',
  'iv/fluid therapy',
]);

const moneyToCents = (amount: number): number => Math.max(0, Math.round(amount * 100));

const discountCentsFromPercent = (grossCents: number, percent: number): number =>
  Math.min(grossCents, Math.round((grossCents * percent) / 100));

const breakdownToLineItem = (item: PackageBreakdownItem) => {
  const { gross, discountAmt, net } = computePackageBreakdownItem(item);
  return {
    id: item.id,
    name: item.name,
    qty: item.quantity,
    instructions: item.type,
    unitPriceCents: moneyToCents(item.unitPrice),
    grossCents: moneyToCents(gross),
    discountPercent: item.discount,
    discountCents: moneyToCents(discountAmt),
    amountCents: moneyToCents(net),
  };
};

const serviceToLineItem = (service: ServiceRevamp) => {
  const grossCents = moneyToCents(service.grossAmount);
  const defaultDiscountPercent = service.defaultDiscount ?? 0;
  const maxDiscountPercent = service.maxDiscount ?? 0;
  const defaultDiscountCents = discountCentsFromPercent(grossCents, defaultDiscountPercent);
  return {
    refId: service.id,
    kind: 'SERVICE' as const,
    name: service.name,
    qty: 1,
    instructions: service.description || service.type,
    unitPriceCents: grossCents,
    amountCents: grossCents - defaultDiscountCents,
    defaultDiscountPercent,
    defaultDiscountCents,
    maxDiscountPercent,
    maxDiscountCents: discountCentsFromPercent(grossCents, maxDiscountPercent),
  };
};

const packageToLineItem = (pkg: PackageRevamp) => {
  const { additionalDiscountAmt, afterItemDiscounts, totalCost } = computePackageTotals(pkg);
  const grossCents = moneyToCents(afterItemDiscounts);
  const defaultDiscountPercent = pkg.additionalDiscount ?? 0;
  const defaultDiscountCents = moneyToCents(additionalDiscountAmt);
  return {
    refId: pkg.id,
    kind: 'PACKAGE' as const,
    name: pkg.name,
    qty: 1,
    instructions: pkg.description || `Package with ${pkg.breakdown.length} item(s)`,
    unitPriceCents: grossCents,
    amountCents: moneyToCents(totalCost),
    defaultDiscountPercent,
    defaultDiscountCents,
    maxDiscountPercent: defaultDiscountPercent,
    maxDiscountCents: defaultDiscountCents,
    breakdown: pkg.breakdown.map(breakdownToLineItem),
  };
};

// Workspace task loads must include COMPLETED tasks: the backend list excludes
// them by default, which would make completed schedule rows vanish on refresh.
const WORKSPACE_TASK_LOAD = { force: true, silent: true, filters: { includeCompleted: true } };

const taskStatusToScheduleStatus = (status: Task['status']) => {
  if (status === 'COMPLETED') return 'COMPLETED' as const;
  if (status === 'CANCELLED') return 'CANCELLED' as const;
  if (status === 'IN_PROGRESS') return 'UPCOMING' as const;
  return 'PENDING' as const;
};

const scheduleStatusToTaskStatus = (status: ScheduleTaskStatus): Task['status'] => {
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'UPCOMING') return 'IN_PROGRESS';
  return 'PENDING';
};

// Combine a schedule task's start date ("MMM d, yyyy" or ISO) and "h:mm AM/PM"
// time into a single Date for the backend `dueAt`. Returns null when the date is
// unparseable so the caller can keep the existing value.
const combineScheduleDateTime = (startDate?: string, time?: string): Date | null => {
  if (!startDate) return null;
  const base = new Date(startDate);
  if (Number.isNaN(base.getTime())) return null;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time ?? '').trim());
  if (match) {
    let hours = Number(match[1]) % 12;
    if (match[3].toUpperCase() === 'PM') hours += 12;
    base.setHours(hours, Number(match[2]), 0, 0);
  }
  return base;
};

/** "h:mm AM/PM" from a Date for the schedule timeline column. */
const dueTimeLabel = (dueAt?: Date): string | undefined => {
  if (!dueAt) return undefined;
  const date = new Date(dueAt);
  return Number.isNaN(date.getTime()) ? undefined : formatStampTime(date.toISOString());
};

const taskToScheduleTask = (task: Task): ScheduleTask => ({
  id: task._id,
  description: task.name || task.description || 'Task',
  // Instructions render as the grey second line under the title.
  subtext: task.name ? task.description : undefined,
  // Schedule rows display the human category label; task.category is a code.
  category: getTaskCategoryLabel(task.category) as ScheduleTask['category'],
  assignedToId: task.assignedTo,
  status: taskStatusToScheduleStatus(task.status),
  time: dueTimeLabel(task.dueAt),
  startDate: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : undefined,
  autoGenerated: task.source !== 'CUSTOM',
  sourceRefId: task.templateId || task.libraryTaskId,
});

/**
 * Treatment step: services/packages, prescription, and inpatient schedule.
 * Add/edit actions update the workspace store; backend-backed catalog and
 * clinical artifact hydration supply persisted rows. "Skip to Summary" lives
 * in the meta bar.
 */
const TreatmentStep = ({
  appointmentId,
  organisationId,
  encounterId,
  authorId,
  encounter,
  ensureEncounterId,
  onOpenInvoice,
}: TreatmentStepProps) => {
  const addLineItem = useAppointmentWorkspaceStore((s) => s.addLineItem);
  const updateLineItem = useAppointmentWorkspaceStore((s) => s.updateLineItem);
  const removeLineItem = useAppointmentWorkspaceStore((s) => s.removeLineItem);
  const addPrescription = useAppointmentWorkspaceStore((s) => s.addPrescription);
  const updatePrescription = useAppointmentWorkspaceStore((s) => s.updatePrescription);
  const setPrescriptions = useAppointmentWorkspaceStore((s) => s.setPrescriptions);
  const removePrescription = useAppointmentWorkspaceStore((s) => s.removePrescription);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const mergeEncounterData = useAppointmentWorkspaceStore((s) => s.mergeEncounterData);
  const setActiveSideAction = useAppointmentWorkspaceStore((s) => s.setActiveSideAction);
  const openTaskInQuickActions = useAppointmentWorkspaceStore((s) => s.openTaskInQuickActions);
  const itemIdsByOrgId = useInventoryStore((s) => s.itemIdsByOrgId);
  const inventoryById = useInventoryStore((s) => s.itemsById);
  const setInventoryForOrg = useInventoryStore((s) => s.setInventoryForOrg);
  const tasksById = useTaskStore((s) => s.tasksById);
  const upsertTask = useTaskStore((s) => s.upsertTask);
  useLoadTeam();
  const teamMembers = useTeamForPrimaryOrg();
  const catalogSpecialities = useRevampCatalogStore((s) => s.specialities);
  const catalogServices = useRevampCatalogStore((s) => s.services);
  const catalogPackages = useRevampCatalogStore((s) => s.packages);
  const loadOrganisationCatalog = useRevampCatalogStore((s) => s.loadOrganisationCatalog);
  const loadSpecialityCatalog = useRevampCatalogStore((s) => s.loadSpecialityCatalog);
  const hydratePackageDetail = useRevampCatalogStore((s) => s.hydratePackageDetail);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [printingLabels, setPrintingLabels] = useState(false);
  const [scheduleTemplates, setScheduleTemplates] = useState<TemplateLike[]>([]);
  const [prescriptionTemplates, setPrescriptionTemplates] = useState<PrescriptionTemplateOption[]>(
    []
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [treatmentSaveError, setTreatmentSaveError] = useState<string | null>(null);
  const [isSavingTreatment, setIsSavingTreatment] = useState(false);
  const readOnly = encounter.viewOnly;
  // Once the encounter is ready for billing, destructive removal of un-billed
  // items is locked. Already-billed items lock per-row inside each editor (read
  // -only + "Billed" badge + no delete); adding new items always stays allowed.
  const billedTreatmentLocked = readOnly || encounter.readyForBilling.value;
  const isInpatient = encounter.mode === 'INPATIENT';
  const inventoryIds = useMemo(
    () => (organisationId ? (itemIdsByOrgId[organisationId] ?? []) : []),
    [itemIdsByOrgId, organisationId]
  );
  const catalogSpecialityIds = useMemo(
    () =>
      organisationId
        ? catalogSpecialities
            .filter((speciality) => speciality.organisationId === organisationId)
            .map((speciality) => speciality.id)
        : [],
    [catalogSpecialities, organisationId]
  );
  const catalogSpecialityKey = catalogSpecialityIds.join('|');
  const appointmentEmployeeTasks = useMemo(
    () =>
      Object.values(tasksById)
        .filter((task) => task.appointmentId === appointmentId && task.audience === 'EMPLOYEE_TASK')
        .map(taskToScheduleTask),
    [appointmentId, tasksById]
  );
  // The task store is the single source of truth for schedule tasks: every row is
  // a real backend employee task, so the Schedule timeline and the Quick Actions
  // Tasks panel always stay in sync and no local-only duplicates can appear.
  const visibleScheduleTasks = appointmentEmployeeTasks;

  // Real staff available to own a schedule task: active org team members, plus
  // the encounter's own lead/support so they are always selectable even if the
  // team list hasn't loaded yet. De-duped by value.
  const assigneeOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    const add = (value?: string, label?: string) => {
      const id = (value ?? '').trim();
      const name = (label ?? '').trim();
      if (!id || !name || seen.has(id)) return;
      seen.add(id);
      options.push({ value: id, label: name });
    };
    teamMembers
      .filter((member) => member.status !== 'Off-Duty')
      .forEach((member) => add(member.practionerId || member._id, member.name));
    add(encounter.leadId, encounter.leadName);
    add(encounter.nurseId, encounter.nurseName);
    return options;
  }, [teamMembers, encounter.leadId, encounter.leadName, encounter.nurseId, encounter.nurseName]);

  useEffect(() => {
    if (!organisationId) return;
    loadOrganisationCatalog(organisationId).catch((error) => {
      console.error('Failed to load treatment catalog specialities:', error);
    });
  }, [loadOrganisationCatalog, organisationId]);

  useEffect(() => {
    if (!organisationId || catalogSpecialityIds.length === 0) return;
    Promise.all(
      catalogSpecialityIds.map((specialityId) =>
        loadSpecialityCatalog(organisationId, specialityId)
      )
    ).catch((error) => {
      console.error('Failed to load treatment service/package catalog:', error);
    });
  }, [catalogSpecialityIds, catalogSpecialityKey, loadSpecialityCatalog, organisationId]);

  useEffect(() => {
    const packageIdsNeedingDetail = catalogPackages
      .filter(
        (pkg) =>
          pkg.organisationId === organisationId &&
          pkg.status === 'ACTIVE' &&
          pkg.breakdown.length === 0
      )
      .map((pkg) => pkg.id);
    if (packageIdsNeedingDetail.length === 0) return;
    Promise.all(packageIdsNeedingDetail.map((id) => hydratePackageDetail(id))).catch((error) => {
      console.error('Failed to hydrate treatment package details:', error);
    });
  }, [catalogPackages, hydratePackageDetail, organisationId]);

  useEffect(() => {
    if (!organisationId) return;
    if (inventoryIds.length > 0) return;
    fetchInventoryItems(organisationId)
      .then((items) => {
        setInventoryForOrg(organisationId, items.map(mapApiItemToInventoryItem));
      })
      .catch((error) => {
        console.error('Failed to load prescription inventory:', error);
      });
  }, [inventoryIds.length, organisationId, setInventoryForOrg]);

  useEffect(() => {
    if (!organisationId || !isInpatient) return;
    listScheduleTaskTemplates(organisationId)
      .then(setScheduleTemplates)
      .catch((error) => {
        console.error('Failed to load schedule task templates:', error);
      });
  }, [isInpatient, organisationId]);

  useEffect(() => {
    if (!organisationId) return;
    listPrescriptionTemplatesForWorkspace(organisationId)
      .then((templates) => {
        if (templates.length > 0) setPrescriptionTemplates(templates);
      })
      .catch((error) => {
        console.error('Failed to load prescription templates:', error);
      });
  }, [organisationId]);

  // Hydrate the inpatient schedule on load: confirm the encounter's schedules
  // exist on the backend, then pull the generated tasks into the task store so
  // the timeline renders persisted items (not just ones added this session).
  useEffect(() => {
    if (!organisationId || !isInpatient) return;
    const loadSchedule = async () => {
      if (encounterId) {
        try {
          await getInpatientScheduleForEncounter(organisationId, encounterId);
        } catch (error) {
          console.error('Failed to load encounter schedule:', error);
        }
      }
      await loadTasksForPrimaryOrg(WORKSPACE_TASK_LOAD).catch((error) => {
        console.error('Failed to load schedule tasks:', error);
      });
    };
    void loadSchedule();
  }, [encounterId, isInpatient, organisationId]);

  // Append a task template: resolve its blocks and create them as real employee
  // tasks for this appointment, so each appears in the schedule (derived from the
  // task store) and can be viewed/edited via the Quick Actions side modal.
  const handleApplyScheduleTemplate = async (templateId: string) => {
    if (!organisationId) return;
    setScheduleError(null);
    try {
      const rows = await resolveScheduleTasksFromTemplate(organisationId, templateId);
      if (rows.length === 0) {
        setScheduleError('This template has no tasks to load.');
        return;
      }
      await Promise.all(
        rows.map((row) =>
          createTask({
            _id: '',
            organisationId,
            appointmentId,
            assignedTo: encounter.leadId ?? '',
            audience: 'EMPLOYEE_TASK',
            source: 'CUSTOM',
            category: categoryFromLabel(row.category),
            name: row.description,
            description: row.subtext,
            dueAt: combineScheduleDateTime(row.startDate, row.time) ?? new Date(),
            status: scheduleStatusToTaskStatus(row.status),
          } as Task)
        )
      );
      await loadTasksForPrimaryOrg(WORKSPACE_TASK_LOAD);
    } catch (error) {
      console.error('Failed to load schedule template:', error);
      setScheduleError('Unable to load schedule template. Please try again.');
    }
  };

  const prescriptionCatalogItems = useMemo(
    () =>
      inventoryIds
        .map((id) => inventoryById[id])
        .filter((item): item is InventoryItem => {
          const category = item?.basicInfo.category?.toLowerCase();
          return Boolean(category && PRESCRIPTION_INVENTORY_CATEGORIES.has(category));
        })
        .map(inventoryToPrescriptionItem),
    [inventoryById, inventoryIds]
  );

  // Backfill saved/encounter prescription lines with inventory-owned display fields (brand,
  // generic, strength unit, form, route, controlled flag, live stock, price) that the persisted
  // record may be missing. Resolve by inventoryItemId first, then SKU. Saved values always win.
  const inventoryBySku = useMemo(() => {
    const bySku = new Map<string, InventoryItem>();
    for (const id of inventoryIds) {
      const inv = inventoryById[id];
      const sku = inv?.sku?.trim();
      if (sku) bySku.set(sku.toLowerCase(), inv);
    }
    return bySku;
  }, [inventoryById, inventoryIds]);

  const prescriptionItems = useMemo(
    () =>
      encounter.prescription.map((item) =>
        backfillPrescriptionFromInventory(item, (line) => {
          if (line.inventoryItemId && inventoryById[line.inventoryItemId]) {
            return inventoryById[line.inventoryItemId];
          }
          const sku = line.sku?.trim().toLowerCase();
          return sku ? inventoryBySku.get(sku) : undefined;
        })
      ),
    [encounter.prescription, inventoryById, inventoryBySku]
  );

  const addPrescriptionRowsFromTemplate = React.useCallback(
    (rows: Array<Omit<AppointmentEncounter['prescription'][number], 'id'>>) => {
      const clinicalKey = (row: Omit<AppointmentEncounter['prescription'][number], 'id'>) =>
        row.medicineName.trim()
          ? [row.medicineName, row.strength, row.strengthUnit, row.dosageForm, row.route]
              .map((value) => value?.trim().toLowerCase() ?? '')
              .join('|')
          : '';
      const existingRows =
        useAppointmentWorkspaceStore.getState().getEncounter(appointmentId)?.prescription ?? [];
      const seenInventoryIds = new Set(
        existingRows
          .map((item) => item.inventoryItemId)
          .filter((value): value is string => Boolean(value))
      );
      const seenClinicalKeys = new Set(existingRows.map(clinicalKey).filter(Boolean));
      rows.forEach((row) => {
        const inventoryKey = row.inventoryItemId?.trim();
        const rowClinicalKey = clinicalKey(row);
        if (inventoryKey && seenInventoryIds.has(inventoryKey)) return;
        if (rowClinicalKey && seenClinicalKeys.has(rowClinicalKey)) return;
        if (inventoryKey) seenInventoryIds.add(inventoryKey);
        if (rowClinicalKey) seenClinicalKeys.add(rowClinicalKey);
        addPrescription(appointmentId, row);
      });
    },
    [addPrescription, appointmentId]
  );

  // Auto-load the PRESCRIPTION template linked to the encounter's service/package once that
  // service/package context is known and the prescription section is still empty. Track attempts by
  // service/package key so an initial blank encounter cannot block the later linked-template load.
  const autoResolvedRxKeysRef = React.useRef<Set<string>>(new Set());
  const prescriptionCount = encounter.prescription.length;
  const encounterServicesForRx = encounter.services;
  const encounterModeForRx = encounter.mode;
  useEffect(() => {
    if (!organisationId || readOnly || prescriptionCount > 0) return;
    const serviceLine = encounterServicesForRx.find((item) => item.kind === 'SERVICE');
    const packageLine = encounterServicesForRx.find((item) => item.kind === 'PACKAGE');
    if (!serviceLine && !packageLine) return;
    const contextKey = `${serviceLine?.refId ?? ''}|${packageLine?.refId ?? ''}|${encounterModeForRx}`;
    if (autoResolvedRxKeysRef.current.has(contextKey)) return;
    autoResolvedRxKeysRef.current.add(contextKey);
    let cancelled = false;
    resolvePrescriptionTemplate({
      organisationId,
      appointmentId,
      encounterId,
      serviceId: serviceLine?.refId,
      packageId: packageLine?.refId,
      mode: encounterModeForRx,
    })
      .then((rows) => {
        if (cancelled) return;
        const existing = useAppointmentWorkspaceStore
          .getState()
          .getEncounter(appointmentId)?.prescription;
        if (existing && existing.length > 0) return;
        addPrescriptionRowsFromTemplate(rows);
      })
      .catch((error) => console.error('Unable to resolve prescription template:', error));
    return () => {
      cancelled = true;
    };
  }, [
    addPrescriptionRowsFromTemplate,
    appointmentId,
    encounterId,
    encounterModeForRx,
    encounterServicesForRx,
    organisationId,
    prescriptionCount,
    readOnly,
  ]);

  const servicePackageCatalogItems = useMemo(() => {
    if (!organisationId) return [];
    const serviceItems = catalogServices
      .filter((service) => service.organisationId === organisationId && service.status === 'ACTIVE')
      .map(serviceToLineItem);
    const packageItems = catalogPackages
      .filter((pkg) => pkg.organisationId === organisationId && pkg.status === 'ACTIVE')
      .map(packageToLineItem);
    return [...serviceItems, ...packageItems];
  }, [catalogPackages, catalogServices, organisationId]);

  // Adding a medication from inventory only stages it locally — it does NOT immediately call
  // the backend. Persisting on add captured the bare inventory-derived row before the clinician
  // entered dosage / route / frequency / quantity, so those values were lost. The fully-filled
  // rows are persisted together on "Save treatment" (see handleSaveTreatment).
  const handleAddPrescription = (item: Parameters<typeof addPrescription>[1]) => {
    setPrescriptionError(null);
    addPrescription(appointmentId, item);
  };

  const handleApplyPrescriptionTemplate = (template: PrescriptionTemplateOption) => {
    setPrescriptionError(null);
    addPrescriptionRowsFromTemplate(template.items);
  };

  // Remove a prescription. Billed/paid rows have no delete control, so anything reaching here is
  // unbilled and may be removed. Staged (local-…) rows are local-only. A persisted row is deleted
  // on the backend so it does not reappear on refresh:
  //   • Primary: DELETE …/prescription/:id — the backend voids the DRAFT artifact AND cascades the
  //     linked workspace treatment-item row (204). A 409 means it is finalized/billed → not
  //     deletable; we surface that and restore the row.
  //   • Fallback: if the artifact route is unavailable (404/405 → returns false), delete the
  //     linked treatment-item row directly.
  // The removal is optimistic; any failure restores the row and surfaces an error.
  const handleRemovePrescription = async (id: string) => {
    const target = prescriptionItems.find((rx) => rx.id === id);
    // Hard guard: a billed/paid prescription is read-only and must never be deleted. The card
    // already hides its delete control, but never trust the UI alone for a destructive action.
    if (target?.billed) return;
    setPrescriptionError(null);
    removePrescription(appointmentId, id);

    const isPersisted = Boolean(id) && !id.startsWith('local-');
    if (!isPersisted || !organisationId || !target) return;

    try {
      // Backend voids the draft and cascades the treatment-item row.
      const deleted = await deletePrescriptionArtifact(organisationId, id);
      // Route not available yet → fall back to deleting the linked treatment-item row.
      if (!deleted && encounterId) {
        await deletePrescriptionTreatmentItem(organisationId, encounterId, {
          id: target.id,
          inventoryItemId: target.inventoryItemId,
        });
      }
    } catch (error) {
      console.error('Failed to delete prescription:', error);
      const status = (error as { response?: { status?: number } })?.response?.status;
      // Restore the row so the UI reflects the still-present backend record.
      addPrescription(appointmentId, target, target.id);
      setPrescriptionError(
        status === 409
          ? 'This prescription is finalized or billed and can no longer be removed.'
          : 'Unable to remove the prescription. Please try again.'
      );
    }
  };

  // Persist schedule-task edits. Every schedule row is a real backend employee
  // task (the task store is the single source of truth), so the optimistic update
  // writes to the task store and persists via the status/PATCH task endpoints —
  // the derived schedule row and the Quick Actions panel re-render from the same
  // source, staying in sync with no local-only duplicate.
  const handleUpdateScheduleTask = (id: string, patch: Partial<ScheduleTask>) => {
    const backingTask = tasksById[id];
    if (!backingTask) return;
    setScheduleError(null);
    // Optimistically reflect the change in the task store so the derived schedule
    // row (appointmentEmployeeTasks) re-renders immediately.
    const nextStatus =
      patch.status === undefined
        ? backingTask.status
        : scheduleStatusToTaskStatus(patch.status as ScheduleTaskStatus);
    const nextAssignedTo = patch.assignedToId ?? backingTask.assignedTo;
    const nextDescription = patch.description ?? backingTask.description;
    const optimisticTask = {
      ...backingTask,
      status: nextStatus,
      assignedTo: nextAssignedTo,
      description: nextDescription,
    };
    upsertTask(optimisticTask);
    const persist = async () => {
      try {
        if (patch.status !== undefined) {
          await changeTaskStatus({ ...backingTask, status: nextStatus });
        }
        if (patch.assignedToId !== undefined || patch.description !== undefined) {
          await updateTask({
            ...backingTask,
            assignedTo: nextAssignedTo,
            description: nextDescription,
          });
        }
      } catch (error) {
        console.error('Failed to sync schedule task:', error);
        setScheduleError('Unable to save the task change. Please try again.');
        await loadTasksForPrimaryOrg(WORKSPACE_TASK_LOAD).catch(() => undefined);
      }
    };
    void persist();
  };

  const handleSaveTreatment = async () => {
    if (isSavingTreatment) return;
    setTreatmentSaveError(null);
    // Normalize before validating/saving: the duration unit defaults to "days" (the value shown
    // on the card), so a row the clinician left at the default is complete and persists correctly.
    const normalizedPrescriptions = prescriptionItems.map((rx) => ({
      ...rx,
      durationUnit: rx.durationUnit?.trim() || DEFAULT_DURATION_UNIT,
    }));
    // Save-time validation gate: never advance with an incomplete prescription. This runs
    // BEFORE the persist/no-persist branch so it blocks even when org/encounter haven't hydrated
    // (otherwise the step would silently advance without validating). Each row must carry the
    // required clinical instructions (frequency, duration, quantity, route, form) and pass every
    // number-format rule.
    const prescriptionErrors = normalizedPrescriptions.flatMap((rx) =>
      getPrescriptionSaveErrors(rx)
    );
    if (prescriptionErrors.length > 0) {
      setPrescriptionError(prescriptionErrors[0]);
      setTreatmentSaveError('Complete all prescription details before saving.');
      return;
    }
    setPrescriptionError(null);

    setIsSavingTreatment(true);
    // Resolve the encounter id, creating one (via check-in) when the appointment hasn't started —
    // an outpatient appointment has no encounter until then, so without this treatment/prescriptions
    // would only ever live locally and vanish on refresh.
    let activeEncounterId = encounterId;
    if (organisationId && !activeEncounterId && ensureEncounterId) {
      try {
        activeEncounterId = await ensureEncounterId();
      } catch (error) {
        console.error('Failed to resolve an encounter for treatment:', error);
      }
    }
    // Still no org/encounter (e.g. check-in unavailable) → keep the legacy local-only behaviour.
    if (!organisationId || !activeEncounterId) {
      setStepStatus(appointmentId, 'TREATMENT', 'COMPLETED');
      setIsSavingTreatment(false);
      onOpenInvoice();
      return;
    }
    // Saved prescription ids captured from the create/update responses, so finalize targets the
    // real artifact id (not the local `local-rx-…` id) and the post-save bootstrap merge — not a
    // local append — becomes the single source of truth for the list (avoids duplicate rows).
    const savedInHouseIds: string[] = [];
    try {
      // Persist any staged service/package rows.
      await persistTreatmentItems(organisationId, activeEncounterId, encounter.services);
      // Persist prescription rows with their fully-entered clinical values (strength / route /
      // frequency / duration / quantity / refills). We save the inventory-BACKFILLED rows
      // (`prescriptionItems`), not the raw store rows, so inventory-owned fields the clinician
      // sees on the card (brand, strength unit, form, route, controlled flag, schedule) are
      // included in the payload even when the originally-hydrated record was missing them.
      // create-or-update is keyed off the row id.
      const reconciledPrescriptions = await Promise.all(
        normalizedPrescriptions.map(async (rx) => {
          const savedRx = await savePrescriptionArtifact(
            { organisationId, appointmentId, encounterId: activeEncounterId, authorId },
            rx
          );
          const savedId = (savedRx as { id?: string } | undefined)?.id ?? rx.id;
          if (savedId && rx.fulfillment !== 'PRESCRIPTION_ONLY') savedInHouseIds.push(savedId);
          return { ...rx, id: savedId };
        })
      );
      // Authoritatively replace the list with exactly the saved rows (deduped by backend id) so
      // there is never a stale local + persisted duplicate — even before the bootstrap lands or
      // when the bootstrap returns the still-draft prescription differently.
      const dedupedById = Array.from(
        new Map(reconciledPrescriptions.map((rx) => [rx.id, rx])).values()
      );
      setPrescriptions(appointmentId, dedupedById);
      // Finalize in-house prescriptions (triggers inventory dispense) using the real saved ids.
      await Promise.allSettled(
        savedInHouseIds.map((id) => finalizePrescription(organisationId, id))
      );
      // Re-hydrate from the authoritative server state — replaces the staged local rows so the
      // saved prescription appears exactly once.
      const bootstrap = await getAppointmentWorkspaceBootstrap(organisationId, appointmentId);
      mergeEncounterData(appointmentId, normalizeWorkspaceBootstrapForEncounter(bootstrap));
    } catch (error) {
      // Do NOT open Invoice when persistence fails — staged rows would otherwise
      // appear billable without a backing record.
      console.error('Failed to save treatment items:', error);
      setTreatmentSaveError('Unable to save treatment items. Please try again.');
      setIsSavingTreatment(false);
      return;
    }
    setStepStatus(appointmentId, 'TREATMENT', 'COMPLETED');
    setIsSavingTreatment(false);
    onOpenInvoice();
  };

  // Print the dispensary-style label PDF for each saved prescription item, mirroring
  // the dispensary modal (GET .../prescriptions/.../:prescriptionId/label.pdf as a blob).
  // Only persisted items (with an id) have a printable label.
  const handlePrintPrescriptionLabels = async () => {
    if (printingLabels || !organisationId) return;
    const printable = encounter.prescription.filter((rx) => rx.id);
    if (printable.length === 0) {
      setPrescriptionError('Save the treatment before printing prescription labels.');
      return;
    }
    setPrescriptionError(null);
    setPrintingLabels(true);
    try {
      const blobs = await Promise.all(
        printable.map((rx) => fetchPrescriptionLabelPdf(organisationId, rx.id))
      );
      blobs.forEach((blob) => {
        const url = URL.createObjectURL(blob);
        const win = globalThis.window.open(url, '_blank');
        win?.focus();
        globalThis.window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      });
    } catch (error) {
      console.error('Failed to print prescription labels:', error);
      setPrescriptionError('Unable to print prescription labels. Please try again.');
    } finally {
      setPrintingLabels(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {isInpatient && (
        <InpatientSchedule
          tasks={visibleScheduleTasks}
          templates={scheduleTemplates}
          readOnly={readOnly}
          assigneeOptions={assigneeOptions}
          // Add and View route to the Quick Actions Tasks side modal (no inline add/edit).
          onAddTask={() => setActiveSideAction('TASKS')}
          onViewTask={(id) => openTaskInQuickActions(id)}
          onAssignTask={(id, option) =>
            handleUpdateScheduleTask(id, {
              assignedToId: option.value,
              assignedToName: option.label,
            })
          }
          onStatusChange={(id, status) => handleUpdateScheduleTask(id, { status })}
          onAppendTemplate={handleApplyScheduleTemplate}
        />
      )}
      {scheduleError && <p className="text-caption-1 text-red-600">{scheduleError}</p>}

      <ServicesPackagesEditor
        items={encounter.services}
        catalogItems={servicePackageCatalogItems}
        readOnly={readOnly}
        deleteLocked={billedTreatmentLocked}
        onAddItem={(item) => addLineItem(appointmentId, item)}
        onUpdateItem={(id, patch) => updateLineItem(appointmentId, id, patch)}
        onRemoveItem={(id) => removeLineItem(appointmentId, id)}
      />

      <PrescriptionEditor
        items={prescriptionItems}
        catalogItems={prescriptionCatalogItems}
        templateItems={prescriptionTemplates}
        readOnly={readOnly}
        // A prescription can be removed unless it is actually billed/paid (handled per-row via the
        // `billed` flag) or the encounter is view-only. Being "ready for billing" is NOT a lock —
        // an un-dispensed, unbilled prescription must stay deletable.
        deleteLocked={readOnly}
        onAddItem={handleAddPrescription}
        onApplyTemplate={handleApplyPrescriptionTemplate}
        onUpdateItem={(id, patch) => updatePrescription(appointmentId, id, patch)}
        onRemoveItem={(id) => void handleRemovePrescription(id)}
        onPrint={() => void handlePrintPrescriptionLabels()}
      />
      {prescriptionError && <p className="text-caption-1 text-red-600">{prescriptionError}</p>}

      {treatmentSaveError && (
        <p role="alert" className="text-caption-1 text-red-600">
          {treatmentSaveError}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <Secondary
          text={printingLabels ? 'Printing...' : 'Print Labels'}
          icon={<LuPrinter aria-hidden="true" />}
          onClick={() => void handlePrintPrescriptionLabels()}
          isDisabled={printingLabels}
        />
        <Primary
          text={isSavingTreatment ? 'Saving…' : 'Save treatment'}
          icon={<LuSave aria-hidden="true" />}
          onClick={() => void handleSaveTreatment()}
          isDisabled={readOnly || isSavingTreatment}
        />
      </div>
    </div>
  );
};

export default TreatmentStep;
