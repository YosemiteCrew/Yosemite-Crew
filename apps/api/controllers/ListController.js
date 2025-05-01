const {  WebUser } = require('../models/WebUser');

const Department = require('../models/AddDepartment');
const feedbacks = require("../models/FeedBack");
const { webAppointments } = require("../models/WebAppointment");
const DoctorService = require("../services/DoctorService");
const AddDoctors = require("../models/addDoctor");

class ListController {

    async handlegetDoctorsList(req, res) {
        const { businessId, departmentId } = req.query;
    
        try {
          const doctors = await DoctorService.getDoctorsByBusinessAndDepartment(businessId, departmentId);
          return res.status(200).json({status: 1, data: doctors});
        } catch (error) {
          console.error(error);
          res.status(200).json({  status: 0, error: error.message || "Failed to fetch doctors." });
        }
      }
  
     async handleGetDoctorsTeam(req, res) {
        try {
          const { businessId } = req.params;
    
          const fhirDoctors = await DoctorService.getDoctorsWithAppointments(businessId);
    
          if (!fhirDoctors.length) {
            return res.status(200).json({ status: 0, message: "No doctor found" });
          }
    
          res.status(200).json({
            status: 1,
            data: fhirDoctors
          });
        } catch (error) {
          console.error("Doctor fetch error:", error);
          res.status(200).json({ status: 0, error: "Error fetching doctors and appointments." });
        }
      }

    async  handleGetLists(req, res) {
    try {
        const { BusinessType, offset = 0, limit = 10 } = req.query;
        const parsedOffset = parseInt(offset);
        const parsedLimit = parseInt(limit);
        const allowedTypes = ['Hospital', 'Clinic', 'Breeding Facility','Pet Sitter','Groomer Shop'];
        if (BusinessType && !allowedTypes.includes(BusinessType)) {
            return res.status(200).json({ status: 0, error: 'Invalid BusinessType' });
        }
        const sanitizedBusinessType = allowedTypes.find(type => type === BusinessType);
        const formatKey = (str) => str.replace(/\s+/g, '').replace(/^./, (c) => c.toLowerCase());

        const fetchDepartmentsAndRating = async (hospitals) => {
            return Promise.all(hospitals.map(async (hospital) => {
                const [departments, feedbacksList] = await Promise.all([
                    Department.find({ bussinessId: hospital.cognitoId }),
                    feedbacks.find({ toId: hospital.cognitoId })
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
                            "professionalBackground.specialization": dept._id.toString()
                        })
                    }))
                );

                return hospital;
            }));
        };

        if (sanitizedBusinessType) {
            const formattedKey = formatKey(sanitizedBusinessType);
            const [totalCount, getLists] = await Promise.all([
                WebUser.countDocuments({ businessType: sanitizedBusinessType }),
                WebUser.aggregate([
                    { $match: { businessType: sanitizedBusinessType } },
                    { $lookup: { from: 'profiledatas', localField: 'cognitoId', foreignField: 'userId', as: "profileData" } },
                    { $unwind: { path: "$profileData", preserveNullAndEmptyArrays: true } },
                    { $skip: parsedOffset },
                    { $limit: parsedLimit }
                ])
            ]);

            if (sanitizedBusinessType === 'Hospital') await fetchDepartmentsAndRating(getLists);

            return res.status(200).json({ status: 1, [formattedKey]: getLists, count: totalCount });
        }

        const allTypes = await WebUser.distinct('businessType');
        const allData = {};

        await Promise.all(allTypes.filter(type => type !== 'Doctor').map(async (type) => {
            const formattedKey = formatKey(type);
            const [totalCount, list] = await Promise.all([
                WebUser.countDocuments({ businessType: type }),
                WebUser.aggregate([
                    { $match: { businessType: type } },
                    { $lookup: { from: 'profiledatas', localField: 'cognitoId', foreignField: 'userId', as: "profileData" } },
                    { $unwind: { path: "$profileData", preserveNullAndEmptyArrays: true } },
                    { $skip: parsedOffset },
                    { $limit: parsedLimit }
                ])
            ]);

            if (type === 'Hospital') await fetchDepartmentsAndRating(list);

            allData[formattedKey] = { data: list, count: totalCount };
        }));

        res.status(200).json({ status: 1, data: allData });
    } catch (error) {
        console.error(error);
        res.status(200).json({ status: 0,error: 'Internal server error' });
    }
}  

}  
 module.exports = new ListController();







