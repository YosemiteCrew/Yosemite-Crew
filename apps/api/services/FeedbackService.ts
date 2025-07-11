
import feedbacks from "../models/feedback";
import mongoose from 'mongoose';
import type { IFeedback } from "@yosemite-crew/types";


const FeedbackService = {

  saveFeedback : async({ userId, feedbackFHIR  } : { userId: string; feedbackFHIR: any }) => {
  try {

    const performerReference = feedbackFHIR?.performer?.[0]?.reference || null;
    const subjectReference = feedbackFHIR?.subject?.reference || null;
    const appointmentReference = feedbackFHIR?.basedOn?.[0]?.reference || null;

    const doctorId = performerReference ? performerReference.split("/")[1] : null;
    const petId = subjectReference ? subjectReference.split("/")[1] : null;
    const meetingIdRaw = appointmentReference ? appointmentReference.split("/")[1] : null;

    if (!mongoose.Types.ObjectId.isValid(meetingIdRaw)) {
      throw new Error("Invalid meeting ID");
    }
    const meetingId = meetingIdRaw;

    const existingFeedback = await feedbacks.findOne({ meetingId }).lean();
    if (existingFeedback) {
      throw new Error("Feedback for this meeting already exists");
    }

    const feedbackText = feedbackFHIR?.valueString || "";
    const ratingValue = feedbackFHIR?.component?.[0]?.valueQuantity?.value || null;

    const savedFeedback = await feedbacks.create({
      userId,
      doctorId,
      petId,
      meetingId,
      feedback: feedbackText,
      rating: ratingValue,
    });

    const doctorFeedback = await FeedbackService.getDoctorFeedback(doctorId, meetingId);

      return savedFeedback ? doctorFeedback : null;
  } catch (err) {
    throw err; // Let the controller handle the message/response
  }
},

  
   getDoctorFeedback : async(doctorId :string, meetingId = null, limit = 10, offset = 0): Promise<IFeedback[]>  => {
  
  const matchStage: Record<string> = { doctorId };
  if (meetingId) matchStage.meetingId = meetingId;

  const pipeline: any[] = [
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

  if (!meetingId) {
    pipeline.push({ $skip: offset }, { $limit: limit });
  }

  const results: IFeedback[] = await feedbacks.aggregate(pipeline);
  return results;
},




     getFeedbackById :async(feedbackId :string) => {
      try { 
        const feedback = await feedbacks.findOne({ _id: feedbackId }).lean();
        return feedback;
      } catch (error :any) {
        throw new Error('Error while fetching feedback: ' + error.message);
      }
    },
  
    // Method to update feedback
      updateFeedback :async(feedbackId :string, feedbackData :any) => {
      try {
        const { feedback, rating } = feedbackData;  // Destructure feedback and rating from the data
  
        const updatedFeedback = await feedbacks.findOneAndUpdate(
          { _id: feedbackId },
          { $set: { feedback, rating } },
          { new: true }
        );
  
        return updatedFeedback;
      } catch (error :any) {
        throw new Error('Error while updating feedback: ' + error.message);
      }
    },

     constructFHIRResponse : async(updatedFeedback :any) => {
      return {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "76432-6",
              display: "Patient feedback",
            },
          ],
          text: "User Feedback",
        },
        subject: {
          reference: `Patient/${updatedFeedback.petId}`,  // Assuming patientId is part of the updated feedback
        },
        effectiveDateTime: updatedFeedback.updatedAt,  // Assuming updatedAt contains the timestamp
        valueString: updatedFeedback.feedback,  // Assuming 'feedback' field in the DB holds the feedback text
        component: [
          {
            code: {
              text: "Rating",
            },
            valueInteger: updatedFeedback.rating,  // Assuming 'rating' is part of the updated feedback
          },
        ],
      };
    }, 

      deleteFeedback: async(feedbackId :string) =>  {
        const feedbackToDelete = await feedbacks.findOne({ _id: feedbackId }).lean();
        if (!feedbackToDelete) {
          throw new Error("Feedback data not found");
        }
        const result = await feedbacks.deleteOne({ _id: feedbackId });
        if (result.deletedCount === 0) {
          throw new Error("Feedback data not found");
        }
        return feedbackToDelete;  
    }

}

export default FeedbackService;
