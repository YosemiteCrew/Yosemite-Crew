import { Request, Response } from 'express';
import feedbacks from "../models/feedback";
//import FeedbackService from '../services/FeedbackService';
import { convertToFhir , convertFhirToNormal} from "@yosemite-crew/fhir";
import type { feedback , feedbackData} from "@yosemite-crew/types";
import { getCognitoUserId } from '../middlewares/authMiddleware';


//import FHIRFormatter  from "../utils/fhirFormatter";
import mongoose from 'mongoose';

const feedbackController = {

  addFeedBack : async (req: Request, res: Response): Promise<void>=> {
  try {
      const userId = getCognitoUserId(req);
      let feedbackFHIR = req.body?.data;

      if (typeof feedbackFHIR === 'string') {
        feedbackFHIR = JSON.parse(feedbackFHIR);
      }

      const normalData: Partial<feedbackData> = convertFhirToNormal(feedbackFHIR);

      const meetingId = normalData?.meetingId;
   
    if (!meetingId ||(typeof meetingId !== "string" && !(meetingId instanceof mongoose.Types.ObjectId)) || !mongoose.Types.ObjectId.isValid(meetingId)){
       res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [{
          status: 0,
          severity: "information",
          code: "invalid",
          message: "Invalid meeting ID",
        }]
      });
    }

    const existingFeedback = await feedbacks.findOne({ meetingId: meetingId }).lean();
    if (existingFeedback) {
       res.status(409).json({
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
       res.status(200).json({
        status: 1,
        message: 'Feedback saved successfully',
        data: fhirResponse,
      });
    }
   if (!savedFeedback) {
     res.status(500).json({
              resourceType: "OperationOutcome",
              data:[],
              issue: [{
                status: 0,
                severity: "information",
                code: "not-found",
                diagnostics: "Failed to save feedback"
              }]
            });
     }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
     res.status(500).json({
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

   
  
    getFeedback : async(req: Request, res : Response) : Promise<void>  => {
    try {

        const { limit, offset } = req.query;
           // Safely parse limit and offset from query string
        const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : 10;
        const parsedOffset = typeof offset === 'string' ? parseInt(offset, 10) : 0;
    
        if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
           res.status(200).json({ status: 0, message: "Invalid limit or offset" });
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
            res.status(200).json({ status: 1, data: fhirResponse });
      } else {
      
         res.status(200).json({
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
       res.status(200).json({
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
  
  

  editFeedback: async (req: Request, res: Response) : Promise<void> => {
  try {
    const feedbackId = req.query.feedbackId as string;

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
    }

    const feedbackFHIR = typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body.data;

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
    }

    const feedback = feedbackFHIR?.valueString;
    const rating = feedbackFHIR?.component?.[0]?.valueInteger;

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
       res.status(200).json({ status: 1, data: fhirResponse });
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
  }
},

    deleteFeedback : async (req:Request, res : Response) : Promise<void>=> {
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
        }
      if(feedbackToDelete){
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
     }
    } catch (error : unknown) {
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
    }
  }

}

export default feedbackController;
