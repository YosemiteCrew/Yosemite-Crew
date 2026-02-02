import { Appointment } from "@yosemite-crew/types";

export type LaidOutEvent = Appointment & {
  topPx: number;
  heightPx: number;
  columnIndex: number;
  columnsCount: number;
};