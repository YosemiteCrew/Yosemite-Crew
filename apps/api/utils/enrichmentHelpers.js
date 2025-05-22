const Department = require('../models/AddDepartment');
const AddDoctors = require('../models/AddDoctor');
const feedbacks = require('../models/FeedBack');

async function enrichClinics(clinics) {
    return Promise.all(
      clinics.map(async (clinic) => {
        const feedbacksList = await feedbacks.find({ toId: clinic.cognitoId });
        clinic.rating = feedbacksList.length
          ? feedbacksList.reduce((sum, fb) => sum + fb.rating, 0) / feedbacksList.length
          : 0;
        return clinic;
      })
    );
  }
  
  async function enrichPetSitters(sitters) {
    return sitters;
  }
  
  async function enrichGroomers(groomers) {
    return groomers;
  }

  async function fetchDepartmentsAndRating(hospitals) {
    return Promise.all(hospitals.map(async (hospital) => {
      const [departments, feedbacksList] = await Promise.all([
        Department.find({ bussinessId: hospital.cognitoId }),
        feedbacks.find({ toId: hospital.cognitoId }),
      ]);
  
      hospital.rating = feedbacksList.length
        ? feedbacksList.reduce((sum, fb) => sum + fb.rating, 0) / feedbacksList.length
        : 0;
  
      hospital.departments = await Promise.all(
        departments.map(async (dept) => ({
          departmentId: dept._id,
          departmentName: dept.departmentName,
          doctorCount: await AddDoctors.countDocuments({
            bussinessId: hospital.cognitoId,
            "professionalBackground.specialization": dept._id.toString(),
          }),
        }))
      );
  
      return hospital;
    }));
  }
  
  
  module.exports = {
    fetchDepartmentsAndRating,
    enrichClinics,
    enrichPetSitters,
    enrichGroomers,
  };
  