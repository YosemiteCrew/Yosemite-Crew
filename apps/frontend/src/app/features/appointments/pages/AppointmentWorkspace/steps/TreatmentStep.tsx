import React, { useEffect, useMemo, useState } from 'react';
import { LuPrinter, LuSave } from 'react-icons/lu';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import ServicesPackagesEditor from '@/app/features/appointments/pages/AppointmentWorkspace/components/ServicesPackagesEditor';
import PrescriptionEditor from '@/app/features/appointments/pages/AppointmentWorkspace/components/PrescriptionEditor';
import InpatientSchedule from '@/app/features/appointments/pages/AppointmentWorkspace/components/InpatientSchedule';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import { savePrescriptionArtifact } from '@/app/features/appointments/services/workspaceClinicalService';
import { finalizePrescription } from '@/app/features/appointments/services/prescriptionWorkflowService';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import {
  getAvailableStock,
  mapApiItemToInventoryItem,
} from '@/app/features/inventory/pages/Inventory/utils';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { useTaskStore } from '@/app/stores/taskStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { loadTasksForPrimaryOrg } from '@/app/features/tasks/services/taskService';
import type { Task } from '@/app/features/tasks/types/task';
import { useLoadTeam, useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  applyInpatientScheduleTemplate,
  createWorkspaceTemplateInstance,
  getInpatientScheduleForEncounter,
  listInpatientScheduleTemplates,
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
  computeServiceTotal,
} from '@/app/features/organization/services/catalogCalculations';

type TreatmentStepProps = {
  appointmentId: string;
  organisationId?: string;
  encounterId?: string;
  authorId?: string;
  encounter: AppointmentEncounter;
  onOpenInvoice: () => void;
};

const handlePrint = () => {
  globalThis.window.print();
};

const PRESCRIPTION_INVENTORY_CATEGORIES = new Set([
  'medicine',
  'vaccine',
  'supplement',
  'iv/fluid therapy',
]);

const toCents = (value: string | number | undefined): number | undefined => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
};

const isLowStock = (item: InventoryItem) => {
  const available = getAvailableStock(item);
  const reorderLevel = Number(item.stock.reorderLevel);
  if (available === undefined || !Number.isFinite(reorderLevel)) return false;
  return available <= reorderLevel;
};

const joinNonEmpty = (...parts: Array<string | undefined>): string | undefined => {
  const joined = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
  return joined || undefined;
};

const inventoryToPrescriptionItem = (item: InventoryItem) => {
  const classification = item.classification ?? {};
  return {
    medicineName: item.basicInfo.name,
    // Pre-fill the prescribing fields from the inventory item so the clinician sees the
    // medicine's strength/form, route, and default frequency instead of empty inputs.
    dosage: joinNonEmpty(classification.strength, classification.dosageForm ?? classification.form),
    route: classification.administration,
    frequency: classification.frequency,
    fulfillment: 'IN_HOUSE' as const,
    inventoryItemId: item.id,
    inventoryBatchId: item.batch?._id,
    priceCents: toCents(item.pricing.selling),
    stockQty: getAvailableStock(item),
    lowStock: isLowStock(item),
  };
};

const moneyToCents = (amount: number): number => Math.max(0, Math.round(amount * 100));

const breakdownToLineItem = (item: PackageBreakdownItem) => {
  const { net } = computePackageBreakdownItem(item);
  return {
    id: item.id,
    name: item.name,
    qty: item.quantity,
    instructions: item.type,
    amountCents: moneyToCents(net),
  };
};

const serviceToLineItem = (service: ServiceRevamp) => {
  const { total } = computeServiceTotal(service);
  const amountCents = moneyToCents(total);
  return {
    refId: service.id,
    kind: 'SERVICE' as const,
    name: service.name,
    qty: 1,
    instructions: service.description || service.type,
    unitPriceCents: amountCents,
    amountCents,
  };
};

const packageToLineItem = (pkg: PackageRevamp) => {
  const { totalCost } = computePackageTotals(pkg);
  const amountCents = moneyToCents(totalCost);
  return {
    refId: pkg.id,
    kind: 'PACKAGE' as const,
    name: pkg.name,
    qty: 1,
    instructions: pkg.description || `Package with ${pkg.breakdown.length} item(s)`,
    unitPriceCents: amountCents,
    amountCents,
    breakdown: pkg.breakdown.map(breakdownToLineItem),
  };
};

