// chatTypes.test.ts
import {
  ChatSession,
  ChatTokenResponse,
  CreateChatSessionResponse,
  ChatSessionListResponse,
  CloseChatSessionResponse,
} from "../../types/chat";

describe("Chat Types Definition", () => {
  // --- Section 1: String Union Types ---
  describe("Union Types Validation", () => {
    it("accepts valid ChatSession.channelType literal value", () => {
      const channelType: ChatSession["channelType"] = "messaging";
      expect(channelType).toBe("messaging");
    });

    it("accepts valid ChatSession.status literal values", () => {
      const active: ChatSession["status"] = "active";
      const ended: ChatSession["status"] = "ended";
      expect(active).toBe("active");
      expect(ended).toBe("ended");
    });
  });

  // --- Section 2: Object Types Structure ---
  describe("ChatSession Structure", () => {
    it("creates a valid ChatSession object with optional fields", () => {
      const now = new Date();
      const session: ChatSession = {
        id: "cs_1",
        appointmentId: "appt_1",
        channelId: "channel_1",
        channelType: "messaging",
        members: ["user_1", "vet_1"],
        status: "active",
        petOwnerName: "Alex",
        petName: "Mochi",
        lastMessage: "On my way",
        lastMessageAt: Date.now(),
        createdAt: now,
        updatedAt: now,
      };

      expect(session.id).toBe("cs_1");
      expect(session.channelType).toBe("messaging");
      expect(session.members).toContain("user_1");
      expect(session.status).toBe("active");
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it("creates a valid ChatSession object with only required fields", () => {
      const session: ChatSession = {
        id: "cs_min",
        appointmentId: "appt_min",
        channelId: "channel_min",
        channelType: "messaging",
        members: ["user_1"],
        status: "ended",
      };

      expect(session.id).toBe("cs_min");
      expect(session.status).toBe("ended");
      expect(session.members).toEqual(["user_1"]);
    });
  });

  // --- Section 3: Response Types Structure ---
  describe("Response Types Structure", () => {
    it("creates a valid ChatTokenResponse", () => {
      const res: ChatTokenResponse = {
        token: "stream-token",
        expiresAt: 1700000000,
      };

      expect(res.token).toBe("stream-token");
      expect(typeof res.expiresAt).toBe("number");
    });

    it("creates a valid CreateChatSessionResponse", () => {
      const res: CreateChatSessionResponse = {
        channelId: "channel_1",
        channelType: "messaging",
        members: ["user_1", "vet_1"],
      };

      expect(res.channelId).toBe("channel_1");
      expect(res.channelType).toBe("messaging");
      expect(res.members).toHaveLength(2);
    });

    it("creates a valid ChatSessionListResponse", () => {
      const list: ChatSessionListResponse = {
        channels: [
          {
            id: "cs_1",
            appointmentId: "appt_1",
            channelId: "channel_1",
            channelType: "messaging",
            members: ["user_1", "vet_1"],
            status: "active",
          },
          {
            id: "cs_2",
            appointmentId: "appt_2",
            channelId: "channel_2",
            channelType: "messaging",
            members: ["user_2", "vet_2"],
            status: "ended",
          },
        ],
      };

      expect(list.channels).toHaveLength(2);
      expect(list.channels[0].status).toBe("active");
      expect(list.channels[1].channelType).toBe("messaging");
    });

    it("creates a valid CloseChatSessionResponse", () => {
      const res: CloseChatSessionResponse = { success: true };
      expect(res.success).toBe(true);
    });
  });
});
