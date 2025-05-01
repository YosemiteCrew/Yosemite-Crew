
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const feedbacks = require("../models/FeedBack");
const FHIRBuilder = require('../utils/FHIRBuilder');

class FeedbackService {
  static async saveFeedback({ userId, feedbackFHIR }) {
    const performerReference = feedbackFHIR?.performer?.[0]?.reference || null;
    const subjectReference = feedbackFHIR?.subject?.reference || null;
    const appointmentReference = feedbackFHIR?.basedOn?.[0]?.reference || null;
  
    const doctorId = performerReference ? performerReference.split("/")[1] : null;
    const petId = subjectReference ? subjectReference.split("/")[1] : null;
    const meetingId = appointmentReference ? appointmentReference.split("/")[1] : null;
  
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
  
    return savedFeedback ? savedFeedback : null;
  }
  
  static async getDoctorFeedback(doctorId, meetingId = null, limit = 10, offset = 0) {
    const filter = { doctorId };
    if (meetingId) {
      filter.meetingId = meetingId;
      return await feedbacks.find(filter).lean(); // No pagination
    } else {
      return await feedbacks.find(filter).skip(offset).limit(limit).lean(); // With pagination
    }
  }

    static async getFeedbackById(feedbackId) {
      try {
        const feedback = await feedbacks.findOne({ _id: feedbackId }).lean();
        return feedback;
      } catch (error) {
        throw new Error('Error while fetching feedback: ' + error.message);
      }
    }
  
    // Method to update feedback
    static async updateFeedback(feedbackId, feedbackData) {
      try {
        const { feedback, rating } = feedbackData;  // Destructure feedback and rating from the data
  
        const updatedFeedback = await feedbacks.findOneAndUpdate(
          { _id: feedbackId },
          { $set: { feedback, rating } },
          { new: true }
        );
  
        return updatedFeedback;
      } catch (error) {
        throw new Error('Error while updating feedback: ' + error.message);
      }
    }

    static constructFHIRResponse(updatedFeedback) {
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
    }

    static async deleteFeedback(feedbackId) {
      const feedbackToDelete = await FeedbackService.getFeedbackById(feedbackId);
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

module.exports = FeedbackService;
