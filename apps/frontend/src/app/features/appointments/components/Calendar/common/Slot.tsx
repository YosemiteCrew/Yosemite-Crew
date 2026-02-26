import React, { useEffect, useMemo, useRef, useState } from "react";
import { getStatusStyle } from "@/app/config/statusConfig";
import Image from "next/image";
import { Appointment } from "@yosemite-crew/types";
import { getSafeImageUrl, ImageType } from "@/app/lib/urls";
import { allowReschedule } from "@/app/lib/appointments";
import { AppointmentViewIntent } from "@/app/features/appointments/types/calendar";
import {
  IoEyeOutline,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoCardOutline,
} from "react-icons/io5";
import { MdOutlineAutorenew } from "react-icons/md";
import { createPortal } from "react-dom";

type SlotProps = {
  slotEvents: Appointment[];
  height: number;
  handleViewAppointment: (
    appt: Appointment,
    intent?: AppointmentViewIntent,
  ) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  handleChangeStatusAppointment?: (appt: Appointment) => void;
  dayIndex: number;
  length: number;
  canEditAppointments: boolean;
};

const Slot: React.FC<SlotProps> = ({
  slotEvents,
  height,
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  dayIndex,
  length,
  canEditAppointments,
}) => {
  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const popoverDialogRef = useRef<HTMLDialogElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!activePopoverKey) return;
    const closePopover = () => setActivePopoverKey(null);
    window.addEventListener("scroll", closePopover, true);
    window.addEventListener("resize", closePopover);
    return () => {
      window.removeEventListener("scroll", closePopover, true);
      window.removeEventListener("resize", closePopover);
    };
  }, [activePopoverKey]);

  useEffect(() => {
    const dialogEl = popoverDialogRef.current;
    if (!dialogEl || !activePopoverKey) return;

    const onMouseEnter = () => clearCloseTimer();
    const onMouseLeave = () => schedulePopoverClose();
    const onFocusIn = () => clearCloseTimer();
    const onFocusOut = (event: FocusEvent) => {
      const nextFocused = event.relatedTarget as Node | null;
      if (!nextFocused || !dialogEl.contains(nextFocused)) {
        schedulePopoverClose();
      }
    };
    const onTouchStart = () => clearCloseTimer();
    const onTouchEnd = () => schedulePopoverClose();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePopoverKey(null);
      }
    };

    dialogEl.addEventListener("mouseenter", onMouseEnter);
    dialogEl.addEventListener("mouseleave", onMouseLeave);
    dialogEl.addEventListener("focusin", onFocusIn);
    dialogEl.addEventListener("focusout", onFocusOut);
    dialogEl.addEventListener("touchstart", onTouchStart, { passive: true });
    dialogEl.addEventListener("touchend", onTouchEnd, { passive: true });
    dialogEl.addEventListener("keydown", onKeyDown);

    return () => {
      dialogEl.removeEventListener("mouseenter", onMouseEnter);
      dialogEl.removeEventListener("mouseleave", onMouseLeave);
      dialogEl.removeEventListener("focusin", onFocusIn);
      dialogEl.removeEventListener("focusout", onFocusOut);
      dialogEl.removeEventListener("touchstart", onTouchStart);
      dialogEl.removeEventListener("touchend", onTouchEnd);
      dialogEl.removeEventListener("keydown", onKeyDown);
    };
  }, [activePopoverKey]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const activeEvent = useMemo(
    () =>
      slotEvents.find(
        (ev, i) =>
          `${ev.companion.name}-${ev.startTime.toISOString()}-${i}` ===
          activePopoverKey,
      ) ?? null,
    [slotEvents, activePopoverKey],
  );

  const formatTimeRange = (event: Appointment) => {
    const start = event.startTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const end = event.endTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${start} - ${end}`;
  };

  const getPopoverStyle = () => {
    if (!activeRect) return { top: 0, left: 0 };
    const popoverWidth = 360;
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const fitsRight = activeRect.right + margin + popoverWidth <= viewportWidth;
    const left = fitsRight
      ? activeRect.right + margin
      : Math.max(margin, activeRect.left - popoverWidth - margin);
    return {
      top: Math.max(margin, activeRect.top),
      left,
      width: popoverWidth,
    };
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const schedulePopoverClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setActivePopoverKey(null);
    }, 120);
  };

  const openPopover = (key: string, target: HTMLButtonElement) => {
    clearCloseTimer();
    setActiveRect(target.getBoundingClientRect());
    setActivePopoverKey(key);
  };

  if (slotEvents.length === 0) {
    return (
      <div
        className={`relative border-l border-grey-light text-caption-1 text-text-primary flex items-center justify-center ${dayIndex === length && "border-r"}`}
        style={{ height: `${height}px` }}
      ></div>
    );
  }
  return (
    <>
      <div
        className={`relative overflow-auto scrollbar-hidden border-l border-grey-light ${dayIndex === length && "border-r"}`}
        style={{ height: `${height}px` }}
      >
        <div className="flex flex-col gap-1 rounded-2xl p-2 bg-white">
          {slotEvents.map((ev, i) => {
            const itemKey = `${ev.companion.name}-${ev.startTime.toISOString()}-${i}`;
            return (
              <div
                key={itemKey}
                className="rounded px-1 py-1 flex items-center justify-between"
                style={getStatusStyle(ev.status)}
              >
                <button
                  type="button"
                  className="flex-1 min-w-0 flex items-center justify-between cursor-pointer"
                  onClick={() => handleViewAppointment(ev)}
                  onMouseEnter={(event) =>
                    openPopover(itemKey, event.currentTarget)
                  }
                  onMouseLeave={schedulePopoverClose}
                >
                  <div className="text-body-4 truncate">
                    {ev.companion.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Image
                      src={getSafeImageUrl(
                        "",
                        ev.companion.species.toLowerCase() as ImageType,
                      )}
                      height={30}
                      width={30}
                      className="rounded-full flex-none"
                      alt={""}
                    />
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {isMounted &&
        activeEvent &&
        activeRect &&
        createPortal(
          <dialog
            ref={popoverDialogRef}
            open
            className="fixed z-120 rounded-2xl border border-card-border bg-white px-3 pt-2 pb-3"
            style={getPopoverStyle()}
            aria-label="Appointment quick actions"
          >
            <div className="flex items-center justify-end gap-1">
              {canEditAppointments && (
                <button
                  type="button"
                  title="Change status"
                  className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg"
                  onClick={() => {
                    if (handleChangeStatusAppointment) {
                      handleChangeStatusAppointment(activeEvent);
                    } else {
                      handleViewAppointment(activeEvent);
                    }
                    setActivePopoverKey(null);
                  }}
                >
                  <MdOutlineAutorenew size={18} />
                </button>
              )}
              <button
                type="button"
                title="View"
                className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg"
                onClick={() => {
                  handleViewAppointment(activeEvent);
                  setActivePopoverKey(null);
                }}
              >
                <IoEyeOutline size={18} />
              </button>
              {canEditAppointments && allowReschedule(activeEvent.status) && (
                <button
                  type="button"
                  title="Reschedule"
                  className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg"
                  onClick={() => {
                    handleRescheduleAppointment(activeEvent);
                    setActivePopoverKey(null);
                  }}
                >
                  <IoCalendarOutline size={18} />
                </button>
              )}
              <button
                type="button"
                title="SOAP"
                className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg"
                onClick={() => {
                  handleViewAppointment(activeEvent, {
                    label: "prescription",
                    subLabel: "subjective",
                  });
                  setActivePopoverKey(null);
                }}
              >
                <IoDocumentTextOutline size={18} />
              </button>
              <button
                type="button"
                title="Finance"
                className="h-8 w-8 rounded-full! flex items-center justify-center text-[#3c4043] hover:bg-[#e3e7ea]"
                onClick={() => {
                  handleViewAppointment(activeEvent, {
                    label: "finance",
                    subLabel: "summary",
                  });
                  setActivePopoverKey(null);
                }}
              >
                <IoCardOutline size={18} />
              </button>
            </div>

            <div className="mt-1 flex items-start gap-3">
              <div
                className="h-3 w-3 rounded-full mt-2 flex-none"
                style={{
                  backgroundColor:
                    getStatusStyle(activeEvent.status).backgroundColor ||
                    "#1a73e8",
                }}
              />
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <div className="text-body-3 truncate">
                  {activeEvent.companion.name || "-"}
                </div>
                <div className="text-caption-1 text-black-text">
                  <span className="font-medium">Parent:</span>{" "}
                  {activeEvent.companion.parent?.name || "-"}
                </div>
                <div className="text-caption-1 text-black-text">
                  <span className="font-medium">Lead:</span>{" "}
                  {activeEvent.lead?.name || "-"}
                </div>
                <div className="text-caption-1 text-black-text">
                  <span className="font-medium">Reason:</span>{" "}
                  {activeEvent.concern || "-"}
                </div>
                <div className="text-caption-1 text-black-text">
                  <span className="font-medium">Service:</span>{" "}
                  {activeEvent.appointmentType?.name || "-"}
                </div>
                <div className="text-caption-1 text-black-text">
                  <span className="font-medium">Time:</span>{" "}
                  {formatTimeRange(activeEvent)}
                </div>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
};

export default Slot;
