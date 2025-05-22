const FeedbackService = require('../services/FeedbackService');
const { getCognitoUserId } = require('../utils/jwtUtils');
const FHIRFormatter = require("../utils/fhirFormatter");
const mongoose = require('mongoose');

class FeedbackController {
  static async handleSaveFeedBack(req, res) {
    try {
      const userId = getCognitoUserId(req); // Logged-in user ID
      let feedbackFHIR = req.body?.data; // Full FHIR Observation posted
  
      if (typeof feedbackFHIR === 'string') {
        feedbackFHIR = JSON.parse(feedbackFHIR);
      }
  
      const savedFHIR = await FeedbackService.saveFeedback({
        userId,
        feedbackFHIR,
      });
     if (savedFHIR) {
        const fhirResponse = FHIRFormatter.toObservationBundle(savedFHIR);
        return res.status(200).json({
          status: 1,
          message: "Feedback saved successfully",
          data: fhirResponse
        });
      }
  
    } catch (error) {
      res.status(200).json({
        status: 0,
        message: error.message || "Internal server error while saving feedback",
      });
    }
  }
  
  
  static async handleGetFeedback(req, res) {
    try {
      const { doctorId, meetingId, limit, offset } = req.query;
  
      if (!doctorId) {
        return res.status(200).json(FHIRFormatter.errorOutcome());
      }
  
      if (typeof doctorId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
        return res.status(200).json(FHIRFormatter.errorOutcome());
      }
  
      let doctorFeedback = [];
  
      if (meetingId) {
        if (!mongoose.Types.ObjectId.isValid(meetingId)) {
          return res.status(200).json({ status: 0, message: "Invalid meeting ID format" });
        }
  
        doctorFeedback = await FeedbackService.getDoctorFeedback(doctorId, meetingId);
      } else {
        const parsedLimit = limit ? parseInt(limit) : 10;
        const parsedOffset = offset ? parseInt(offset) : 0;
  
        if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
          return res.status(200).json({ status: 0, message: "Invalid limit or offset" });
        }
  
        doctorFeedback = await FeedbackService.getDoctorFeedback(doctorId, null, parsedLimit, parsedOffset);
      }
  
      if (doctorFeedback.length) {
        const fhirResponse = FHIRFormatter.toObservationBundle(doctorFeedback);
        return res.status(200).json({ status: 1, data: fhirResponse });
      } else {
        return res.status(200).json(FHIRFormatter.feedbackNotFoundOutcome());
      }
  
    } catch (error) {
      return res.status(200).json(FHIRFormatter.errorOutcome());
    }
  }
  
  

  static async handleEditFeedback(req, res) {
    try {
      const feedbackFHIR = JSON.parse(req.body?.data)  // FHIR format data (feedback + rating)
      const feedbackId = req.query.feedbackId;  // Assuming feedbackId comes from query params
      if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
           return res.status(200).json({ status: 0, message: "Invalid Feedback ID" });
       }
      const feedbackExists = await FeedbackService.getFeedbackById(feedbackId);
      if (!feedbackExists) {
        return res.status(200).json({ status: 0, message: "Feedback data not found" });
      }
      const feedback = feedbackFHIR?.valueString; 
      const rating = feedbackFHIR?.component?.[0]?.valueInteger;  
      
      if (rating === undefined || rating === null) {
        return res.status(200).json({ status: 0, message: "Rating is required" });
      }

      // Prepare the data to update
       let doctorFeedback = [];
      const updatedFeedback = await FeedbackService.updateFeedback(feedbackId, { feedback, rating });
       
        doctorFeedback = await FeedbackService.getDoctorFeedback(updatedFeedback.doctorId, updatedFeedback.meetingId);
      
     if (doctorFeedback.length) {
        const fhirResponse = FHIRFormatter.toObservationBundle(doctorFeedback);
        return res.status(200).json({ status: 1, data: fhirResponse });
      } else {
        return res.status(200).json(FHIRFormatter.feedbackNotFoundOutcome());
      }
    } catch (error) {
      console.error("Error while updating feedback:", error);
      return res.status(200).json({
        status: 0,
        message: "An error occurred while updating feedback",
      });
    }
  }

  static async handleDeleteFeedback(req, res) {
    try {
      const feedbackId = req.query.feedbackId;  // Get feedback ID from URL params

      if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
        return res.status(200).json({ status: 0, message: "Invalid feedback ID" });
      }
      const feedbackToDelete = await FeedbackService.deleteFeedback(feedbackId);
      if(feedbackToDelete){
      return res.status(200).json({
        status: 1,
        message: "Feedback deleted successfully",
      });
     }
    } catch (error) {
      console.error("Error while deleting feedback:", error);
      return res.status(200).json({
        status: 0,
        message: error.message || "An error occurred while deleting feedback",
      });
    }
  }


}

module.exports = FeedbackController;
