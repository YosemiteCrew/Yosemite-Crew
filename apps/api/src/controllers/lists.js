const {  WebUser } = require('../models/WebUser');
const   AddDoctors  = require('../models/addDoctor');
const Department = require('../models/AddDepartment');
const feedbacks = require("../models/FeedBack");
const { webAppointments } = require("../models/WebAppointment");


async function handleGetLists(req, res) {
    try {
        const { BusinessType, offset = 0, limit = 10 } = req.body;
        const parsedOffset = parseInt(offset);
        const parsedLimit = parseInt(limit);

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
    const { businessId, departmentId } = req.body;

    try {
        const doctors = await AddDoctors.aggregate([
            {
                $match: {
                    bussinessId: businessId,
                    "professionalBackground.specialization": departmentId
                }
            },
            {
                $lookup: {
                    from: "feedbacks",
                    localField: "userId",
                    foreignField: "toId",
                    as: "ratings"
                }
            },
            {
                $set: {
                    rating: {
                        $round: [{ $avg: "$ratings.rating" }, 1] // Directly calculate and round the average rating
                    },
                }
            },
            {
                $project: { ratings: 0 } // Remove unnecessary data
            }
        ]);

        res.status(200).json(doctors);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while fetching doctors list." });
    }
}

async function handlegetDoctorsTeam(req, res) {
    try {
        const { businessId } = req.body;
        const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
        const currentTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); // "HH:MM"

        const doctorsWithAppointments = await AddDoctors.aggregate([
            { $match: { bussinessId: businessId } }, // Match doctors by businessId
            {
                $lookup: {
                    from: "webappointments", // Collection name
                    let: { doctorId: "$userId", todayDate: today, nowTime: currentTime },
                    pipeline: [
                        { 
                            $match: { 
                                $expr: {
                                    $or: [
                                        { 
                                            $and: [
                                                { $eq: ["$appointmentDate", "$$todayDate"] }, // If today, check time
                                                { $gt: ["$appointmentTime24", "$$nowTime"] }
                                            ]
                                        },
                                        { $gt: ["$appointmentDate", "$$todayDate"] } // Future dates
                                    ]
                                }
                            } 
                        },
                        { 
                            $project: { 
                                _id: 1, appointmentDate: 1, appointmentTime24: 1, 
                                ownerName: 1, petName: 1, purposeOfVisit: 1 
                            } 
                        }
                    ],
                    as: "futureAppointments"
                }
            },
            { 
                $project: { 
                    _id: 1, // Keep _id
                    "personalInfo.firstName": 1, 
                    "personalInfo.lastName": 1, 
                    "personalInfo.image": 1,
                    futureAppointments: 1
                } 
            }
        ]);

        if (!doctorsWithAppointments.length) return res.status(200).json({ status: 0, message: "No doctor found" });

        res.status(200).json({ status: 1, doctors: doctorsWithAppointments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching doctors and appointments." });
    }
}



module.exports = {
    handleGetLists,
    handlegetDoctorsLists,
    handlegetDoctorsTeam,
}