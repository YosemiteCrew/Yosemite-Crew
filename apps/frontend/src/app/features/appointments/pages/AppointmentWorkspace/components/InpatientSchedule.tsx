import React, { useMemo, useState } from 'react';
import {
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuEye,
  LuPlus,
  LuSearch,
} from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { getStatusStyle } from '@/app/config/statusConfig';
import type { ScheduleTask, ScheduleTaskStatus } from '@/app/features/appointments/types/workspace';
import type { TemplateLike } from '@yosemite-crew/types';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';

type AssigneeOption = { label: string; value: string };

type InpatientScheduleProps = {
  tasks: ScheduleTask[];
  /** Published schedule/task templates that the search can find and append. */
  templates?: TemplateLike[];
  readOnly: boolean;
  /** Real staff (team members + appointment lead/support) available to own a task. */
  assigneeOptions: AssigneeOption[];
  /** Open the Quick Actions add-task flow (side modal) — no inline add. */
  onAddTask: () => void;
  /** Open a task in the Quick Actions side modal (view/edit). */
  onViewTask: (taskId: string) => void;
  /** Reassign a task inline. */
  onAssignTask: (taskId: string, option: AssigneeOption) => void;
  /** Change a task's status inline. */
  onStatusChange: (taskId: string, status: ScheduleTaskStatus) => void;
  /** Append a template's task blocks into the schedule as staged rows. */
  onAppendTemplate?: (templateId: string) => void;
};

const STATUS_OPTIONS: { label: string; value: ScheduleTaskStatus }[] = [
  { label: 'Upcoming', value: 'UPCOMING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Pending', value: 'PENDING' },
];
const EMPTY_TEMPLATES: TemplateLike[] = [];
const ASSIGNEE_COLUMN_MIN_CH = 14;
const ASSIGNEE_COLUMN_MAX_CH = 20;

const formatStatusLabel = (status: ScheduleTaskStatus): string =>
  STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatTimelineLabel = (task: ScheduleTask): { primary: string; secondary?: string } => {
  const dateLabel = task.startDate ? formatStampDate(task.startDate) : undefined;
  const timeLabel = task.time?.trim();
  if (dateLabel && timeLabel) return { primary: timeLabel, secondary: dateLabel };
  if (timeLabel) return { primary: timeLabel };
  if (dateLabel) return { primary: dateLabel };
  return { primary: '—' };
};

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

/** Read-only category pill (neutral style), matching the schedule design. */
const CategoryPill = ({ category }: { category?: string }) => (
  <span className="inline-flex w-fit items-center rounded-2xl border border-pill-neutral-border bg-pill-neutral-bg px-3 py-1.5 text-caption-1 text-pill-neutral-text">
    {category || '—'}
  </span>
);

