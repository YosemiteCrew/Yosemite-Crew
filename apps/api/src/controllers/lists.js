const {  WebUser } = require('../models/WebUser');
const   AddDoctors  = require('../models/addDoctor');
const Department = require('../models/AddDepartment');
const feedbacks = require("../models/FeedBack");

async function handleGetLists(req, res) {
    try {
        const TypeOfBusiness = req.body.BusinessType;
        const offset = parseInt(req.body.offset) || 0;
        const limit = parseInt(req.body.limit) || 10;

        if (TypeOfBusiness) {
            const totalCount = await WebUser.countDocuments({ businessType: TypeOfBusiness });

            const getLists = await WebUser.aggregate([
                { $match: { businessType: TypeOfBusiness } },
                {
                    $lookup: {
                        from: 'profiledatas',
                        localField: 'cognitoId',
                        foreignField: 'userId',
                        as: "profileData",
                    },
                },
                { $unwind: { path: "$profileData", preserveNullAndEmptyArrays: true } },
                { $skip: offset },
                { $limit: limit }
            ]);

            // If business type is 'Hospital', fetch departments and doctor counts
            if (TypeOfBusiness === 'Hospital') {
                for (let hospital of getLists) {
                    const departments = await Department.find({ businessId: hospital.cognitoId });
                    const feedbacksList =  await feedbacks.find({ toId: hospital.cognitoId });
                        let hospitalRating = 0;
                        if (feedbacksList.length > 0) {
                            const ratingCount = feedbacksList.length;
                            const totalRating = feedbacksList.reduce((sum, feedback) => sum + feedback.rating, 0); // Assuming 'rating' is a field in feedback
                            hospitalRating = totalRating / ratingCount;
                        }


                    const departmentData = await Promise.all(
                        departments.map(async (dept) => {
                            const doctorCount = await AddDoctors.countDocuments({
                                bussinessId: hospital.cognitoId,
                                "professionalBackground.specialization": dept._id.toString()
                            });

                            return {
                                departmentId: dept._id,
                                departmentName: dept.departmentName, 
                                doctorCount: doctorCount
                            };
                        })
                    );

                    hospital.departments = departmentData;
                    hospital.rating = hospitalRating;
                }
            }

            res.status(200).json({
                [TypeOfBusiness]: getLists,
                count: totalCount
            });

        } else {
            const allTypes = await WebUser.distinct('businessType');
            const allData = {};

            for (let type of allTypes) {
                if (type === 'Doctor') continue;

                const totalCount = await WebUser.countDocuments({ businessType: type });

                const list = await WebUser.aggregate([
                    { $match: { businessType: type } },
                    {
                        $lookup: {
                            from: 'profiledatas',
                            localField: 'cognitoId',
                            foreignField: 'userId',
                            as: "profileData",
                        },
                    },
                    { $unwind: { path: "$profileData", preserveNullAndEmptyArrays: true } },
                    { $skip: offset },
                    { $limit: limit }
                ]);

                // If business type is 'Hospital', fetch departments and doctor counts
                if (type === 'Hospital') {
                    
                    for (let hospital of list) {
                        
                        const departments = await Department.find({ bussinessId: hospital.cognitoId });
                        const feedbacksList =  await feedbacks.find({ toId: hospital.cognitoId });
                        let hospitalRating = 0;
                        if (feedbacksList.length > 0) {
                            const ratingCount = feedbacksList.length;
                            const totalRating = feedbacksList.reduce((sum, feedback) => sum + feedback.rating, 0); // Assuming 'rating' is a field in feedback
                            hospitalRating = totalRating / ratingCount;
                        }

                        const departmentData = await Promise.all(
                            departments.map(async (dept) => {
                                const doctorCount = await AddDoctors.countDocuments({
                                    bussinessId: hospital.cognitoId,
                                    "professionalBackground.specialization": dept._id.toString()
                                });
                            

                                return {
                                    departmentId: dept._id,
                                    departmentName: dept.departmentName, 
                                    doctorCount: doctorCount
                                };
                            })
                        );


                        hospital.departments = departmentData;
                        hospital.rating = hospitalRating;
                    }
                }

                allData[type] = {
                    data: list,
                    count: totalCount
                };
            }

            res.status(200).json(allData);
        }
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