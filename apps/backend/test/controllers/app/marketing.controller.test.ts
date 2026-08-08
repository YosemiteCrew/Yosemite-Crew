const getDiscordMembers = jest.fn();

jest.mock("../../../src/services/marketing-discord.service", () => ({
  DiscordMembersService: { getDiscordMembers },
}));

import { MarketingController } from "../../../src/controllers/app/marketing.controller";

const response = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.set = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("MarketingController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the Discord member count with cache headers", async () => {
    getDiscordMembers.mockResolvedValueOnce("3,210");
    const res = response();

    await MarketingController.getDiscordMembers({} as any, res);

    expect(getDiscordMembers).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.set).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=300",
    );
    expect(res.json).toHaveBeenCalledWith({ discordMembers: "3,210" });
  });
});
