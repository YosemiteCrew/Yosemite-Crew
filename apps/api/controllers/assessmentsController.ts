

import { Request, Response } from 'express';
import AssessmentService from '../services/assessmentService';
import YoshAssessments from '../models/assessments';
import type { assessment } from "@yosemite-crew/types";

const assessmentService = new AssessmentService();

const  assessmentsController = {

    getAssessments : async(req: Request, res: Response) : Promise<void> => { 
        try {


          const { type, days, assessment_type} = req.query;
         

          const offsetParam = req.query.offset;
          const limitParam = req.query.limit;
          const assessment_status = req.query.status as string;
          const organization = req.query.organization as string;

          const parsedOffset = typeof offsetParam === 'string' ? parseInt(offsetParam, 10) : NaN;
          const parsedLimit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : NaN;

          const daysParam = typeof days === 'string' ? parseInt(days, 10) : NaN;
          const filterDays: number = !isNaN(daysParam) ? daysParam : 7;

          let hospitalId = '';
            if (typeof organization === 'string') {
              const orgParts = organization.split('/');
              hospitalId = orgParts[1] || '';
            } 
          if (!hospitalId) {
                  res.status(400).json({ message: "Hospital id is required" });
          }

          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(endDate.getDate() - (filterDays - 1));

          switch (type) { 

            case 'list': {   // code for get assessment data

           // const parsedOffset = parseInt(offset, 10);
            //const parsedLimit = parseInt(limit, 10);
  
            // Validate the pagination values
            if (isNaN(parsedOffset) || isNaN(parsedLimit)) {
                 res.status(400).json({
                  resourceType: "assessments",
                  issue: [
                    {
                      severity: "error",
                      code: "invalid",
                      diagnostics: "Invalid offset or limit"
                    },
                  ],
                });
              }
               

              const matchStage = {
                createdAt: { $gte: startDate, $lte: endDate },
                assessmentStatus: assessment_status,
                $or: [
                  { hospitalId: hospitalId },
                  { doctorId: hospitalId },

                ],
               ...(assessment_type !== 'All' && assessment_status !== 'New' && {
                  assessmentType: assessment_type,
                }),
              };

               // get data from db
               const data = await YoshAssessments.aggregate([
                {
                  $match:matchStage
                }, 
                {
                  $addFields: {
                    objectPetIdObj: { $toObjectId: "$petId"}
                  }
                },
                
                {
                  $lookup: {
                    from: "yoshpets",
                    localField: "objectPetIdObj",
                    foreignField: "_id",
                    as: "petInfo",
                  }
                },
                {
                  $lookup: {
                    from: "adddoctors",
                    localField: "doctorId",
                    foreignField: "userId",
                    as: "doctorInfo",
                  }
                },
                {
                  $addFields: {
                    doctor: { $arrayElemAt: ["$doctorInfo", 0] }, // Flatten doctorInfo
                    pet: { $arrayElemAt: ["$petInfo", 0] }         // Flatten petInfo
                  }
                },
                {
                  $addFields: {
                    petCognitoUserId: "$pet.cognitoUserId"
                  }
                },
                {
                  $lookup: {
                    from: "yoshusers",
                    localField: "petCognitoUserId",
                    foreignField: "cognitoId",
                    as: "ownerInfo"
                  }
                },
                {
                  $unwind: "$ownerInfo"
                },
                {
                  $addFields: {
                    specialization: { 
                      $toObjectId: "$doctor.professionalBackground.specialization" 
                    }
                  }
                },
                {
                  $lookup: {
                    from: "departments",
                    localField: "specialization",
                    foreignField: "_id",
                    as: "departmentInfo"
                  }
                },
                {
                  $unwind: {
                    path: "$departmentInfo",
                    preserveNullAndEmptyArrays: true
                  }
                },
                {
                  $project: {
                    // Assessment fields

                    _id: 1,
                    assessmentId: 1,
                    petId: 1,
                    doctorId: 1,
                    score: 1,
                    answers: 1,
                    assessmentType: 1,
                    type: 1,
                    assessmentStatus: 1,
                    questions: 1,
              
                    // Doctor fields
                    "doctor.personalInfo.firstName": 1,
                    "doctor.personalInfo.lastName": 1,
                    "doctor.personalInfo.phone": 1,
              
                    // Pet fields
                    "pet.petName": 1,
                    "pet.petBreed": 1,
                    "pet.petType": 1,
                    "pet.petImage": 1,
                    petOwnerFirstname: "$ownerInfo.firstName",
                    petOwnerLastName: "$ownerInfo.lastName",
                  
                  
              
                    // Department fields
                    departName: "$departmentInfo.departmentName"
                  }
                },
                {
                  $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
                      { $skip: parsedOffset },
                      { $limit: parsedLimit }
                    ]
                  }
                }
              ]);
              
              
              if(data){
               
                // convert data to fhir 
                //console.log(data)
                const result = await assessmentService.convertToFhir(data);
                 res.status(200).json(result);
               }
               else{
                res.status(400).json({
                  resourceType: "assessments",
                  issue: [
                    {
                      severity: "error",
                      code: "invalid",
                      diagnostics: "Record not found."
                    },
                  ],
                });
               }
             }
          
            break;

              case 'updateStatus': { // code for cancelled assessments
              
              // get data from db

                 const { status, id } = req.body as { status: string; id: string };
              
     
                const updateData = { "$set": { 'assessmentStatus': status } }
       
              const updated = await YoshAssessments.findByIdAndUpdate(id, updateData, { new: true }) as assessment | null;
              
              if(updated){
                res.status(200).json({
                  resourceType: "assessments",
                  id: id,
                  "text": {
                    "status": "updated",
                  },
                });
               }
               else{
                res.status(400).json({
                  resourceType: "assessments",
                  issue: [
                    {
                      severity: "error",
                      code: "invalid",
                      diagnostics: "Record not found."
                    },
                  ],
                });
               }
              }
              break;
             case 'cancelled':  
            default:
              console.log('Unknown type');
          }
        
      } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          res.status(400).json({
            resourceType: "assessments",
            issue: [
              {
                severity: "error",
                code: "invalid",
                diagnostics: message,
              },
            ],
          });
        }
        
    }
};

export default assessmentsController;