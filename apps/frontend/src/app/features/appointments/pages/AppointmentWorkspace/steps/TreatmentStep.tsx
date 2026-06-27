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
import { useLoadTeam, useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  applyInpatientScheduleTemplate,
  cancelInpatientScheduleTemplate,
  createWorkspaceTemplateInstance,
  getInpatientScheduleForEncounter,
  listInpatientScheduleTemplates,
  pauseInpatientScheduleTemplate,
  regenerateInpatientScheduleTemplate,
  resolvePrescriptionTemplate,
  resumeInpatientScheduleTemplate,
} from '@/app/features/appointments/services/workspaceTemplateService';
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

const taskToScheduleTask = (task: Task): ScheduleTask => ({
  id: task._id,
  description: task.description || task.name,
  category: task.category as ScheduleTask['category'],
  assignedToId: task.assignedTo,
  status: taskStatusToScheduleStatus(task.status),
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
  onOpenInvoice,
}: TreatmentStepProps) => {
  const addLineItem = useAppointmentWorkspaceStore((s) => s.addLineItem);
  const updateLineItem = useAppointmentWorkspaceStore((s) => s.updateLineItem);
  const removeLineItem = useAppointmentWorkspaceStore((s) => s.removeLineItem);
  const addPrescription = useAppointmentWorkspaceStore((s) => s.addPrescription);
  const updatePrescription = useAppointmentWorkspaceStore((s) => s.updatePrescription);
  const setPrescriptions = useAppointmentWorkspaceStore((s) => s.setPrescriptions);
  const removePrescription = useAppointmentWorkspaceStore((s) => s.removePrescription);
  const addScheduleTask = useAppointmentWorkspaceStore((s) => s.addScheduleTask);
  const updateScheduleTask = useAppointmentWorkspaceStore((s) => s.updateScheduleTask);
  const removeScheduleTask = useAppointmentWorkspaceStore((s) => s.removeScheduleTask);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const mergeEncounterData = useAppointmentWorkspaceStore((s) => s.mergeEncounterData);
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
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [treatmentSaveError, setTreatmentSaveError] = useState<string | null>(null);
  const [isSavingTreatment, setIsSavingTreatment] = useState(false);
  // Applied schedule instance lifecycle (pause/resume/cancel/regenerate). The
  // instance id is captured when a template is applied this session.
  const [scheduleInstanceId, setScheduleInstanceId] = useState<string | null>(null);
  const [schedulePaused, setSchedulePaused] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
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
  const visibleScheduleTasks = useMemo(
    () => [...encounter.schedule, ...appointmentEmployeeTasks],
    [appointmentEmployeeTasks, encounter.schedule]
  );

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

  // Auto-load the PRESCRIPTION template linked to the encounter's service/package the first time the
  // section is empty, so the medication rows (inventory item + authored default dose/route/freq/
  // duration/instructions) preload. Runs once; the clinician can still add/edit rows afterwards.
  const autoResolvedRxRef = React.useRef(false);
  const prescriptionCount = encounter.prescription.length;
  const encounterServicesForRx = encounter.services;
  const encounterModeForRx = encounter.mode;
  useEffect(() => {
    if (!organisationId || readOnly || autoResolvedRxRef.current) return;
    if (prescriptionCount > 0) return;
    autoResolvedRxRef.current = true;
    let cancelled = false;
    const serviceLine = encounterServicesForRx?.find((item) => item.kind === 'SERVICE');
    const packageLine = encounterServicesForRx?.find((item) => item.kind === 'PACKAGE');
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
        // Guard against re-adding template rows that already exist (e.g. after navigating back to
        // this step post-save): skip any row whose inventory item is already on a prescription.
        const existing = useAppointmentWorkspaceStore
          .getState()
          .getEncounter(appointmentId)?.prescription;
        if (existing && existing.length > 0) return;
        const seenInventoryIds = new Set<string>();
        rows.forEach((row) => {
          if (row.inventoryItemId && seenInventoryIds.has(row.inventoryItemId)) return;
          if (row.inventoryItemId) seenInventoryIds.add(row.inventoryItemId);
          addPrescription(appointmentId, row);
        });
      })
      .catch((error) => console.error('Unable to resolve prescription template:', error));
    return () => {
      cancelled = true;
    };
  }, [
    addPrescription,
    appointmentId,
    encounterId,
    encounterModeForRx,
    encounterServicesForRx,
    organisationId,
    prescriptionCount,
    readOnly,
  ]);

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
    listInpatientScheduleTemplates(organisationId)
      .then(setScheduleTemplates)
      .catch((error) => {
        console.error('Failed to load inpatient schedule templates:', error);
      });
  }, [isInpatient, organisationId]);

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
      await loadTasksForPrimaryOrg({ force: true, silent: true }).catch((error) => {
        console.error('Failed to load schedule tasks:', error);
      });
    };
    void loadSchedule();
  }, [encounterId, isInpatient, organisationId]);

  const handleApplyScheduleTemplate = async (templateId: string) => {
    if (!organisationId) return;
    setScheduleError(null);
    try {
      const instance = await createWorkspaceTemplateInstance(organisationId, templateId, {
        appointmentId,
        encounterId,
        authorId,
        data: {},
        status: 'DRAFT',
      });
      await applyInpatientScheduleTemplate(organisationId, instance.id, {
        force: true,
        notify: false,
      });
      // Track the applied instance so its lifecycle controls (pause/resume/
      // cancel/regenerate) become available.
      setScheduleInstanceId(instance.id);
      setSchedulePaused(false);
      await loadTasksForPrimaryOrg({ force: true, silent: true });
    } catch (error) {
      console.error('Failed to apply inpatient schedule template:', error);
      setScheduleError('Unable to load schedule template. Please try again.');
    }
  };

  // Run a schedule lifecycle action against the backend, then refresh tasks so the
  // timeline reflects the new state. Errors surface and do not flip local state.
  const runScheduleAction = async (
    action: (org: string, instanceId: string) => Promise<unknown>,
    onSuccess?: () => void
  ) => {
    if (!organisationId || !scheduleInstanceId || scheduleBusy) return;
    setScheduleError(null);
    setScheduleBusy(true);
    try {
      await action(organisationId, scheduleInstanceId);
      onSuccess?.();
      await loadTasksForPrimaryOrg({ force: true, silent: true });
    } catch (error) {
      console.error('Failed to update inpatient schedule:', error);
      setScheduleError('Unable to update the schedule. Please try again.');
    } finally {
      setScheduleBusy(false);
    }
  };

  const handlePauseSchedule = () =>
    runScheduleAction(
      (org, id) => pauseInpatientScheduleTemplate(org, id, { notify: false }),
      () => setSchedulePaused(true)
    );
  const handleResumeSchedule = () =>
    runScheduleAction(
      (org, id) => resumeInpatientScheduleTemplate(org, id, { notify: false }),
      () => setSchedulePaused(false)
    );
  const handleCancelSchedule = () =>
    runScheduleAction(
      (org, id) => cancelInpatientScheduleTemplate(org, id, { notify: false }),
      () => setScheduleInstanceId(null)
    );
  const handleRegenerateSchedule = () =>
    runScheduleAction((org, id) => regenerateInpatientScheduleTemplate(org, id, { notify: false }));

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

  // Remove a prescription. Billed/paid rows have no delete control, so anything reaching here is
  // unbilled and may be removed. Staged (local-…) rows are local-only. A persisted row is also
  // deleted on the backend so it does not reappear on refresh: prefer the linked treatment-item
  // DELETE (works today), then the canonical prescription DELETE (ready once the backend ships it).
  // The removal is optimistic; a backend failure restores the row and surfaces an error.
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
      let deleted = false;
      if (encounterId) {
        deleted = await deletePrescriptionTreatmentItem(organisationId, encounterId, {
          id: target.id,
          inventoryItemId: target.inventoryItemId,
        });
      }
      if (!deleted) {
        await deletePrescriptionArtifact(organisationId, id);
      }
    } catch (error) {
      console.error('Failed to delete prescription:', error);
      // Restore the row so the UI reflects the still-present backend record.
      addPrescription(appointmentId, target, target.id);
      setPrescriptionError('Unable to remove the prescription. Please try again.');
    }
  };

  // Persist schedule-task edits. A schedule row comes from one of two sources and
  // the optimistic local update MUST target the same one, or the UI won't reflect
  // the change:
  //   • store-backed employee task (in `tasksById`) → update the task store and
  //     persist via the status/PATCH task endpoints;
  //   • workspace-bootstrap schedule row (`encounter.schedule`) → update the
  //     workspace store (no per-row task API exists for these).
  const handleUpdateScheduleTask = (id: string, patch: Partial<ScheduleTask>) => {
    const backingTask = tasksById[id];
    if (!backingTask) {
      // Bootstrap/template schedule row — local-only update.
      updateScheduleTask(appointmentId, id, patch);
      return;
    }
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
        await loadTasksForPrimaryOrg({ force: true, silent: true }).catch(() => undefined);
      }
    };
    void persist();
  };

  // "Record" commits a task's edited breakdown (start date + time) to the backend.
  //  • A store-backed task PATCHes its dueAt.
  //  • A locally-added schedule row (not yet on the backend) is CREATED as a real
  //    employee task, then the local placeholder is removed and tasks re-pulled so
  //    the row becomes a persistent, editable task.
  const handleRecordScheduleTask = (id: string) => {
    const scheduleTask = visibleScheduleTasks.find((task) => task.id === id);
    if (!scheduleTask) {
      setScheduleError('This task can’t be recorded yet. Please try again.');
      return;
    }
    setScheduleError(null);
    const dueAt = combineScheduleDateTime(scheduleTask.startDate, scheduleTask.time) ?? new Date();
    const backingTask = tasksById[id];

    if (backingTask) {
      const updatedTask = { ...backingTask, dueAt };
      upsertTask(updatedTask);
      void (async () => {
        try {
          await updateTask(updatedTask);
        } catch (error) {
          console.error('Failed to record schedule task:', error);
          setScheduleError('Unable to record the task. Please try again.');
          await loadTasksForPrimaryOrg({ force: true, silent: true }).catch(() => undefined);
        }
      })();
      return;
    }

    // Local placeholder → create a persistent employee task on the backend.
    if (!organisationId) {
      setScheduleError('Select an organisation before recording tasks.');
      return;
    }
    const assignedTo = scheduleTask.assignedToId ?? encounter.leadId ?? '';
    void (async () => {
      try {
        await createTask({
          _id: '',
          organisationId,
          appointmentId,
          assignedTo,
          audience: 'EMPLOYEE_TASK',
          source: 'CUSTOM',
          category: scheduleTask.category ?? 'Care',
          name: scheduleTask.description || 'Treatment task',
          description: scheduleTask.description,
          dueAt,
          status: scheduleStatusToTaskStatus(scheduleTask.status),
        } as Task);
        // Replace the local placeholder with the freshly-created backend task.
        removeScheduleTask(appointmentId, id);
        await loadTasksForPrimaryOrg({ force: true, silent: true });
      } catch (error) {
        console.error('Failed to create schedule task:', error);
        setScheduleError('Unable to record the task. Please try again.');
      }
    })();
  };

  const handleSaveTreatment = async () => {
    if (isSavingTreatment) return;
    setTreatmentSaveError(null);
    // Without an org/encounter we cannot persist; keep the legacy local-only
    // behaviour (prescriptions already persist per-add; services stay staged).
    if (!organisationId || !encounterId) {
      setStepStatus(appointmentId, 'TREATMENT', 'COMPLETED');
      onOpenInvoice();
      return;
    }
    // Normalize before validating/saving: the duration unit defaults to "days" (the value shown
    // on the card), so a row the clinician left at the default is complete and persists correctly.
    const normalizedPrescriptions = prescriptionItems.map((rx) => ({
      ...rx,
      durationUnit: rx.durationUnit?.trim() || DEFAULT_DURATION_UNIT,
    }));
    // Save-time validation gate: never persist an incomplete prescription. Each row must carry
    // the required clinical instructions (frequency, duration, quantity, route, form) and pass
    // every number-format rule before anything is sent to the backend.
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
    // Saved prescription ids captured from the create/update responses, so finalize targets the
    // real artifact id (not the local `local-rx-…` id) and the post-save bootstrap merge — not a
    // local append — becomes the single source of truth for the list (avoids duplicate rows).
    const savedInHouseIds: string[] = [];
    try {
      // Persist any staged service/package rows.
      await persistTreatmentItems(organisationId, encounterId, encounter.services);
      // Persist prescription rows with their fully-entered clinical values (strength / route /
      // frequency / duration / quantity / refills). We save the inventory-BACKFILLED rows
      // (`prescriptionItems`), not the raw store rows, so inventory-owned fields the clinician
      // sees on the card (brand, strength unit, form, route, controlled flag, schedule) are
      // included in the payload even when the originally-hydrated record was missing them.
      // create-or-update is keyed off the row id.
      const reconciledPrescriptions = await Promise.all(
        normalizedPrescriptions.map(async (rx) => {
          const savedRx = await savePrescriptionArtifact(
            { organisationId, appointmentId, encounterId, authorId },
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
          onAddTask={(task) => addScheduleTask(appointmentId, task)}
          onUpdateTask={handleUpdateScheduleTask}
          onRecordTask={handleRecordScheduleTask}
          onApplyTemplate={handleApplyScheduleTemplate}
          scheduleLifecycle={{
            instanceId: scheduleInstanceId,
            paused: schedulePaused,
            busy: scheduleBusy,
            onPause: handlePauseSchedule,
            onResume: handleResumeSchedule,
            onCancel: handleCancelSchedule,
            onRegenerate: handleRegenerateSchedule,
          }}
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
        readOnly={readOnly}
        deleteLocked={billedTreatmentLocked}
        onAddItem={handleAddPrescription}
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
