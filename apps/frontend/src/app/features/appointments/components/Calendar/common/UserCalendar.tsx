import React, { useEffect, useMemo, useRef } from "react";
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  appointentsForUser,
  getFirstRelevantTimedEventStart,
  getTopPxForMinutes,
  isSameDay,
  nextDay,
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
  minutesSinceStartOfDay,
  scrollContainerToTarget,
  startOfDayDate,
  EVENT_VERTICAL_GAP_PX,
} from "@/app/features/appointments/components/Calendar/helpers";
import { eventsForDayHour, HOURS_IN_DAY } from "@/app/features/appointments/components/Calendar/weekHelpers";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import UserLabels from "@/app/features/appointments/components/Calendar/common/UserLabels";
import Slot from "@/app/features/appointments/components/Calendar/common/Slot";
import { Appointment } from "@yosemite-crew/types";
import Back from "@/app/ui/primitives/Icons/Back";
import Next from "@/app/ui/primitives/Icons/Next";
import { useCalendarNavigation } from "@/app/hooks/useCalendarNavigation";

type UserCalendarProps = {
  events: Appointment[];
  date: Date;
  handleViewAppointment: any;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  handleRescheduleAppointment: any;
  handleChangeStatusAppointment?: any;
  canEditAppointments: boolean;
  draggedAppointmentId?: string | null;
  draggedAppointmentLabel?: string | null;
  canDragAppointment?: (appointment: Appointment) => boolean;
  onAppointmentDragStart?: (appointment: Appointment) => void;
  onAppointmentDragEnd?: () => void;
  onAppointmentDropAt?: (date: Date, minuteOfDay: number, targetLeadId?: string) => void;
  onDragHoverTarget?: (date: Date, targetLeadId?: string) => void;
  getDropAvailabilityIntervals?: (
    date: Date,
    targetLeadId?: string
  ) => Array<{ startMinute: number; endMinute: number }>;
  draggedAppointmentDurationMinutes?: number;
};

const UserCalendar: React.FC<UserCalendarProps> = ({
  events,
  date,
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  setCurrentDate,
  canEditAppointments,
  draggedAppointmentId,
  draggedAppointmentLabel,
  canDragAppointment,
  onAppointmentDragStart,
  onAppointmentDragEnd,
  onAppointmentDropAt,
  onDragHoverTarget,
  getDropAvailabilityIntervals,
  draggedAppointmentDurationMinutes,
}) => {
  const HOUR_ROW_TOP_OFFSET_PX = 8;
  const team = useTeamForPrimaryOrg();
  const { handleNextDay, handlePrevDay } = useCalendarNavigation(setCurrentDate);
  const height = (PIXELS_PER_STEP / MINUTES_PER_STEP) * 60;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const nowPosition = useMemo(() => {
    const now = new Date();
    if (!isSameDay(now, date)) return null;
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const topPx = getTopPxForMinutes(
      minutesSinceMidnight,
      height,
      EVENT_VERTICAL_GAP_PX,
      HOUR_ROW_TOP_OFFSET_PX
    );
    return { topPx };
  }, [date, height]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const rangeStart = startOfDayDate(date);
    const rangeEnd = nextDay(date);
    const focusStart = getFirstRelevantTimedEventStart(
      events,
      rangeStart,
      rangeEnd
    );
    const topPx = nowPosition
      ? Math.max(0, nowPosition.topPx)
      : getTopPxForMinutes(
          focusStart
            ? minutesSinceStartOfDay(focusStart)
            : DEFAULT_CALENDAR_FOCUS_MINUTES,
          height,
          EVENT_VERTICAL_GAP_PX,
          HOUR_ROW_TOP_OFFSET_PX
        );
    scrollContainerToTarget(scrollRef.current, topPx);
  }, [date, events, height, nowPosition]);

  return (
    <div className="h-full flex flex-col">
      <div
        className="w-full flex-1 overflow-x-auto relative max-w-[calc(100vw-32px)] sm:max-w-[calc(100vw-96px)] lg:max-w-[calc(100vw-300px)]"
        data-calendar-scroll="true"
      >
        <div className="min-w-max">
          <div className="grid border-b border-grey-light py-3 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max bg-white">
            <div className="sticky left-0 z-30 bg-white flex items-center justify-center">
              <Back onClick={handlePrevDay} />
            </div>
            <div className="bg-white min-w-max">
              <UserLabels team={team} currentDate={date} />
            </div>
            <div className="sticky right-0 z-30 bg-white flex items-center justify-center">
              <Next onClick={handleNextDay} />
            </div>
          </div>

          <div
            ref={scrollRef}
            className="max-h-[520px] overflow-y-auto relative"
            data-calendar-scroll="true"
          >
            {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
              <div
                key={hour}
                className="grid gap-y-0.5 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max"
              >
                <div
                  className="sticky left-0 z-20 bg-white text-caption-2 text-text-primary pl-2!"
                  style={{ height: height + "px", opacity: hour === 0 ? 0 : 1 }}
                >
                  {new Date(0, 0, 0, hour, 0, 0).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <div className="grid grid-flow-col auto-cols-[170px] min-w-max">
                  {team?.map((user, index) => {
                    const slotEvents = eventsForDayHour(
                      appointentsForUser(events, user),
                      date,
                      hour
                    );
                    return (
                      <div
                        key={user._id + index + hour}
                        className="relative pt-2"
                        style={{ height: `${height}px` }}
                      >
                        {hour !== 0 && (
                          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 border-t border-grey-light" />
                        )}
                        <Slot
                          slotEvents={slotEvents}
                          height={height}
                          dayIndex={index}
                          handleViewAppointment={handleViewAppointment}
                          handleRescheduleAppointment={handleRescheduleAppointment}
                          handleChangeStatusAppointment={
                            handleChangeStatusAppointment
                          }
                          length={team.length - 1}
                          canEditAppointments={canEditAppointments}
                          draggedAppointmentId={draggedAppointmentId}
                          draggedAppointmentLabel={draggedAppointmentLabel}
                          canDragAppointment={canDragAppointment}
                          onAppointmentDragStart={onAppointmentDragStart}
                          onAppointmentDragEnd={onAppointmentDragEnd}
                          onAppointmentDropAt={onAppointmentDropAt}
                          onDragHoverTarget={onDragHoverTarget}
                          dropAvailabilityIntervals={
                            getDropAvailabilityIntervals?.(
                              date,
                              user.practionerId || user._id
                            ) ?? []
                          }
                          draggedAppointmentDurationMinutes={
                            draggedAppointmentDurationMinutes
                          }
                          dropDate={date}
                          dropHour={hour}
                          dropPractitionerId={user.practionerId || user._id}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  className="sticky right-0 z-20 bg-white"
                  style={{ height: height + "px" }}
                />
              </div>
            ))}

            {nowPosition && (
              <div className="pointer-events-none absolute inset-0">
                <div className="grid h-full grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <div />
                  <div className="relative">
                    <div
                      className="absolute left-0 right-2 z-100"
                      style={{
                        top: nowPosition.topPx,
                        transform: "translateY(-50%)",
                      }}
                    >
                      <div className="absolute -left-[12px] w-3 h-3 rounded-full bg-red-500 translate-y-[-50%]" />
                      <div className="border-t-2 border-t-red-500 translate-y-[-50%]" />
                    </div>
                  </div>
                  <div />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCalendar;
