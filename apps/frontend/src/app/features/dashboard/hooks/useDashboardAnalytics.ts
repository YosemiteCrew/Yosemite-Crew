import { useMemo } from 'react';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useTasksForPrimaryOrg } from '@/app/hooks/useTask';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { Task } from '@/app/features/tasks/types/task';

export const DASHBOARD_DURATION_OPTIONS = [
  'Last week',
  'Last month',
  'Last 6 months',
  'Last 1 year',
] as const;

export type DashboardDurationOption = (typeof DASHBOARD_DURATION_OPTIONS)[number];
export type DashboardDuration = 'last_week' | 'last_month' | 'last_6_months' | 'last_1_year';

type TimeBucket = {
  key: string;
  label: string;
  from: Date;
  to: Date;
};

type AppointmentChartPoint = {
  month: string;
  Completed: number;
  Cancelled: number;
};

type RevenueChartPoint = {
  month: string;
  Completed: number;
  Cancelled: number;
};

type LeaderPoint = {
  month: string;
  Completed: number;
  Cancelled: number;
};

type RevenueLeader = {
  label: string;
  revenue: number;
};

const resolveDashboardAnalyticsMode = (): 'mock' | 'live' => {
  const raw = String(process.env.NEXT_PUBLIC_DASHBOARD_ANALYTICS_MODE ?? '')
    .trim()
    .toLowerCase();
  return raw === 'live' ? 'live' : 'mock';
};

const isDashboardMockMode = () =>
  process.env.NODE_ENV === 'development' && resolveDashboardAnalyticsMode() === 'mock';

export const mapDashboardDurationOption = (option: string): DashboardDuration => {
  switch (option) {
    case 'Last month':
      return 'last_month';
    case 'Last 6 months':
      return 'last_6_months';
    case 'Last 1 year':
      return 'last_1_year';
    case 'Last week':
    default:
      return 'last_week';
  }
};

