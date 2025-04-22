
const AssessmentService = require('../services/assessmentService');
const { YoshPainJournals } = require('../models/painJournal');

const assessmentService = new AssessmentService();

const  assessmentsController = {

    getAssessments : async(req, res) => { 
      
     
        try {

             // get data from db
             let data  = await YoshPainJournals.find(); 
             console.log(data);

            // convert data to fhir 
            const result = await assessmentService.convertToFhir(data);

            res.status(201).json(result);

        } catch(error){

            res.status(400).json({
                resourceType: "assessments",
                issue: [
                  {
                    severity: "error",
                    code: "invalid",
                    diagnostics: error.message,
                  },
                ],
              });

        }
    }
};

module.exports = assessmentsController;