export interface OccupancyMongo {
  userId: string;
  organisationId: string;
  startTime: Date;
  endTime: Date;
  sourceType: "APPOINTMENT" | "BLOCKED" | "SURGERY";
  referenceId?: string;
}

export type OccupancyDocument = OccupancyMongo;