const getCoverageDays = (dates: Array<Date | null>) => {
  const validDates = dates.filter((date): date is Date => Boolean(date));
  if (!validDates.length) return 0;
  const min = validDates.reduce((acc, current) => (current < acc ? current : acc), validDates[0]);
  const max = validDates.reduce((acc, current) => (current > acc ? current : acc), validDates[0]);
  const diffMs = max.getTime() - min.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

const durationOptionsForDates = (dates: Array<Date | null>) => {
  const coverageDays = getCoverageDays(dates);
  const options: DashboardDurationOption[] = ['Last week'];
  if (coverageDays > 7) options.push('Last month');
  if (coverageDays > 31) options.push('Last 6 months');
  if (coverageDays > 183) options.push('Last 1 year');
  return options;
};

const startOfDay = (d: Date) => {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (d: Date) => {
  const next = new Date(d);
  next.setHours(23, 59, 59, 999);
  return next;
};

const startOfMonth = (d: Date) => {
  const next = new Date(d.getFullYear(), d.getMonth(), 1);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfMonth = (d: Date) => {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
};

const isWithinRange = (value: Date, from: Date, to: Date) => value >= from && value <= to;

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const monthLabel = (date: Date) => date.toLocaleString('en-US', { month: 'short' });

const dayLabel = (date: Date) => date.toLocaleString('en-US', { month: 'short', day: 'numeric' });

const getDurationRange = (duration: DashboardDuration): { from: Date; to: Date } => {
  const now = new Date();
  const to = endOfDay(now);

  if (duration === 'last_month') {
    return { from: startOfDay(addDays(now, -29)), to };
  }
  if (duration === 'last_6_months') {
    return { from: startOfMonth(addMonths(now, -5)), to };
  }
  if (duration === 'last_1_year') {
    return { from: startOfMonth(addMonths(now, -11)), to };
  }
  return { from: startOfDay(addDays(now, -6)), to };
};

const getTimeBuckets = (duration: DashboardDuration): TimeBucket[] => {
  const now = new Date();

  if (duration === 'last_week' || duration === 'last_month') {
    const days = duration === 'last_week' ? 7 : 30;
    const from = startOfDay(addDays(now, -(days - 1)));
    return Array.from({ length: days }, (_, idx) => {
      const day = addDays(from, idx);
      return {
        key: day.toISOString(),
        label: dayLabel(day),
        from: startOfDay(day),
        to: endOfDay(day),
      };
    });
  }

  const months = duration === 'last_6_months' ? 6 : 12;
  const start = startOfMonth(addMonths(now, -(months - 1)));
  return Array.from({ length: months }, (_, idx) => {
    const monthStart = addMonths(start, idx);
    return {
      key: monthStart.toISOString(),
      label: monthLabel(monthStart),
      from: startOfMonth(monthStart),
      to: endOfMonth(monthStart),
    };
  });
};

const getAppointmentDate = (appointment: Appointment): Date | null =>
  toDate(appointment.startTime) ?? toDate(appointment.appointmentDate);

const getTaskDate = (task: Task): Date | null =>
  toDate(task.createdAt) ?? toDate(task.dueAt) ?? toDate(task.updatedAt);

const getInvoiceDate = (invoice: Invoice): Date | null =>
  toDate(invoice.paidAt) ?? toDate(invoice.createdAt);

const getSpecialityLabel = (appointment?: Appointment) =>
  appointment?.appointmentType?.speciality?.name ||
  appointment?.appointmentType?.name ||
  'Uncategorized';

const buildMockAppointmentChart = (
  buckets: TimeBucket[],
  teamSize: number
): AppointmentChartPoint[] => {
  const base = Math.max(1, teamSize);
  return buckets.map((bucket, index) => ({
    month: bucket.label,
    Completed: base + (index % 3) + Math.floor(index / 3),
    Cancelled: Math.floor((index + 1) / 3),
  }));
};

const buildMockRevenueChart = (buckets: TimeBucket[], teamSize: number): RevenueChartPoint[] => {
  const base = Math.max(1, teamSize) * 120;
  return buckets.map((bucket, index) => ({
    month: bucket.label,
    Completed: base + index * 45 + (index % 2) * 20,
    Cancelled: (index % 3) * 35,
  }));
};

const fallbackServiceLabels = ['General Medicine', 'Surgery', 'Oncology'];

const uniqStrings = (values: string[]) => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output;
};

const normalizeStatus = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const isCompletedAppointment = (status: unknown) => {
  const normalized = normalizeStatus(status);
  return normalized === 'COMPLETED' || normalized === 'FULFILLED';
};

const isCancelledAppointment = (status: unknown) => {
  const normalized = normalizeStatus(status);
  return normalized === 'CANCELLED' || normalized === 'CANCELED' || normalized === 'NO_SHOW';
};

export const useDashboardAnalytics = (duration: DashboardDuration) => {
  const appointments = useAppointmentsForPrimaryOrg();
  const tasks = useTasksForPrimaryOrg();
  const invoices = useInvoicesForPrimaryOrg();
  const team = useTeamForPrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const getSpecialitiesByOrgId = useSpecialityStore((s) => s.getSpecialitiesByOrgId);
  const specialities = useMemo(
    () => (primaryOrgId ? getSpecialitiesByOrgId(primaryOrgId) : []),
    [primaryOrgId, getSpecialitiesByOrgId]
  );
  const useMock = isDashboardMockMode();

  return useMemo(() => {
    const { from, to } = getDurationRange(duration);
    const buckets = getTimeBuckets(duration);

    const filteredAppointments = appointments.filter((appointment) => {
      const date = getAppointmentDate(appointment);
      return date ? isWithinRange(date, from, to) : false;
    });

    const filteredTasks = tasks.filter((task) => {
      const date = getTaskDate(task);
      return date ? isWithinRange(date, from, to) : false;
    });

    const filteredInvoices = invoices.filter((invoice) => {
      const date = getInvoiceDate(invoice);
      return date ? isWithinRange(date, from, to) : false;
    });

    const paidRevenue = filteredInvoices
      .filter((invoice) => invoice.status === 'PAID')
      .reduce((sum, invoice) => sum + (invoice.totalAmount ?? 0), 0);

    const cancelledRevenue = filteredInvoices
      .filter((invoice) => ['CANCELLED', 'FAILED', 'REFUNDED'].includes(invoice.status))
      .reduce((sum, invoice) => sum + (invoice.totalAmount ?? 0), 0);

    const appointmentsChart: AppointmentChartPoint[] = buckets.map((bucket) => {
      let completed = 0;
      let cancelled = 0;

      for (const appointment of filteredAppointments) {
        const date = getAppointmentDate(appointment);
        if (!date || !isWithinRange(date, bucket.from, bucket.to)) continue;
        if (isCompletedAppointment(appointment.status)) completed += 1;
        if (isCancelledAppointment(appointment.status)) cancelled += 1;
      }

      return {
        month: bucket.label,
        Completed: completed,
        Cancelled: cancelled,
      };
    });

    const revenueChart: RevenueChartPoint[] = buckets.map((bucket) => {
      let completed = 0;
      let cancelled = 0;

      for (const invoice of filteredInvoices) {
        const date = getInvoiceDate(invoice);
        if (!date || !isWithinRange(date, bucket.from, bucket.to)) continue;
        if (invoice.status === 'PAID') {
          completed += invoice.totalAmount ?? 0;
        }
        if (['CANCELLED', 'FAILED', 'REFUNDED'].includes(invoice.status)) {
          cancelled += invoice.totalAmount ?? 0;
        }
      }

      return {
        month: bucket.label,
        Completed: completed,
        Cancelled: cancelled,
      };
    });

    const leaderMap = new Map<string, { label: string; Completed: number; Cancelled: number }>();

    for (const appointment of filteredAppointments) {
      const leadId = appointment.lead?.id || 'unassigned';
      const label = appointment.lead?.name || 'Unassigned';
      const entry = leaderMap.get(leadId) ?? { label, Completed: 0, Cancelled: 0 };
      if (isCompletedAppointment(appointment.status)) entry.Completed += 1;
      if (isCancelledAppointment(appointment.status)) entry.Cancelled += 1;
      leaderMap.set(leadId, entry);
    }

    const appointmentLeaders: LeaderPoint[] = Array.from(leaderMap.values())
      .sort((a, b) => b.Completed + b.Cancelled - (a.Completed + a.Cancelled))
      .slice(0, 6)
      .map((leader) => ({
        month: leader.label,
        Completed: leader.Completed,
        Cancelled: leader.Cancelled,
      }));

    const appointmentById = new Map(
      appointments
        .filter((appointment) => Boolean(appointment.id))
        .map((appointment) => [appointment.id as string, appointment])
    );

    const revenueLeaderMap = new Map<string, number>();
    for (const invoice of filteredInvoices) {
      if (invoice.status !== 'PAID') continue;
      if (!invoice.appointmentId) continue;
      const appointment = appointmentById.get(invoice.appointmentId);
      const label = getSpecialityLabel(appointment);
      revenueLeaderMap.set(label, (revenueLeaderMap.get(label) ?? 0) + (invoice.totalAmount ?? 0));
    }

    const revenueLeaders: RevenueLeader[] = Array.from(revenueLeaderMap.entries())
      .map(([label, revenue]) => ({ label, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);

    const staffOnDuty = team.filter((member) => member.status !== 'Off-Duty').length;

    const appointmentDates = appointments.map(getAppointmentDate);
    const taskDates = tasks.map(getTaskDate);
    const invoiceDates = invoices.map(getInvoiceDate);

    if (useMock) {
      const mockAppointmentsChart = buildMockAppointmentChart(buckets, team.length);
      const mockRevenueChart = buildMockRevenueChart(buckets, team.length);
      const teamEntries = team.length ? team : [{ name: 'Team Member' }];
      const mockAppointmentLeaders = teamEntries.slice(0, 6).map((member, index) => ({
        month: member.name || `Team ${index + 1}`,
        Completed: 6 - index + (index % 2),
        Cancelled: Math.floor(index / 2),
      }));

      const serviceLabels = uniqStrings([
        ...specialities.map((speciality) => speciality.name),
        ...appointments
          .map((appointment) => appointment.appointmentType?.speciality?.name)
          .filter((label): label is string => Boolean(label)),
      ]);
      const labels = serviceLabels.length > 0 ? serviceLabels.slice(0, 3) : fallbackServiceLabels;
      const mockRevenueLeaders = labels.map((label, index) => ({
        label,
        revenue: (3 - index) * 450 + team.length * 25,
      }));

      return {
        explore: {
          revenue: paidRevenue,
          appointments: filteredAppointments.length,
          tasks: filteredTasks.length,
          staffOnDuty,
        },
        charts: {
          appointments: mockAppointmentsChart,
          revenue: mockRevenueChart,
        },
        appointmentLeaders: mockAppointmentLeaders,
        revenueLeaders: mockRevenueLeaders,
        durationOptions: {
          explore: DASHBOARD_DURATION_OPTIONS,
          appointments: DASHBOARD_DURATION_OPTIONS,
          revenue: DASHBOARD_DURATION_OPTIONS,
          appointmentLeaders: DASHBOARD_DURATION_OPTIONS,
          revenueLeaders: DASHBOARD_DURATION_OPTIONS,
        },
        emptyState: {
          explore:
            paidRevenue === 0 &&
            filteredAppointments.length === 0 &&
            filteredTasks.length === 0 &&
            staffOnDuty === 0,
          appointmentsChart: false,
          revenueChart: false,
          appointmentLeaders: false,
          revenueLeaders: false,
        },
        totals: {
          paidRevenue,
          cancelledRevenue,
        },
      };
    }

    return {
      explore: {
        revenue: paidRevenue,
        appointments: filteredAppointments.length,
        tasks: filteredTasks.length,
        staffOnDuty,
      },
      charts: {
        appointments: appointmentsChart,
        revenue: revenueChart,
      },
      appointmentLeaders,
      revenueLeaders,
      durationOptions: {
        explore: durationOptionsForDates([...appointmentDates, ...taskDates, ...invoiceDates]),
        appointments: durationOptionsForDates(appointmentDates),
        revenue: durationOptionsForDates(invoiceDates),
        appointmentLeaders: durationOptionsForDates(appointmentDates),
        revenueLeaders: durationOptionsForDates(invoiceDates),
      },
      emptyState: {
        explore:
          paidRevenue === 0 &&
          filteredAppointments.length === 0 &&
          filteredTasks.length === 0 &&
          staffOnDuty === 0,
        appointmentsChart: filteredAppointments.length === 0,
        revenueChart: filteredInvoices.length === 0,
        appointmentLeaders:
          appointmentLeaders.length === 0 ||
          appointmentLeaders.every((leader) => leader.Completed === 0 && leader.Cancelled === 0),
        revenueLeaders: revenueLeaders.length === 0,
      },
      totals: {
        paidRevenue,
        cancelledRevenue,
      },
    };
  }, [appointments, tasks, invoices, team, duration, specialities, useMock]);
};
