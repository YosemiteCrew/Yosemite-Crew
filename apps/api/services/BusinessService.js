const {  WebUser }  = require('../models/WebUser');

const {
  fetchDepartmentsAndRating,
  enrichClinics,
  enrichPetSitters,
  enrichGroomers
} = require('../utils/enrichmentHelpers');

const formatKey = (str) =>
  str.replace(/\s+/g, '').replace(/^./, (c) => c.toLowerCase());


class BusinessService {
    
    static async getBusinessList(BusinessType, offset = 0, limit = 10) {
      const allowedTypes = ['Hospital', 'Clinic', 'Breeding Facility', 'Pet Sitter', 'Groomer Shop', 'all'];
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

      static async getBusinessSearchList(keyword, offset = 0, limit = 10) {
        const regex = new RegExp(keyword, 'i');
      
        // Aggregate users based on the search keyword
        const [users, totalCount] = await Promise.all([
          WebUser.aggregate([
            {
              $lookup: {
                from: 'profiledatas',
                localField: 'cognitoId',
                foreignField: 'userId',
                as: 'profileData',
              },
            },
            { $unwind: { path: '$profileData', preserveNullAndEmptyArrays: true } },
            { 
              $match: { 
                $or: [
                  { 'profileData.businessName': regex },
                  { 'profileData.ownerName': regex },
                  { 'profileData.email': regex },
                  { email: regex },
                  { name: regex },
                  { businessType: regex }
                ] 
              } 
            },
            { $skip: offset },
            { $limit: limit },
          ]),
          WebUser.aggregate([
            { 
              $lookup: {
                from: 'profiledatas',
                localField: 'cognitoId',
                foreignField: 'userId',
                as: 'profileData',
              },
            },
            { $unwind: { path: '$profileData', preserveNullAndEmptyArrays: true } },
            { 
              $match: { 
                $or: [
                  { 'profileData.businessName': regex },
                  { 'profileData.ownerName': regex },
                  { 'profileData.email': regex },
                  { email: regex },
                  { name: regex },
                  { businessType: regex }
                ] 
              }
            },
            { $count: 'total' },
          ]),
        ]);
      
        const count = totalCount.length > 0 ? totalCount[0].total : 0;
      
        // Group users by business type
        const groupedUsers = users.reduce((acc, user) => {
          const key = user.businessType;
          if (!acc[key]) acc[key] = [];
          acc[key].push(user);
          return acc;
        }, {});
      
        // Enrich data based on business type
        const [
          enrichedHospitals,
          enrichedClinics,
          enrichedSitters,
          enrichedGroomers
        ] = await Promise.all([
          fetchDepartmentsAndRating(groupedUsers['Hospital'] || []),
          enrichClinics(groupedUsers['Clinic'] || []),
          enrichPetSitters(groupedUsers['Pet Sitter'] || []),
          enrichGroomers(groupedUsers['Groomer Shop'] || [])
        ]);
      
        // Merge enriched data with original users
        const enrichedUsers = users.map(user => {
          switch (user.businessType) {
            case 'Hospital':
              return enrichedHospitals.find(h => h.cognitoId === user.cognitoId) || user;
            case 'Clinic':
              return enrichedClinics.find(c => c.cognitoId === user.cognitoId) || user;
            case 'Pet Sitter':
              return enrichedSitters.find(s => s.cognitoId === user.cognitoId) || user;
            case 'Groomer Shop':
              return enrichedGroomers.find(g => g.cognitoId === user.cognitoId) || user;
            default:
              return user;
          }
        });
      
        return { data: enrichedUsers, count };
      }   
      
}

module.exports = BusinessService;