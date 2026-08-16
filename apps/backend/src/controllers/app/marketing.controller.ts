import type { Request, Response } from "express";
import { DiscordMembersService } from "src/services/marketing-discord.service";

export const MarketingController = {
  async getDiscordMembers(
    this: void,
    _req: Request,
    res: Response,
  ): Promise<Response> {
    const discordMembers = await DiscordMembersService.getDiscordMembers();

    return res
      .status(200)
      .set("Cache-Control", "public, max-age=300, stale-while-revalidate=300")
      .json({
        discordMembers,
      });
  },
};
