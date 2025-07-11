import { Request, Response } from 'express';
import feedbacks from "../models/feedback";
import { convertToFhir, convertFhirToNormal } from "@yosemite-crew/fhir";
import type { feedback, feedbackData } from "@yosemite-crew/types";
import { getCognitoUserId } from '../middlewares/authMiddleware';
import mongoose, { PipelineStage } from 'mongoose';

const feedbackController = {

  addFeedBack: async (req: Request<unknown, unknown, {data:unknown}>, res: Response): Promise<void> => {
    try {
      const userId = getCognitoUserId(req as Request);
      let feedbackFHIR  = req.body?.data

      if (typeof feedbackFHIR === 'string') {
        feedbackFHIR = JSON.parse(feedbackFHIR);
      }

      const normalData: Partial<feedback> = convertFhirToNormal(feedbackFHIR);

      const meetingId = normalData?.meetingId;
   if (typeof meetingId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(meetingId)) {
         res.status(400).json({ status: 0, message: "Invalid Meeting ID format" });
        return;
      }
      // if (!meetingId || (typeof meetingId !== "string" && !(meetingId instanceof mongoose.Types.ObjectId)) || !mongoose.Types.ObjectId.isValid(meetingId)) {
      //   res.status(200).json({
      //     resourceType: "OperationOutcome",
      //     issue: [{
      //       status: 0,
      //       severity: "information",
      //       code: "invalid",
      //       message: "Invalid meeting ID",
      //     }]
      //   });
      //   return
      // }

      const existingFeedback = await feedbacks.findOne({ meetingId: meetingId }).lean();
      if (existingFeedback) {
        res.status(409).json({
          resourceType: "OperationOutcome",
          data: [],
          issue: [{
            status: 0,
            severity: "information",
            code: "already exist",
            message: "Feedback for this meeting already exists"
          }]
        });
        return
      }

      // Optional: add userId if you want to track who submitted it
      normalData.userId = userId;
      const savedFeedback = await feedbacks.create({ ...normalData });

      if (savedFeedback) {
        const fhirResponse = convertFhirToNormal(savedFeedback)
        res.status(200).json({
          status: 1,
          message: 'Feedback saved successfully',
          data: fhirResponse,
        });
        return
      }
      if (!savedFeedback) {
        res.status(500).json({
          resourceType: "OperationOutcome",
          data: [],
          issue: [{
            status: 0,
            severity: "information",
            code: "not-found",
            diagnostics: "Failed to save feedback"
          }]
        });
        return
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        resourceType: "OperationOutcome",
        data: [],
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          diagnostics: message
        }]
      });
      return
    }
  },

  getFeedback: async (req: Request, res: Response): Promise<void> => {
    try {

      const { limit, offset } = req.query;
      // Safely parse limit and offset from query string
      const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : 10;
      const parsedOffset = typeof offset === 'string' ? parseInt(offset, 10) : 0;

      if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
        res.status(400).json({ status: 0, message: "Invalid limit or offset" });
        return
      }

      const pipeline :PipelineStage[]= [
        {
          $lookup: {
            from: 'adddoctors',
            localField: 'doctorId',
            foreignField: 'userId',
            as: 'doctorDetails',
          },
        },
        { $unwind: '$doctorDetails' },
        {
          $addFields: {
            specializationId: {
              $toObjectId: '$doctorDetails.professionalBackground.specialization',
            },
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'specializationId',
            foreignField: '_id',
            as: 'departmentDetails',
          },
        },
        { $unwind: { path: '$departmentDetails', preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        {
          $project: {
            _id: 1,
            doctorId: 1,
            meetingId: 1,
            petId: 1,
            rating: 1,
            feedback: 1,
            createdAt: 1,
            doctorDetails: {
              personalInfo: {
                firstName: 1,
                lastName: 1,
                image: 1,
              },
              professionalBackground: {
                qualification: 1,
              },
            },
            department: '$departmentDetails.departmentName',
          },
        },
      ];


      pipeline.push({ $skip: parsedOffset }, { $limit: parsedLimit });


      const feedbackList :feedbackData[]= await feedbacks.aggregate(pipeline);


      if (feedbackList.length) {
        const fhirResponse = convertToFhir(feedbackList);
        res.status(200).json({ status: 1, data: fhirResponse });
        return
      } else {

        res.status(200).json({
          resourceType: "OperationOutcome",
          data: [],
          issue: [{
            status: 0,
            severity: "information",
            code: "not-found",
            diagnostics: "Feedback is not found"
          }]
        });
        return
      }

    } catch (error: unknown) {
      res.status(200).json({
        resourceType: "OperationOutcome",
        data: [],
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          diagnostics: error
        }]
      });
      return
    }
  },

  editFeedback: async (req: Request, res: Response): Promise<void> => {
    try {
      const feedbackId = req.query.feedbackId as string;

      if (typeof feedbackId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(feedbackId)) {
         res.status(400).json({ status: 0, message: "Invalid Feedback ID format" });
        return;
      }
      if (!feedbackId || !mongoose.Types.ObjectId.isValid(feedbackId)) {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "information",
            code: "invalid",
            message: "Invalid feedback ID",
          }]
        });
        return
      }

      type FeedbackFHIR = { valueString?: string; component?: { valueInteger?: number }[] };
      let feedbackFHIR: FeedbackFHIR | undefined;
      if (req.body && typeof req.body === 'object' && 'data' in req.body) {
        const data = (req.body as { data?: unknown }).data;
        if (typeof data === 'string') {
          try {
            feedbackFHIR = JSON.parse(data) as FeedbackFHIR;
          } catch {
            res.status(400).json({
              resourceType: "OperationOutcome",
              issue: [{
                status: 0,
                severity: "information",
                code: "invalid",
                message: "Invalid JSON in feedback data",
              }]
            });
            return;
          }
        } else if (typeof data === 'object' && data !== null) {
          feedbackFHIR = data as FeedbackFHIR;
        }
      }

      const feedbackExists = await feedbacks.findOne({ _id: new mongoose.Types.ObjectId(feedbackId) }).lean();
      if (!feedbackExists) {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "information",
            code: "not-found",
            message: "Feedback data not found",
          }]
        });
        return
      }

      const feedback = feedbackFHIR?.valueString;
      const rating = feedbackFHIR?.component?.[0]?.valueInteger as number;

      if (rating === undefined || rating === null) {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "information",
            code: "invalid",
            message: "Rating is required",
          }]
        });
        return
      }

      const updatedFeedback = await feedbacks.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(feedbackId) },
        { $set: { feedback, rating } },
        { new: true }
      );

      // You use `meetingId` here, but it's not declared. Fetch it from the document:
      const matchStage: Record<string, unknown> = {
        doctorId: updatedFeedback?.doctorId,
      };
      if (updatedFeedback?.meetingId) {
        matchStage.meetingId = updatedFeedback.meetingId;
      }
      const pipeline :PipelineStage[]= [
        { $match: matchStage },
        {
          $lookup: {
            from: 'adddoctors',
            localField: 'doctorId',
            foreignField: 'userId',
            as: 'doctorDetails',
          },
        },
        { $unwind: '$doctorDetails' },
        {
          $addFields: {
            specializationId: {
              $toObjectId: '$doctorDetails.professionalBackground.specialization',
            },
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'specializationId',
            foreignField: '_id',
            as: 'departmentDetails',
          },
        },
        { $unwind: { path: '$departmentDetails', preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        {
          $project: {
            _id: 1,
            doctorId: 1,
            meetingId: 1,
            petId: 1,
            rating: 1,
            feedback: 1,
            createdAt: 1,
            doctorDetails: {
              personalInfo: {
                firstName: 1,
                lastName: 1,
                image: 1,
              },
              professionalBackground: {
                qualification: 1,
              },
            },
            department: '$departmentDetails.departmentName',
          },
        },
      ];

      const doctorFeedback :feedbackData[]= await feedbacks.aggregate(pipeline);

      if (doctorFeedback.length) {
        const fhirResponse = convertToFhir(doctorFeedback);
        res.status(200).json({ status: 1, data: fhirResponse });
        return
      } else {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "information",
            code: "not-found",
            message: "Feedback data not found",
          }]
        });
        return
      }

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred while updating feedback";
      res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          message,
        }]
      });
      return
    }
  },

  deleteFeedback: async (req: Request, res: Response): Promise<void> => {
    try {

      const feedbackId = req.query.feedbackId;
      if (typeof feedbackId !== 'string' || !mongoose.Types.ObjectId.isValid(feedbackId)) {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "information",
            code: "invalid",
            message: "Invalid feedback ID",
          }]
        });
        return
      }

      const feedbackToDelete = await feedbacks.findOne({ _id: feedbackId }).lean();
      if (!feedbackToDelete) {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "information",
            code: "not found",
            message: "Feedback data not found",
          }]
        });
        return
      }
      const result = await feedbacks.deleteOne({ _id: feedbackId });
      if (result.deletedCount === 0) {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "information",
            code: "not-found",
            message: "Feedback data not found",
          }]
        });
        return
      }
      if (feedbackToDelete) {
        res.status(200).json(
          {
            resourceType: "OperationOutcome",
            issue: [{
              status: 1,
              severity: "information",
              code: "done",
              message: "Feedback deleted successfully",
            }]
          });
          return
      }
    } catch (error: unknown) {
      let message = "An error occurred while deleting feedback";
      if (error instanceof Error) {
        message = error.message;
      }
      res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [{
          status: 0,
          severity: "information",
          code: "error",
          message: message,
        }]
      });
      return
    }
  }

}

export default feedbackController;