const taskStatusToScheduleStatus = (status: Task['status']) => {
  if (status === 'COMPLETED') return 'COMPLETED' as const;
  if (status === 'CANCELLED') return 'CANCELLED' as const;
  if (status === 'IN_PROGRESS') return 'UPCOMING' as const;
  return 'PENDING' as const;
};

const taskToScheduleTask = (task: Task) => ({
  id: task._id,
  description: task.description || task.name,
  category: 'Care' as const,
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
  const removePrescription = useAppointmentWorkspaceStore((s) => s.removePrescription);
  const addScheduleTask = useAppointmentWorkspaceStore((s) => s.addScheduleTask);
  const updateScheduleTask = useAppointmentWorkspaceStore((s) => s.updateScheduleTask);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const itemIdsByOrgId = useInventoryStore((s) => s.itemIdsByOrgId);
  const inventoryById = useInventoryStore((s) => s.itemsById);
  const setInventoryForOrg = useInventoryStore((s) => s.setInventoryForOrg);
  const tasksById = useTaskStore((s) => s.tasksById);
  useLoadTeam();
  const teamMembers = useTeamForPrimaryOrg();
  const catalogSpecialities = useRevampCatalogStore((s) => s.specialities);
  const catalogServices = useRevampCatalogStore((s) => s.services);
  const catalogPackages = useRevampCatalogStore((s) => s.packages);
  const loadOrganisationCatalog = useRevampCatalogStore((s) => s.loadOrganisationCatalog);
  const loadSpecialityCatalog = useRevampCatalogStore((s) => s.loadSpecialityCatalog);
  const hydratePackageDetail = useRevampCatalogStore((s) => s.hydratePackageDetail);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [scheduleTemplates, setScheduleTemplates] = useState<TemplateLike[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
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
      await loadTasksForPrimaryOrg({ force: true, silent: true });
    } catch (error) {
      console.error('Failed to apply inpatient schedule template:', error);
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

  const handleAddPrescription = async (item: Parameters<typeof addPrescription>[1]) => {
    setPrescriptionError(null);
    if (!organisationId) {
      addPrescription(appointmentId, item);
      return;
    }
    try {
      const savedRx = await savePrescriptionArtifact(
        { organisationId, appointmentId, encounterId, authorId },
        item
      );
      addPrescription(appointmentId, item, (savedRx as { id?: string } | undefined)?.id);
    } catch (error) {
      console.error('Failed to save prescription', error);
      setPrescriptionError('Unable to add prescription. Please try again.');
    }
  };

  const handleSaveTreatment = async () => {
    if (organisationId) {
      const persistedPrescriptions = encounter.prescription.filter((rx) => rx.id);
      await Promise.allSettled(
        persistedPrescriptions.map((rx) => finalizePrescription(organisationId, rx.id))
      );
    }
    setStepStatus(appointmentId, 'TREATMENT', 'COMPLETED');
    onOpenInvoice();
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
          onUpdateTask={(id, patch) => updateScheduleTask(appointmentId, id, patch)}
          onApplyTemplate={handleApplyScheduleTemplate}
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
        items={encounter.prescription}
        catalogItems={prescriptionCatalogItems}
        readOnly={readOnly}
        deleteLocked={billedTreatmentLocked}
        onAddItem={handleAddPrescription}
        onUpdateItem={(id, patch) => updatePrescription(appointmentId, id, patch)}
        onRemoveItem={(id) => removePrescription(appointmentId, id)}
        onPrint={handlePrint}
      />
      {prescriptionError && <p className="text-caption-1 text-red-600">{prescriptionError}</p>}

      <div className="flex flex-wrap justify-between gap-3">
        <Secondary
          text="Prescription"
          icon={<LuPrinter aria-hidden="true" />}
          onClick={handlePrint}
        />
        <Primary
          text="Save treatment"
          icon={<LuSave aria-hidden="true" />}
          onClick={handleSaveTreatment}
          isDisabled={readOnly}
        />
      </div>
    </div>
  );
};

export default TreatmentStep;
