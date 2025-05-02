const {  WebUser }  = require('../models/WebUser');
const Department = require('../models/AddDepartment');
const AddDoctors = require('../models/addDoctor');
const feedbacks = require('../models/FeedBack');

const formatKey = (str) =>
  str.replace(/\s+/g, '').replace(/^./, (c) => c.toLowerCase());

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

class BusinessService {
    
    static async getBusinessList(BusinessType, offset = 0, limit = 10) {

        const allData = {};
      
        const fetchUsers = async (type) => {
          const [users, totalCount] = await Promise.all([
            WebUser.aggregate([
              { $match: { businessType: type } },
              {
                $lookup: {
                  from: 'profiledatas',
                  localField: 'cognitoId',
                  foreignField: 'userId',
                  as: 'profileData',
                },
              },
              {
                $unwind: {
                  path: '$profileData',
                  preserveNullAndEmptyArrays: true,
                },
              },
              { $skip: offset },
              { $limit: limit },
            ]),
            WebUser.countDocuments({ businessType: { $eq:  type } }),
          ]);
      
          if (type === 'Hospital') {
            await fetchDepartmentsAndRating(users);
          }
      
          return { data: users, count: totalCount };
        };
      
        if (BusinessType === 'all') {
          for (const type of allowedTypes.filter((t) => t !== 'all')) {
            const key = formatKey(type);
            allData[key] = await fetchUsers(type);
          }
        } else {
          const key = formatKey(BusinessType);
          allData[key] = await fetchUsers(BusinessType);
        }
      
        return allData;
      }
}

module.exports = BusinessService;