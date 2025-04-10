
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const feedbacks = require("../models/FeedBack");
const FHIRBuilder = require('../utils/FHIRBuilder');

class FeedbackService {
  static async saveFeedback({ fromId, toId, meetingId, feedback, rating }) {
    const fhirFeedback = FHIRBuilder.buildFeedbackFHIR({
      fromId,
      toId,
      meetingId,
      feedback,
      rating,
    });
    const savedFeedback = await feedbacks.create({
      fromId,
      toId,
      meetingId,
      feedback, // <--- this stores the raw feedback from frontend
      feedbackFHIR: fhirFeedback, // this stores the FHIR structure
    });
  
    return savedFeedback ? fhirFeedback : null;
  }
  
  static async getDoctorFeedback(doctorId, meetingId) {
    return await feedbacks.find({ toId: doctorId, meetingId }).lean();
  }

}

module.exports = FeedbackService;
