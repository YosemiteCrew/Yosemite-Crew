const {  WebUser } = require('../models/WebUser');
const   AddDoctors  = require('../models/addDoctor');
const Department = require('../models/AddDepartment');
const feedbacks = require("../models/FeedBack");


async function handleGetLists(req, res) {
    try {
        const { BusinessType, offset = 0, limit = 10 } = req.body;
        const parsedOffset = parseInt(offset);
        const parsedLimit = parseInt(limit);

        const formatKey = (str) => str.replace(/\s+/g, '').replace(/^./, (c) => c.toLowerCase());

        const fetchDepartmentsAndRating = async (hospitals) => {
            return Promise.all(hospitals.map(async (hospital) => {
                const [departments, feedbacksList] = await Promise.all([
                    Department.find({ businessId: hospital.cognitoId }),
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

        if (BusinessType) {
            const formattedKey = formatKey(BusinessType);
            const [totalCount, getLists] = await Promise.all([
                WebUser.countDocuments({ businessType: BusinessType }),
                WebUser.aggregate([
                    { $match: { businessType: BusinessType } },
                    { $lookup: { from: 'profiledatas', localField: 'cognitoId', foreignField: 'userId', as: "profileData" } },
                    { $unwind: { path: "$profileData", preserveNullAndEmptyArrays: true } },
                    { $skip: parsedOffset },
                    { $limit: parsedLimit }
                ])
            ]);

            if (BusinessType === 'Hospital') await fetchDepartmentsAndRating(getLists);

            return res.status(200).json({ [formattedKey]: getLists, count: totalCount });
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

        res.status(200).json(allData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}



async function handlegetDoctorsLists(req, res) {
    const BussinessId = req.body.businessId;
    const departmentId = req.body.departmentId;
    try {
        const doctors = await AddDoctors.find({
            bussinessId: BussinessId,
            "professionalBackground.specialization": departmentId
           
        });
        res.status(200).json(doctors);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching doctors list.' });
    }
}

module.exports = {
    handleGetLists,
    handlegetDoctorsLists,
}