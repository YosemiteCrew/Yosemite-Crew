import type { ScheduleTask, ScheduleTaskStatus } from '@/app/features/appointments/types/workspace';
import type { Task } from '@/app/features/tasks/types/task';
import { getTaskCategoryLabel } from '@/app/features/tasks/constants/taskTaxonomy';
import { formatStampTime } from '@/app/lib/appointmentWorkspace';
import type {
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
} from '@/app/features/organization/types/revamp';
import {
  computePackageBreakdownItem,
  computePackageTotals,
} from '@/app/features/organization/services/catalogCalculations';

export const PRESCRIPTION_INVENTORY_CATEGORIES = new Set([
  'medicine',
  'vaccine',
  'supplement',
  'iv/fluid therapy',
]);

export const moneyToCents = (amount: number): number => Math.max(0, Math.round(amount * 100));

export const discountCentsFromPercent = (grossCents: number, percent: number): number =>
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

export const serviceToLineItem = (service: ServiceRevamp) => {
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

export const packageToLineItem = (pkg: PackageRevamp) => {
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
export const WORKSPACE_TASK_LOAD = {
  force: true,
  silent: true,
  filters: { includeCompleted: true },
};

export const taskStatusToScheduleStatus = (status: Task['status']) => {
  if (status === 'COMPLETED') return 'COMPLETED' as const;
  if (status === 'CANCELLED') return 'CANCELLED' as const;
  if (status === 'IN_PROGRESS') return 'UPCOMING' as const;
  return 'PENDING' as const;
};

export const scheduleStatusToTaskStatus = (status: ScheduleTaskStatus): Task['status'] => {
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'UPCOMING') return 'IN_PROGRESS';
  return 'PENDING';
};

// Combine a schedule task's start date ("MMM d, yyyy" or ISO) and "h:mm AM/PM"
// time into a single Date for the backend `dueAt`. Returns null when the date is
// unparseable so the caller can keep the existing value.
export const combineScheduleDateTime = (startDate?: string, time?: string): Date | null => {
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

export const taskToScheduleTask = (task: Task): ScheduleTask => ({
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
