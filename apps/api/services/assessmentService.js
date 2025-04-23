


class AssessmentService {

     constructor(){
     }
        

     async convertToFhir(data){
      const dataArray = Array.isArray(data) ? data : [data];
      return {
        resourceType: "Bundle",
        type: "collection",
        entry: dataArray.map((doc) => ({
          resource: {
            resourceType: "Observation",
            id: doc._id.toString(),
            status: "final",
            category: [
              {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/observation-category",
                    code: "survey",
                    display: "Survey"
                  }
                ]
              }
            ],
            code: {
              text: doc.typeOfAssessment || "Pain Assessment"
            },
            subject: {
              reference: `Patient/${doc.petId}`
            },
            performer: [
              {
                reference: `Practitioner/${doc.userId}`
              }
            ],
            effectiveDateTime: new Date(doc.createdAt).toISOString(),
            component: doc.answers?.map((ans) => ({
              code: {
                text: ans.ques
              },
              valueString: ans.ans
            })) || []
          }
        }))
      };
    }   

}

module.exports = AssessmentService;