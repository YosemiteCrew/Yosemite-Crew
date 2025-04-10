const FeedbackService = require('../services/FeedbackService');
const { getCognitoUserId } = require('../utils/jwtUtils');
const FHIRFormatter = require("../utils/fhirFormatter");
const mongoose = require('mongoose');

class FeedbackController {
  static async handlesaveFeedBack(req, res) {
    try {
      const fromId =  getCognitoUserId(req);
      const { toId, meetingId, feedback, rating } = req.body;

      const savedFHIR = await FeedbackService.saveFeedback({
        fromId,
        toId,
        meetingId,
        feedback,
        rating,
      });

      if (savedFHIR) {
        return res.status(200).json({
          status: 1,
          message: "Feedback saved successfully (FHIR Compliant)",
          data: savedFHIR,
        });
      }

      res.status(400).json({ status: 0, message: "Feedback not saved" });

    } catch (error) {
      console.error("Error in handleSaveFeedback:", error);
      res.status(500).json({
        status: 0,
        message: "Internal server error while saving feedback",
      });
    }
  }

  static async handleGetFeedback(req, res) {
    try {
      const { doctorId, meetingId } = req.query;

      if (!doctorId || !meetingId) {
        return res.status(400).json(FHIRFormatter.errorOutcome());
      }
      
      if (typeof doctorId !== 'string' || typeof meetingId !== 'string') {
        return res.status(400).json(FHIRFormatter.errorOutcome());
      }
      if (typeof doctorId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
         return res.status(400).json(FHIRFormatter.errorOutcome());
         }

      if (!mongoose.Types.ObjectId.isValid(meetingId)) {
        return res.status(400).json(FHIRFormatter.errorOutcome());
      }

      const doctorFeedback = await FeedbackService.getDoctorFeedback(doctorId, meetingId);
      if (doctorFeedback.length) {
        const fhirResponse = FHIRFormatter.toCommunicationBundle(doctorFeedback);
        return res.status(200).json(fhirResponse);
      } else {
        return res.status(200).json(FHIRFormatter.feedbackNotFoundOutcome());
      }

    } catch (error) {
      console.error("Error retrieving feedback:", error);
      return res.status(500).json(FHIRFormatter.errorOutcome());
    }
  }

  static async handleEditFeedBack(req, res) {
    try {
      const { feedbackId, feedback, rating } = req.body;
  
      // Check if feedback exists
      const feedbackExists = await feedbacks.findOne({ _id: { $eq: feedbackId } }).lean();
      if (!feedbackExists) {
        return res.status(404).json({ status: 0, message: "Feedback data not found" });
      }
  
      // Update feedback
      const updatedFeedback = await feedbacks.findOneAndUpdate(
        { _id: { $eq: feedbackId } },
        { $set: { feedback, rating } },
        { new: true }
      );
  
      if (updatedFeedback) {
        return res.status(200).json({
          status: 1,
          message: "Feedback updated successfully",
          Feedback: updatedFeedback,
        });
      } else {
        return res.status(500).json({ status: 0, message: "Error while updating feedback" });
      }
    } catch (error) {
      console.error("Error while updating feedback:", error);
      return res.status(500).json({
        status: 0,
        message: "An error occurred while updating feedback",
      });
    }
  }
  

  static async handleDeleteFeedBack(req, res) {
    try {
      const id = req.params.feedbackId;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ status: 0, message: "Invalid feedback ID" });
      }
      // Safely convert string to ObjectId without deprecation warning
      const objectId = mongoose.Types.ObjectId(id); 
  
      const result = await feedbacks.deleteOne({ _id: { $eq: objectId } });
  
      if (result.deletedCount === 0) {
        return res.status(200).json({ status: 0, message: "Feedback data not found" });
      }
  
      return res.status(200).json({ status: 1, message: "Feedback deleted successfully" });
    } catch (error) {
      console.error("Error while deleting feedback:", error);
      return res.status(500).json({ status: 0, message: "Error while deleting feedback" });
    }
  }


}

module.exports = FeedbackController;
