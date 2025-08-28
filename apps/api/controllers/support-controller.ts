import { fromFhirSupportTicket } from "@yosemite-crew/fhir";
import { Request, Response } from "express";
import SupportTicket from "../models/SupportTicket";

const requestSupport = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    if (!body && typeof body !== "object") {
      res.status(400).json({ message: "Invalid FHIR data format." });
      return;
    }
    const data = fromFhirSupportTicket(body);
    const supportCreated = await SupportTicket.create(data);
    res.status(200).json({
      message: "Request Accepted.",
      ticketId: supportCreated.ticketId,
    });
    return;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          code: "exception",
          details: {
            text: message,
          },
        },
      ],
    });
    return;
  }
};

const SupportController = {
  requestSupport,
};

export default SupportController;
