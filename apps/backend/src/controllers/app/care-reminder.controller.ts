import { Request, Response } from "express";
import {
  MobileCareReminderService,
  parseCareReminderCursor,
} from "src/services/mobile-care-reminder.service";
import logger from "src/utils/logger";
import { resolveParentId } from "src/controllers/app/shared/owner-controller.helpers";

export const MobileCareReminderController = {
  listDueReminders: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveParentId(req, res);
      if (!parentId) {
        return;
      }

      /*
       * Rejected up front rather than passed through. A malformed cursor is a
       * caller mistake, and answering 400 here is what keeps every failure
       * from the query itself honestly a 500 - inferring "bad cursor" from a
       * thrown error would report a database outage as the caller's fault.
       *
       * The offending value is not echoed or logged: it is caller-controlled,
       * a raw CR/LF in it forges a second log line, and the 400 already tells
       * the only party who can act on it.
       */
      const cursor = parseCareReminderCursor(req.query.cursor);
      if (cursor === null) {
        return res.status(400).json({
          message:
            "Unknown or malformed cursor. Use nextCursor from the previous response.",
        });
      }

      const page =
        await MobileCareReminderService.listDueCareRemindersForParent(
          parentId,
          { limit: req.query.limit, cursor },
        );

      /*
       * The three fields beside `reminders` are what stops this being a
       * silently truncated list: a client that ignores them sees a short page,
       * and one that reads them can tell the end of the data from the end of
       * the page.
       */
      return res.status(200).json({
        reminders: page.reminders,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        limit: page.limit,
      });
    } catch (err) {
      logger.error(
        `Error listing care reminders: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
      return res
        .status(500)
        .json({ message: "Failed to list care reminders." });
    }
  },
};
