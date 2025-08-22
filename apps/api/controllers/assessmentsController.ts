

import { Request, Response } from 'express';
import AssessmentService from '../services/assessmentService';
import { convertToPainAssessmentFhir } from '@yosemite-crew/fhir';
import YoshAssessments from '../models/assessments';
import type { assessment } from "@yosemite-crew/types";
import mongoose from 'mongoose';

const assessmentService = new AssessmentService();

const assessmentsController = {
  getAssessments: async (req: Request, res: Response): Promise<void> => {
    try {


      const { type, days, assessment_type } = req.query;


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
              $match: matchStage
            },
            {
              $addFields: {
                objectPetIdObj: { $toObjectId: "$petId" }
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


          if (data) {

            // convert data to fhir 
            //console.log(data)
            const result = await assessmentService.convertToFhir(data);
            res.status(200).json(result);
          }
          else {
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

          const updated = await YoshAssessments.findByIdAndUpdate(new mongoose.Types.ObjectId(id), updateData, { new: true }) as assessment | null;

          if (updated) {
            res.status(200).json({
              resourceType: "assessments",
              id: id,
              "text": {
                "status": "updated",
              },
            });
          }
          else {
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

  },
  getPainAssessment: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const docs = await YoshAssessments.aggregate([
        {
          $match: { _id: new mongoose.Types.ObjectId(id) }
        },
        {
          $lookup: {
            from: "adminassessments",
            localField: "assessmentId",
            foreignField: "_id",
            as: "adminAssessment"
          }
        },
        { $unwind: "$adminAssessment" },
        {
          $project: {
            _id: 0,
            name: "$adminAssessment.name",
            description: "$adminAssessment.description",
            questions: "$adminAssessment.questions",
          }
        }
      ]);

      if (!docs.length) {
        res.status(404).json({
          resourceType: "PainAssessment",
          issue: [
            { severity: "error", code: "not-found", diagnostics: "Assessment not found" }
          ]
        });
        return;
      }

      const result = await convertToPainAssessmentFhir(docs[0]);
      res.status(200).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({
        resourceType: "PainAssessments",
        issue: [
          {
            severity: "error",
            code: "invalid",
            diagnostics: message,
          },
        ],
      });
    }
  },
  savePainAssessment: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, answers } = req.body;
      if (!id || !answers || !Array.isArray(answers)) {
         res.status(400).json({
          resourceType: "PainAssessment",
          issue: [{ severity: "error", code: "invalid", diagnostics: "Invalid input" }]
        });
        return
      }
  
      const docs = await YoshAssessments.findById(new mongoose.Types.ObjectId(id));
      if (!docs) {
         res.status(404).json({
          resourceType: "PainAssessment",
          issue: [{ severity: "error", code: "not-found", diagnostics: "Assessment not found" }]
        });
        return
      }
  
      const db = mongoose.connection.db;
      if (!db) {
         res.status(500).json({
          resourceType: "PainAssessment",
          issue: [{ severity: "error", code: "server-error", diagnostics: "Database not connected" }]
        });
        return
      }
      const adminDoc = await db.collection("adminassessments").aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(docs?.assessmentId) } },
        {
          $project: {
            questions: 1,
            painScores: 1
          }
        }
      ]).toArray();
      if (!adminDoc || adminDoc.length === 0) {
         res.status(404).json({
          resourceType: "PainAssessment",
          issue: [{ severity: "error", code: "not-found", diagnostics: "Admin assessment not found" }]
        });
        return
      }
  
      const { questions, painScores } = adminDoc[0];

      const answeredQuestions = answers.map((answer) => {
        const question = questions.find((q: any) => q._id.toString() === answer.questionId);
        if (question) {
          const option = question.imageOptions.find((opt: any) => opt._id.toString() === answer.optionId);
          return option ? { questionId: answer.questionId, questionText: question.question,answerLabel:option.label, answerDescription: option.description, score: option.score } : null;
        }
        return null;
      }).filter((ans: any) => ans !== null);
  
      const totalScore = answeredQuestions.reduce((sum: number, ans: any) => sum + ans.score, 0);
  
      const matchedRange = painScores.find((range: any) => range.selectedNumbers.includes(totalScore));
  
      if (!matchedRange) {
         res.status(400).json({
          resourceType: "PainAssessment",
          issue: [{ severity: "error", code: "invalid", diagnostics: `Score ${totalScore} does not match any range` }]
        });
        return
      }
  
      const fhirResponse = {
        resourceType: "PainAssessment",
        score: {
          totalScore,
          interpretation: matchedRange.title,
          description: matchedRange.description,
          colorCode: matchedRange.colorCode
        }
      };
  
      await YoshAssessments.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { score: totalScore, questions: answeredQuestions } }
      );
  
      res.status(200).json(fhirResponse);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({
        resourceType: "PainAssessment",
        issue: [{ severity: "error", code: "invalid", diagnostics: message }]
      });
    }
  }

};


export default assessmentsController;