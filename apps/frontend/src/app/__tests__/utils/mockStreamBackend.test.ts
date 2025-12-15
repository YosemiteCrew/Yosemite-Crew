import {
  mockGenerateStreamToken,
  mockGetVetChannels,
  mockEndChatChannel,
  isChatActive,
  getMockVetUser,
  getMockPetOwner,
  formatAppointmentTime,
  getTimeUntilChatActivation,
} from "@/app/utils/mockStreamBackend";

describe("mockStreamBackend Utils", () => {
  // --- 1. mockGenerateStreamToken ---
  describe("mockGenerateStreamToken", () => {
    it("returns a development token string with the user ID", async () => {
      const userId = "test-user-123";
      const token = await mockGenerateStreamToken(userId);
      expect(token).toBe(`DEVELOPMENT_TOKEN_${userId}`);
    });
  });

  // --- 2. mockGetVetChannels ---
  describe("mockGetVetChannels", () => {
    it("calls queryChannels on the client with correct filter and sort options", async () => {
      const mockChannels = [{ cid: "channel-1" }, { cid: "channel-2" }];
      const mockClient = {
        queryChannels: jest.fn().mockResolvedValue(mockChannels),
      } as any;

      const vetId = "vet-123";
      const result = await mockGetVetChannels(mockClient, vetId);

      // Verify the client method was called
      expect(mockClient.queryChannels).toHaveBeenCalledTimes(1);
      expect(mockClient.queryChannels).toHaveBeenCalledWith(
        {
          type: "messaging",
          members: { $in: [vetId] },
        },
        [{ last_message_at: -1 }],
        {
          watch: true,
          state: true,
        }
      );

      // Verify return value
      expect(result).toBe(mockChannels);
    });
  });

  // --- 3. mockEndChatChannel ---
  describe("mockEndChatChannel", () => {
    it("returns success true", async () => {
      const result = await mockEndChatChannel("channel-123");
      expect(result).toEqual({ success: true });
    });
  });

  // --- 4. isChatActive ---
  describe("isChatActive", () => {
    beforeAll(() => {
      // Mock System Time: 2023-10-10 12:00:00
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-10-10T12:00:00Z"));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("returns true if now is within the activation window (e.g., 2 mins before appt)", () => {
      // Appt is at 12:02 (2 mins from now). Activation (5 mins) starts at 11:57.
      // 12:00 is between 11:57 and 12:32.
      const apptTime = "2023-10-10T12:02:00Z";
      expect(isChatActive(apptTime)).toBe(true);
    });

    it("returns false if now is before the activation window", () => {
      // Appt is at 13:00. Activation starts 12:55.
      // 12:00 is before 12:55.
      const apptTime = "2023-10-10T13:00:00Z";
      expect(isChatActive(apptTime)).toBe(false);
    });




    it("returns false if now is after the 30 min window", () => {
      // Appt was at 11:00. Ends 11:30.
      // 12:00 is after 11:30.
      const apptTime = "2023-10-10T11:00:00Z";
      expect(isChatActive(apptTime)).toBe(false);
    });



  });

  // --- 5. User Getters ---
  describe("User Getters", () => {
    it("returns the mock vet user object", () => {
      const user = getMockVetUser();
      expect(user).toHaveProperty("id", "emp_brown");
      expect(user).toHaveProperty("role", "vet");
    });

    it("returns the mock pet owner user object", () => {
      const user = getMockPetOwner();
      expect(user).toHaveProperty("id", "pet-owner-1");
      expect(user).toHaveProperty("role", "pet-owner");
    });
  });

  // --- 6. formatAppointmentTime ---
  describe("formatAppointmentTime", () => {
    beforeAll(() => {
      // Mock System Time: 2023-10-10 08:00:00 (Local/UTC handling depends on env, assuming UTC here for simplicity in test env)
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-10-10T08:00:00Z"));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("formats 'Today' correctly", () => {
      // Same day, 2:00 PM
      const apptTime = "2023-10-10T14:00:00Z";
      // Note: toLocaleTimeString output depends on the test runner's locale/timezone.
      // We will check if it contains "Today at".
      const result = formatAppointmentTime(apptTime);
      expect(result).toMatch(/^Today at/);
    });

    it("formats a different date correctly", () => {
      const apptTime = "2023-10-15T14:00:00Z";
      const result = formatAppointmentTime(apptTime);
      // Should NOT start with Today
      expect(result).not.toMatch(/^Today at/);
      // Should contain date parts (e.g., Oct 15)
      expect(result).toMatch(/Oct 15/);
    });
  });

  // --- 7. getTimeUntilChatActivation ---
  describe("getTimeUntilChatActivation", () => {
    beforeAll(() => {
      // Mock System Time: 2023-10-10 12:00:00
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-10-10T12:00:00Z"));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("returns null if chat is already active (activation time passed)", () => {
      // Appt 12:04. Activation (5m) starts 11:59.
      // 12:00 >= 11:59. Active.
      const apptTime = "2023-10-10T12:04:00Z";
      const result = getTimeUntilChatActivation(apptTime);
      expect(result).toBeNull();
    });



  });
});