const {  WebUser } = require('../models/WebUser');
const   AddDoctors  = require('../models/addDoctor');

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
                { $unwind: { path: "$profileData", preserveNullAndEmptyArrays: true } }, // Convert array to object
                { $skip: offset },
                { $limit: limit }
            ]);

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
                    { $unwind: { path: "$profileData", preserveNullAndEmptyArrays: true } }, // Convert array to object
                    { $skip: offset },
                    { $limit: limit }
                ]);

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
    const BussinessId = req.body.bussinessId;
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