/** "MMM d, yyyy" string → local Date for day-window comparisons. */
const parseTaskDate = (value?: string): Date | null => {
  if (!value) return null;
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

const InpatientSchedule = ({
  tasks,
  templates = EMPTY_TEMPLATES,
  readOnly,
  assigneeOptions,
  onAddTask,
  onViewTask,
  onAssignTask,
  onStatusChange,
  onAppendTemplate,
}: InpatientScheduleProps) => {
  const [search, setSearch] = useState('');
  // Day the schedule is focused on. Defaults to today; prev/next shift by a day.
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

  const query = search.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    if (!query) return tasksForSelectedDay;
    return tasksForSelectedDay.filter((task) =>
      [task.description, task.category, task.assignedToName, task.status].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query)
      )
    );
  }, [query, tasksForSelectedDay]);

  // The search box doubles as a task-template finder: when the query matches a
  // published template's name, offer it as a suggestion that appends its blocks.
  const templateSuggestions = useMemo(() => {
    if (!query || !onAppendTemplate) return [];
    return templates.filter((template) => template.name?.toLowerCase().includes(query)).slice(0, 5);
  }, [query, templates, onAppendTemplate]);

  const assigneeColumnWidthCh = useMemo(() => {
    const maxLabelLength = assigneeOptions.reduce(
      (longest, option) => Math.max(longest, option.label.trim().length),
      'Assigned to'.length
    );
    return clamp(maxLabelLength + 2, ASSIGNEE_COLUMN_MIN_CH, ASSIGNEE_COLUMN_MAX_CH);
  }, [assigneeOptions]);

  const scheduleHeaderGridStyle: React.CSSProperties = {
    gridTemplateColumns: `96px 20px 150px minmax(0, 1fr) ${assigneeColumnWidthCh}ch 140px 72px`,
  };

  const scheduleRowGridStyle: React.CSSProperties = {
    gridTemplateColumns: `150px minmax(0, 1fr) ${assigneeColumnWidthCh}ch 140px 72px`,
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
          <CircleIconButton
            icon={<LuPlus aria-hidden="true" />}
            label="Add schedule task"
            variant="dark"
            disabled={readOnly}
            onClick={onAddTask}
          />
          {/* Search finds tasks AND published task templates (append on select). */}
          <div className="relative w-full sm:w-80">
            <div className="flex items-center gap-2 rounded-2xl border border-input-border-default px-3 py-2.5">
              <LuSearch size={16} aria-hidden="true" className="shrink-0 text-text-secondary" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search tasks, assignees or templates"
                placeholder="Search for tasks, assignees…"
                className="w-full bg-transparent text-body-4 text-text-primary outline-none placeholder:text-input-text-placeholder"
              />
            </div>
            {templateSuggestions.length > 0 && (
              <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
                <p className="px-3 pt-2 text-caption-2 text-text-secondary">Task templates</p>
                {templateSuggestions.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      onAppendTemplate?.(template.id);
                      setSearch('');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-4 text-text-primary hover:bg-neutral-100 disabled:opacity-50"
                  >
                    <LuPlus size={14} aria-hidden="true" className="shrink-0 text-text-brand" />
                    {template.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {filteredTasks.length > 0 && (
        <div
          className="hidden items-center gap-4 text-caption-2 text-text-secondary lg:grid lg:gap-6"
          style={scheduleHeaderGridStyle}
        >
          <span>Timeline</span>
          <span aria-hidden="true" />
          <span>Category</span>
          <span>Task</span>
          <span className="-ml-[20px]">Assigned to</span>
          <span>Status</span>
          <span className="text-right">Action</span>
        </div>
      )}

      <ol className="flex flex-col">
        {filteredTasks.map((task, index) => {
          const isFirst = index === 0;
          const isLast = index === filteredTasks.length - 1;
          return (
            <li
              key={task.id}
              className="grid grid-cols-[96px_20px_1fr] items-center gap-4 lg:gap-6"
            >
              {/* Timeline column: keep the time text centered against the row body. */}
              {(() => {
                const timeline = formatTimelineLabel(task);
                return (
                  <div className="flex min-h-[84px] flex-col items-end justify-center py-3 text-right">
                    <span className="text-caption-1 font-normal text-pill-success-text">
                      {timeline.primary}
                    </span>
                    {timeline.secondary && (
                      <span className="text-caption-2 text-text-secondary">
                        {timeline.secondary}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="relative flex min-h-[84px] items-center justify-center py-3">
                <span
                  className={`absolute left-1/2 top-0 w-px -translate-x-1/2 ${isFirst ? 'bg-transparent' : 'bg-card-border'}`}
                  style={{ height: 'calc(50% - 10px)' }}
                />
                <TimelineMarker active={task.status !== 'CANCELLED'} />
                <span
                  className={`absolute bottom-0 left-1/2 w-px -translate-x-1/2 ${isLast ? 'bg-transparent' : 'bg-card-border'}`}
                  style={{ height: 'calc(50% - 10px)' }}
                />
              </div>
              {/* Row content: flat (no card), columns aligned with the header. */}
              <div
                className="grid min-h-[84px] gap-4 border-b border-card-border py-4 lg:items-center lg:gap-6"
                style={scheduleRowGridStyle}
              >
                <div className="flex min-h-[48px] items-center">
                  <CategoryPill category={task.category} />
                </div>
                <div className="flex min-h-[48px] min-w-0 flex-col justify-center leading-[140%]">
                  <span className="truncate text-body-4 text-text-primary">{task.description}</span>
                  {task.subtext && (
                    <span className="truncate text-caption-1 text-text-secondary">
                      {task.subtext}
                    </span>
                  )}
                </div>
                <div className="flex min-h-[48px] items-center justify-start self-center">
                  <div className="w-full max-w-full">
                    <LabelDropdown
                      placeholder="Assigned to"
                      options={assigneeOptions}
                      defaultOption={
                        task.assignedToName ??
                        assigneeOptions.find((option) => option.value === task.assignedToId)
                          ?.label ??
                        task.assignedToId
                      }
                      searchable={false}
                      onSelect={(option) =>
                        onAssignTask(task.id, { label: option.label, value: option.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex min-h-[48px] items-center">
                  <StatusPillSelect
                    status={task.status}
                    onChange={(status) => onStatusChange(task.id, status)}
                  />
                </div>
                <div className="flex min-h-[48px] items-center justify-end">
                  <CircleIconButton
                    icon={<LuEye aria-hidden="true" />}
                    label={`View ${task.description}`}
                    variant="dark"
                    onClick={() => onViewTask(task.id)}
                  />
                </div>
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
