import { Request, Response } from 'express';
import feedbacks from "../models/feedback";
//import FeedbackService from '../services/FeedbackService';
import { convertToFhir , convertFhirToNormal} from "@yosemite-crew/fhir";
import type { feedback } from "@yosemite-crew/types";

const { getCognitoUserId } = require('../utils/jwtUtils');


//import FHIRFormatter  from "../utils/fhirFormatter";
import mongoose from 'mongoose';
import { json } from 'body-parser';

const feedbackController = {

  handleSaveFeedBack : async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getCognitoUserId(req) as string;
    let feedbackFHIR = req.body?.data;

    if (typeof feedbackFHIR === 'string') {
      feedbackFHIR = JSON.parse(feedbackFHIR);
    }

    const normalData = convertFhirToNormal(feedbackFHIR) as Partial<feedback>;;
   

    if (!mongoose.Types.ObjectId.isValid(normalData.meetingId)) {
      return res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [{
          status: 0,
          severity: "information",
          code: "invalid",
          message: "Invalid meeting ID",
        }]
      });
    }

    const existingFeedback = await feedbacks.findOne({ meetingId: normalData.meetingId }).lean();
    if (existingFeedback) {
      return res.status(409).json({
         resourceType: "OperationOutcome",
              data:[],
              issue: [{
                status: 0,
                severity: "information",
                code: "already exist",
                message: "Feedback for this meeting already exists"
              }]
            });
    }

    // Optional: add userId if you want to track who submitted it
     normalData.userId = userId;
    const savedFeedback = await feedbacks.create({ ...normalData });

    if (savedFeedback) {
      const fhirResponse = convertToFhir([savedFeedback]); //FHIRFormatter.toObservationBundle([savedFeedback]); // wrap in array
      return res.status(200).json({
        status: 1,
        message: 'Feedback saved successfully',
        data: fhirResponse,
      });
    }

    return res.status(500).json({
              resourceType: "OperationOutcome",
              data:[],
              issue: [{
                status: 0,
                severity: "information",
                code: "not-found",
                diagnostics: "Failed to save feedback"
              }]
            });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
        resourceType: "OperationOutcome",
        data:[],
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          diagnostics: message
        }]
      });
  }
},

   
  
    handleGetFeedback : async(req: Request, res : Response) => {
    try {

        const { limit, offset } = req.query;
         const parsedLimit  = limit ? parseInt(limit) : 10;
         const parsedOffset = offset ? parseInt(offset) : 0;
    
        if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
          return res.status(200).json({ status: 0, message: "Invalid limit or offset" });
        }

            const pipeline: any[] = [
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
    

        const feedbackList = await feedbacks.aggregate(pipeline);
      
   
      if (feedbackList.length) {
           const fhirResponse  = convertToFhir(feedbackList);
           return res.status(200).json({ status: 1, data: fhirResponse });
      } else {
      
        return res.status(200).json({
              resourceType: "OperationOutcome",
              data:[],
              issue: [{
                status: 0,
                severity: "information",
                code: "not-found",
                diagnostics: "Feedback is not found"
              }]
            });
      }
  
    } catch (error : unknown) {
      return res.status(200).json({
        resourceType: "OperationOutcome",
        data:[],
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          diagnostics: error
        }]
      });
    }
  },
  
  

   handleEditFeedback: async (req: Request, res: Response) => {
  try {
    const feedbackId = req.query.feedbackId as string;

    if (!feedbackId || !mongoose.Types.ObjectId.isValid(feedbackId)) {
      return res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [{
          status: 0,
          severity: "information",
          code: "invalid",
          message: "Invalid feedback ID",
        }]
      });
    }

    const feedbackFHIR = typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body.data;

    const feedbackExists = await feedbacks.findOne({ _id: new mongoose.Types.ObjectId(feedbackId) }).lean();
    if (!feedbackExists) {
      return res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [{
          status: 0,
          severity: "information",
          code: "not-found",
          message: "Feedback data not found",
        }]
      });
    }

    const feedback = feedbackFHIR?.valueString;
    const rating = feedbackFHIR?.component?.[0]?.valueInteger;

    if (rating === undefined || rating === null) {
      return res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [{
          status: 0,
          severity: "information",
          code: "invalid",
          message: "Rating is required",
        }]
      });
    }

    const updatedFeedback = await feedbacks.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(feedbackId) },
      { $set: { feedback, rating } },
      { new: true }
    );

    // You use `meetingId` here, but it's not declared. Fetch it from the document:
    const matchStage: Record<string, any> = {
      doctorId: updatedFeedback?.doctorId,
    };
    if (updatedFeedback?.meetingId) {
      matchStage.meetingId = updatedFeedback.meetingId;
    }
    const pipeline = [
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

    const doctorFeedback = await feedbacks.aggregate(pipeline);

    if (doctorFeedback.length) {
      const fhirResponse = convertToFhir(doctorFeedback);
      return res.status(200).json({ status: 1, data: fhirResponse });
    } else {
      return res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [{
          status: 0,
          severity: "information",
          code: "not-found",
          message: "Feedback data not found",
        }]
      });
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An error occurred while updating feedback";
    return res.status(200).json({
      resourceType: "OperationOutcome",
      issue: [{
        status: 0,
        severity: "error",
        code: "exception",
        message,
      }]
    });
  }
},

    handleDeleteFeedback : async (req:Request, res : Response) => {
    try {

      const feedbackId = req.query.feedbackId;
      if (typeof feedbackId !== 'string' || !mongoose.Types.ObjectId.isValid(feedbackId)) {
        return res.status(200).json({
              resourceType: "OperationOutcome",
              issue: [{
                status: 0,
                severity: "information",
                code: "invalid",
                message: "Invalid feedback ID",
              }]
            });
      }

       const feedbackToDelete = await feedbacks.findOne({ _id: feedbackId }).lean();
        if (!feedbackToDelete) {
          return res.status(200).json({
              resourceType: "OperationOutcome",
              issue: [{
                status: 0,
                severity: "information",
                code: "not found",
                message: "Feedback data not found",
              }]
            });
        }
        const result = await feedbacks.deleteOne({ _id: feedbackId });
        if (result.deletedCount === 0) {
          return res.status(200).json({
              resourceType: "OperationOutcome",
              issue: [{
                status: 0,
                severity: "information",
                code: "not-found",
                message: "Feedback data not found",
              }]
            });
        }
      if(feedbackToDelete){
      return res.status(200).json(
          {
              resourceType: "OperationOutcome",
              issue: [{
                status: 1,
                severity: "information",
                code: "done",
                message: "Feedback deleted successfully",
              }]
            });
     }
    } catch (error : unknown) {
        let message = "An error occurred while deleting feedback";
          if (error instanceof Error) {
            message = error.message;
          }
        return res.status(200).json({
              resourceType: "OperationOutcome",
              issue: [{
                status: 0,
                severity: "information",
                code: "error",
                message: message,
              }]
            });
    }
  }

}

export default feedbackController;
