import { AppointmentsProps } from "./appointments";

export type LaidOutEvent = AppointmentsProps & {
  topPx: number;
  heightPx: number;
  columnIndex: number;
  columnsCount: number;
};