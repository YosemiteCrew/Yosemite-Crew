import React, { useMemo, useState } from 'react';
import {
  LuArrowRight,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuEye,
  LuEyeOff,
  LuPlus,
  LuRefreshCw,
} from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import Datepicker from '@/app/ui/inputs/Datepicker';
import Timepicker from '@/app/ui/inputs/Timepicker';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { getStatusStyle } from '@/app/config/statusConfig';
import type { ScheduleTask, ScheduleTaskStatus } from '@/app/features/appointments/types/workspace';
import type { TemplateLike } from '@yosemite-crew/types';

type AssigneeOption = { label: string; value: string };

type InpatientScheduleProps = {
  tasks: ScheduleTask[];
  templates?: TemplateLike[];
  readOnly: boolean;
  /** Real staff (team members + appointment lead/support) available to own a task. */
  assigneeOptions: AssigneeOption[];
  onAddTask: (task: Omit<ScheduleTask, 'id'>) => void;
  onUpdateTask: (id: string, patch: Partial<ScheduleTask>) => void;
  /** Commit a task's edited breakdown (start/end/time) to the backend. */
  onRecordTask?: (id: string) => void;
  onApplyTemplate?: (templateId: string) => void;
  /**
   * Lifecycle state of the applied schedule, when one exists. When `active` is a
   * non-null instance id the pause/resume/cancel/regenerate controls are shown and
   * call the matching backend action. `paused` toggles pause⇄resume.
   */
  scheduleLifecycle?: {
    instanceId: string | null;
    paused: boolean;
    busy: boolean;
    onPause: () => void;
    onResume: () => void;
    onCancel: () => void;
    onRegenerate: () => void;
  };
};

const STATUS_OPTIONS: { label: string; value: ScheduleTaskStatus }[] = [
  { label: 'Upcoming', value: 'UPCOMING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Pending', value: 'PENDING' },
];
const EMPTY_TEMPLATES: TemplateLike[] = [];

const formatStatusLabel = (status: ScheduleTaskStatus): string =>
  STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;

/** Shared status colours (same source of truth as the appointment status pill). */
const statusPillStyle = (status: ScheduleTaskStatus): React.CSSProperties => {
  const s = getStatusStyle(status);
  return { color: s.color, backgroundColor: s.backgroundColor, borderColor: s.borderColor };
};

/**
 * Status pill that opens a small menu to reassign the task status. Uses the same
 * border styles/colours as the appointment status pill, and shows a coloured dot
 * per option in the dropdown (matching the calendar popover).
 */
