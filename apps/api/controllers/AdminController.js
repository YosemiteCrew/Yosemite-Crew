
const ExercisePlanModel = require('../models/YoshExercisePlans');
const ExerciseTypeModel = require('../models/ExerciseTypeModel');
const ExercisesModel = require('../models/YoshExercises');
const FHIRExerciseService = require('../services/FHIRExerciseService');

class AdminController {

   //Retrieve all plan types added by the admin
    static async planTypes(req, res) {
      try {
        const exercisePlans = await ExercisePlanModel.find({});
        const fhirBundle = FHIRExerciseService.convertPlanTypesToFHIR(exercisePlans);
        return res.status(200).json(fhirBundle);
      } catch (error) {
        res.status(500).json({ status: 0, message: 'Internal Server Error' });
      }
    }

    //Retrieve all exercise types added by the admin
    static async exerciseTypes(req, res) {
      try {
        const exerciseTypes = await ExerciseTypeModel.find({});
        const fhirBundle = FHIRExerciseService.convertExerciseTypeToFHIR(exerciseTypes);
        return res.status(200).json(fhirBundle);
      } catch (error) {
        res.status(500).json({ status: 0, message: 'Internal Server Error' });
      }
    }

   //Retrieve all exercise according type
   static async getExercise(req, res) {
    try {
      const {
        type,
        keyword = "",
        page = 1,
        limit = 10,
        sort = "desc"
      } = req.query;
      const regex = new RegExp(keyword, "i");

      // Build the base query
      const query = {
        ...(type && { exerciseType: type }),
        ...(keyword && {
          $or: [
            { exerciseTitle: { $regex: regex } },
            { exerciseSubTitle: { $regex: regex } },
            { exerciseDescription: { $regex: regex } }
          ]
        })
      };

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOption = sort === 'asc' ? 1 : -1;

      const [exercises, total] = await Promise.all([
        ExercisesModel.find(query)
          .sort({ updatedAt: sortOption })
          .skip(skip)
          .limit(parseInt(limit)),
        ExercisesModel.countDocuments(query)
      ]);

      const fhirBundle = FHIRExerciseService.convertExerciseToFHIR(exercises, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        type,
        keyword
      });

      return res.status(200).json(fhirBundle);
    } catch (error) {
      console.error("Error formatting FHIR:", error);
      return res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: error.message
          }
        ]
      });
    }
  }

 

}



module.exports = AdminController;