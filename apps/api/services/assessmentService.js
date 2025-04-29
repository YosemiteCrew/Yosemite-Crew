


class AssessmentService {

     constructor(){
     }
        

     async convertToFhir(data){
      
      const total = data[0]?.metadata[0]?.total || 0;
      const dataArray = data[0]?.data || [];

      //const dataArray = Array.isArray(data) ? data : [data];


      let result = [];
      dataArray.flatMap((a) => {

              console.log(a);
              const petId = `Patient/${a.petId}-pet`;
              const docId = `Practitioner/${a.doctorId}-doc`;
              const assessment = {
                resource: {
                  resourceType: "assessment",
                  id : a._id,
                  status: a.assessmentStatus,
                  "extension": [
                    {
                      "url": "http://example.org/fhir/StructureDefinition/assessment-type",
                      "valueString": a.assessmentType
                    },
                    {
                      "url": "http://example.org/fhir/StructureDefinition/assessment-id",
                      "valueString":  a.assessmentId
                    }
                  ],
                  "patient" :  {
                      "reference": `patient/${a.petId}`,
                      name: [
                        {
                          text: a.pet.petName
                        }
                      ],
                      "contact": [
                        {
                          "name": {
                            "family": a.petOwnerLastName,
                            "given": [a.petOwnerFirstname]
                          },
                        }
                      ],
                      gender: "unknown", // optional: add if known
                      extension: [
                        {
                          url: "http://example.org/fhir/StructureDefinition/pet-type",
                          valueString: a.pet.petType
                        },
                        {
                          url: "http://example.org/fhir/StructureDefinition/pet-breed",
                          valueString: a.pet.petBreed
                        }
                      ],
                      photo: a.pet.petImage?.length
                        ? [
                            {
                              contentType: "image/jpeg",
                              url: a.pet.petImage[0].url
                            }
                          ]
                        : []
                    },
                  "practitioner" : {
                    "reference": `Practitioner/${a.doctorId}`,
                      name: [
                        {
                          family: a.doctor.personalInfo.lastName,
                          given: [a.doctor.personalInfo.firstName]
                        }
                      ],
                      telecom: [
                        {
                          system: "phone",
                          value: a.doctor.personalInfo.phone
                        }
                      ],
                      "organization": {
                      "reference": `Organization/cardiology/ ${a.departName}`,
                      "display": a.departName
                    },
                    },
                    // "questionnaireResponse" :  {
                    //     questionnaire: "Questionnaire/yosh-assess",
                    //     subject: { reference: petId },
                    //     author: { reference: docId },
                    //     authored: new Date().toISOString(),
                    //     item: a.questions.map((q, idx) => ({
                    //       linkId: String(idx + 1),
                    //       text: q.question,
                    //       answer: [
                    //         {
                    //           valueString: q.answer
                    //         }
                    //       ]
                    //     }))
                    //   },
                      // "observation" :   {
                      //     status: "final",
                      //     code: {
                      //       coding: [
                      //         {
                      //           system: "http://loinc.org",
                      //           code: "72133-3",
                      //           display: "Behavioral health assessment total score"
                      //         }
                      //       ],
                      //       text: "Assessment Score"
                      //     },
                      //     subject: { reference: petId },
                      //     performer: [{ reference: docId }],
                      //     valueInteger: a.score
                      //   }
              }
            }

        result.push(assessment);
      });



      return {
        resourceType: "Bundle",
        type: "collection",
        entry : result,
        total : total
      };
 
  }
}



module.exports = AssessmentService;