const StatusPillSelect = ({
  status,
  onChange,
}: {
  status: ScheduleTaskStatus;
  onChange: (status: ScheduleTaskStatus) => void;
}) => {
  const [open, setOpen] = useState(false);
  // Completed tasks are final: render a static pill (no caret, not changeable).
  const locked = status === 'COMPLETED';

  if (locked) {
    return (
      <span
        className="flex h-8 w-full items-center justify-center rounded-2xl border px-3 text-caption-1"
        style={statusPillStyle(status)}
      >
        {formatStatusLabel(status)}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Status"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-2xl border px-3 text-caption-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        style={statusPillStyle(status)}
      >
        {formatStatusLabel(status)}
        <LuChevronDown
          size={12}
          aria-hidden="true"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]"
        >
          {STATUS_OPTIONS.map((option) => {
            const s = getStatusStyle(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                // onMouseDown fires before the trigger's onBlur closes the menu.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-caption-1 hover:bg-neutral-100"
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-2 shrink-0 rounded-full border"
                  style={{ backgroundColor: s.borderColor, borderColor: s.borderColor }}
                />
                <span style={{ color: s.color }}>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** "MMM d, yyyy" string ⇄ the Datepicker's `Date | null` value. */
const parseTaskDate = (value?: string): Date | null => {
  if (!value) return null;
  // ISO date-only strings ("2026-06-23") parse as UTC midnight, which shifts a
  // calendar day in negative-offset timezones. Parse those as a local date so
  // day comparisons line up with the locally-rendered "MMM d, yyyy" dates.
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const formatTaskDate = (date: Date | null): string | undefined =>
  date
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : undefined;

/** "h:mm AM/PM" (stored/displayed) ⇄ the Timepicker's 24-hour "HH:mm" value. */
const toTimepickerValue = (value?: string): string => {
  if (!value) return '';
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return '';
  let hours = Number.parseInt(match[1], 10);
  const minutes = match[2];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
};
const fromTimepickerValue = (value: string): string | undefined => {
  if (!value) return undefined;
  const [hourRaw, minute] = value.split(':');
  const hours = Number.parseInt(hourRaw, 10);
  if (!Number.isFinite(hours)) return undefined;
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${minute} ${meridiem}`;
};

/** Vertical timeline marker: outer ring + solid centre dot (matches the stepper). */
const TimelineMarker = ({ active }: { active: boolean }) => {
  const ring = active ? 'border-text-brand' : 'border-neutral-300';
  const dot = active ? 'bg-text-brand' : 'bg-neutral-300';
  return (
    <span
      aria-hidden="true"
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-neutral-0 ${ring}`}
    >
      <span className={`size-2 rounded-full ${dot}`} />
    </span>
  );
};

/**
 * Nested "Task breakdown" floating container shown when a row is expanded. Reuses
 * the shared Datepicker (Starts/Ends) and Timepicker (Set Time); all three fields
 * are 48px tall and vertically centre with the Record button.
 */
const TaskBreakdown = ({
  task,
  readOnly,
  onUpdateTask,
  onRecordTask,
}: {
  task: ScheduleTask;
  readOnly: boolean;
  onUpdateTask: (id: string, patch: Partial<ScheduleTask>) => void;
  onRecordTask?: (id: string) => void;
}) => (
  <div className="mt-4">
    <SectionContainer title="Task breakdown" nested className="bg-neutral-0">
      <div
        className={`grid items-center gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] ${
          readOnly ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <Datepicker
          type="input"
          placeholder="Starts"
          currentDate={parseTaskDate(task.startDate)}
          setCurrentDate={
            ((next: Date | null) =>
              onUpdateTask(task.id, {
                startDate: formatTaskDate(next),
              })) as React.Dispatch<React.SetStateAction<Date | null>>
          }
        />
        <Datepicker
          type="input"
          placeholder="Ends"
          currentDate={parseTaskDate(task.endDate)}
          setCurrentDate={
            ((next: Date | null) =>
              onUpdateTask(task.id, {
                endDate: formatTaskDate(next),
              })) as React.Dispatch<React.SetStateAction<Date | null>>
          }
        />
        <Timepicker
          label="Set Time"
          value={toTimepickerValue(task.time)}
          onChange={(value) => onUpdateTask(task.id, { time: fromTimepickerValue(value) })}
        />
        <Primary
          text="Record"
          icon={<LuArrowRight aria-hidden="true" />}
          iconPosition="right"
          onClick={() => onRecordTask?.(task.id)}
          isDisabled={readOnly}
        />
      </div>
    </SectionContainer>
  </div>
);

const InpatientSchedule = ({
  tasks,
  templates = EMPTY_TEMPLATES,
  readOnly,
  assigneeOptions,
  onAddTask,
  onUpdateTask,
  onRecordTask,
  onApplyTemplate,
  scheduleLifecycle,
}: InpatientScheduleProps) => {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(tasks[0]?.id ?? null);
  // Day the schedule is focused on. Defaults to today; prev/next shift by a day.
  // Time is zeroed so day comparisons are stable regardless of clock time.
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const shiftSelectedDate = (deltaDays: number) => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + deltaDays);
      return next;
    });
  };

  const todayAtMidnight = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const dateLabel = useMemo(() => {
    const formatted = selectedDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return isSameDay(selectedDate, todayAtMidnight) ? `Today ${formatted}` : formatted;
  }, [selectedDate, todayAtMidnight]);

  // A task belongs to the selected day when its date window covers it. Tasks
  // with no dates are always shown so manually-added items aren't hidden.
  const tasksForSelectedDay = useMemo(() => {
    return tasks.filter((task) => {
      const start = parseTaskDate(task.startDate);
      const end = parseTaskDate(task.endDate) ?? start;
      if (!start) return true;
      const startDay = new Date(start);
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date(end ?? start);
      endDay.setHours(0, 0, 0, 0);
      return selectedDate >= startDay && selectedDate <= endDay;
    });
  }, [tasks, selectedDate]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tasksForSelectedDay;
    return tasksForSelectedDay.filter((task) =>
      [task.description, task.category, task.assignedToName, task.status].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query)
      )
    );
  }, [search, tasksForSelectedDay]);

  const handleAddTask = () => {
    onAddTask({
      description: 'Unassigned treatment task',
      category: 'Care',
      status: 'UPCOMING',
      autoGenerated: false,
      startDate: formatTaskDate(selectedDate),
      endDate: formatTaskDate(selectedDate),
    });
  };

  const handleToggleExpanded = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <SectionContainer
      titleClassName="text-yc-20-b-primary"
      title="Schedule"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-body-3-emphasis text-text-primary">
          <CircleIconButton
            icon={<LuChevronLeft aria-hidden="true" />}
            label="Previous day"
            onClick={() => shiftSelectedDate(-1)}
          />
          <span className="text-text-brand">{dateLabel}</span>
          <CircleIconButton
            icon={<LuChevronRight aria-hidden="true" />}
            label="Next day"
            onClick={() => shiftSelectedDate(1)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {templates.length > 0 && (
            <div className="w-full sm:w-70">
              <LabelDropdown
                placeholder="Load schedule template"
                options={templates.map((template) => ({
                  label: template.name,
                  value: template.id,
                }))}
                searchable
                onSelect={(option) => onApplyTemplate?.(option.value)}
              />
            </div>
          )}
          {scheduleLifecycle?.instanceId && !readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              {scheduleLifecycle.paused ? (
                <Secondary
                  text="Resume"
                  onClick={scheduleLifecycle.onResume}
                  isDisabled={scheduleLifecycle.busy}
                />
              ) : (
                <Secondary
                  text="Pause"
                  onClick={scheduleLifecycle.onPause}
                  isDisabled={scheduleLifecycle.busy}
                />
              )}
              <Secondary
                text="Regenerate"
                onClick={scheduleLifecycle.onRegenerate}
                isDisabled={scheduleLifecycle.busy}
                icon={<LuRefreshCw aria-hidden="true" />}
              />
              <Secondary
                text="Cancel schedule"
                onClick={scheduleLifecycle.onCancel}
                isDisabled={scheduleLifecycle.busy}
              />
            </div>
          )}
          <CircleIconButton
            icon={<LuPlus aria-hidden="true" />}
            label="Add schedule task"
            variant="dark"
            disabled={readOnly}
            onClick={handleAddTask}
          />
          <Search
            value={search}
            setSearch={setSearch}
            placeholder="Search for task"
            label="Search schedule tasks"
          />
        </div>
      </div>

      <ol className="flex flex-col">
        {filteredTasks.map((task, index) => {
          const expanded = expandedId === task.id;
          const isFirst = index === 0;
          const isLast = index === filteredTasks.length - 1;
          return (
            <li key={task.id} className="flex gap-3">
              {/* Time + vertical timeline rail (marker centred, line running through) */}
              <span className="w-20 shrink-0 pt-4 text-right text-body-4 font-medium text-pill-success-text">
                {task.time ?? '-'}
              </span>
              <div className="relative flex shrink-0 flex-col items-center">
                <span className={`h-4 w-px flex-none ${isFirst ? '' : 'bg-card-border'}`} />
                <TimelineMarker active={task.status !== 'CANCELLED'} />
                <span className={`w-px flex-1 ${isLast ? '' : 'bg-card-border'}`} />
              </div>
              <div className="mb-3 flex-1 rounded-2xl border border-card-border p-4">
                <div className="grid gap-3 text-body-4 text-text-primary lg:grid-cols-[1.4fr_120px_180px_140px_110px] lg:items-center">
                  <span>{task.description}</span>
                  <span>{task.category}</span>
                  <LabelDropdown
                    placeholder="Assigned to"
                    options={assigneeOptions}
                    defaultOption={task.assignedToId ?? task.assignedToName}
                    searchable={false}
                    onSelect={(option) =>
                      onUpdateTask(task.id, {
                        assignedToId: option.value,
                        assignedToName: option.label,
                      })
                    }
                  />
                  <StatusPillSelect
                    status={task.status}
                    onChange={(status) => onUpdateTask(task.id, { status })}
                  />
                  <div className="flex justify-end gap-2">
                    <CircleIconButton
                      icon={<LuRefreshCw aria-hidden="true" />}
                      label={`Reschedule ${task.description}`}
                      disabled={readOnly}
                      // Reschedule expands the row so the real time/date pickers in
                      // the breakdown are used — no hardcoded placeholder time.
                      onClick={() => setExpandedId(task.id)}
                    />
                    <CircleIconButton
                      icon={
                        expanded ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />
                      }
                      label={expanded ? `Hide ${task.description}` : `View ${task.description}`}
                      variant="dark"
                      onClick={() => handleToggleExpanded(task.id)}
                    />
                  </div>
                </div>
                {expanded && (
                  <TaskBreakdown
                    task={task}
                    readOnly={readOnly}
                    onUpdateTask={onUpdateTask}
                    onRecordTask={onRecordTask}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {filteredTasks.length === 0 && (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          {search.trim()
            ? 'No schedule tasks match this search.'
            : 'No schedule tasks for this day.'}
        </p>
      )}
    </SectionContainer>
  );
};

export default InpatientSchedule;
