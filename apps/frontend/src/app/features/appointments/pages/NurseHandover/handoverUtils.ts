import type { AppointmentWithCompanion } from '@/app/features/appointments/types/appointments';
import type { Task } from '@/app/features/tasks/types/task';

type HandoverAppointment = AppointmentWithCompanion & { id: string };
type HandoverVisit = { appointment: HandoverAppointment; openTasks: Task[] };

const OPEN_TASK_STATUSES = new Set<Task['status']>(['PENDING', 'IN_PROGRESS']);
const ACTIVE_APPOINTMENT_STATUSES = new Set(['CHECKED_IN', 'IN_PROGRESS']);

export const getHandoverVisits = (
  appointments: AppointmentWithCompanion[],
  tasks: Task[]
): HandoverVisit[] => {
  const appointmentsWithIds = appointments.filter(
    (appointment): appointment is HandoverAppointment => Boolean(appointment.id)
  );
  const openTasksByAppointment = new Map<string, Task[]>(
    appointmentsWithIds.map(({ id }) => [id, []])
  );

  tasks.forEach((task) => {
    if (
      task.audience !== 'EMPLOYEE_TASK' ||
      !task.appointmentId ||
      !OPEN_TASK_STATUSES.has(task.status) ||
      !openTasksByAppointment.has(task.appointmentId)
    )
      return;
    openTasksByAppointment.get(task.appointmentId)!.push(task);
  });

  return appointmentsWithIds
    .reduce<HandoverVisit[]>((visits, appointment) => {
      const openTasks = openTasksByAppointment.get(appointment.id)!;
      if (ACTIVE_APPOINTMENT_STATUSES.has(appointment.status) || openTasks.length > 0) {
        visits.push({ appointment, openTasks });
      }
      return visits;
    }, [])
    .sort(
      (left, right) =>
        new Date(left.appointment.startTime).getTime() -
        new Date(right.appointment.startTime).getTime()
    );
};
