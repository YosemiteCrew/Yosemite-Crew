import { Request, Response } from "express";
import logger from "../../utils/logger";
import { generatePresignedUrl } from "src/middlewares/upload";

export const getProfileUploadUrl = async (req: Request, res: Response) => {
  try {
    const rawBody: unknown = req.body;
    const mimeType =
      typeof rawBody === "object" && rawBody !== null && "mimeType" in rawBody
        ? (rawBody as { mimeType?: unknown }).mimeType
        : undefined;

    if (typeof mimeType !== "string" || !mimeType) {
      res
        .status(400)
        .json({ message: "MIME type is required in the request body." });
      return;
    }

    const { url, key } = await generatePresignedUrl(mimeType, "temp");

    return res.status(200).json({ url, key });
  } catch (error) {
    logger.error("Failed to generate pre-signed URL", error);
    return res.status(500).json({ message: "Failed to generate upload URL." });
  }
};
