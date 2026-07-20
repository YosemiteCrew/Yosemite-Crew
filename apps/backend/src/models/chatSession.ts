export interface ChatParticipant {
  userId: string; // practitionerId, parentId, support staff id
  role: "parent" | "vet" | "support";
}

export type ChatSessionStatus = "PENDING" | "ACTIVE" | "CLOSED";
export type ChatSessionType = "APPOINTMENT" | "ORG_DIRECT" | "ORG_GROUP";

export interface ChatSessionMongo {
  type: ChatSessionType;

  appointmentId?: string;
  channelId: string;

  organisationId: string;
  counterpartOrganisationId?: string;
  patientId?: string;
  parentId?: string;
  vetId?: string | null;
  supportStaffIds?: string[];

  createdBy?: string;
  title?: string;
  isPrivate?: boolean;

  /**
   * Flat list of all userIds in this chat.
   * This is what we send to Stream as `members`.
   */
  members: string[];

  /**
   * Optional richer structure if you want roles per participant.
   * Not required for Stream, but useful on PMS/mobile side.
   */
  participants: ChatParticipant[];

  status: ChatSessionStatus;

  // Configured window during which chat is allowed
  allowedFrom?: Date;
  allowedUntil?: Date;

  closedAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChatSessionDocument extends ChatSessionMongo {
  _id: string;
}
