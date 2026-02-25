import { Appointment } from "@yosemite-crew/types";

export type LaidOutEvent = Appointment & {
  topPx: number;
  heightPx: number;
  columnIndex: number;
  columnsCount: number;
};

export type AppointmentViewIntent = {
  label: "info" | "prescription" | "care" | "tasks" | "finance";
  subLabel?: string;
};
