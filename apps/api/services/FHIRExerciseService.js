// utils/fhir/formatExerciseToFHIR.js

class formatExerciseToFHIRBundle {
    static convertExerciseToFHIR(exercises, options = {}) {
      const {
        page = 1,
        limit = 10,
        total = exercises.length,
        type = "",
        keyword
      } = options;
  
      const entries = exercises.map((exercise) => ({
        fullUrl: `urn:uuid:${exercise._id}`,
        resource: {
          resourceType: "ActivityDefinition",
          id: exercise._id.toString(),
          status: "active",
          name: exercise.exerciseTitle || "",
          title: exercise.exerciseSubTitle || "",
          description: exercise.exerciseDescription || "",
          kind: "Task",
          code: {
            coding: [
              {
                system: "http://example.org/fhir/exercise-type",
                code: exercise.exerciseType || "",
                display: exercise.exerciseType || ""
              }
            ]
          },
          relatedArtifact: [
            {
              type: "documentation",
              label: "Video",
              url: exercise.exerciseVideo || ""
            },
            {
              type: "documentation",
              label: "Thumbnail",
              url: exercise.exerciseThumbnail || ""
            }
          ],
          extension: [
            {
              url: "http://example.org/fhir/StructureDefinition/planType",
              valueString: exercise.planType || ""
            },
            {
              url: "http://example.org/fhir/StructureDefinition/planName",
              valueString: exercise.planName || ""
            },
            {
              url: "http://example.org/fhir/StructureDefinition/planId",
              valueString: exercise.planId || ""
            }
          ]
        }
      }));
  
      const bundle = {
        resourceType: "Bundle",
        type: "searchset",
        total: total,
        entry: entries,
        link: this.generatePaginationLinks(page, limit, total, type, keyword)
      };
  
      return bundle;
    }

    static generatePaginationLinks(page, limit, total, type = "", keyword = "") {
        const current = parseInt(page);
        const last = Math.ceil(total / limit);
        const baseUrl = "/fhir/getExercise";
      
        const queryParams = [`limit=${limit}`];
        if (type) queryParams.push(`type=${encodeURIComponent(type)}`);
        if (keyword) queryParams.push(`keyword=${encodeURIComponent(keyword)}`);
        const queryStr = queryParams.join("&");
      
        const links = [
          { relation: "self", url: `${baseUrl}?page=${current}&${queryStr}` }
        ];
      
        if (current > 1) {
          links.push({
            relation: "previous",
            url: `${baseUrl}?page=${current - 1}&${queryStr}`
          });
        }
      
        if (current < last) {
          links.push({
            relation: "next",
            url: `${baseUrl}?page=${current + 1}&${queryStr}`
          });
        }
      
        return links;
    }

    static convertPlanTypesToFHIR(exercisePlans) {
        const entries = exercisePlans.map((planDoc) => {
            const plan = planDoc.toObject();
            console.log("plan",plan);
          return {
            fullUrl: `urn:uuid:${plan._id}`,
            resource: {
              resourceType: "ActivityDefinition",
              id: plan._id.toString(),
              status: "active",
              name: plan.planType || "",  
              description: plan.planName || "",
              kind: "Task",
              extension: [
                {
                  url: "http://example.org/fhir/StructureDefinition/planType",
                  valueString: plan.planType || "Unknown Plan Type"
                },
                {
                  url: "http://example.org/fhir/StructureDefinition/planName",
                  valueString: plan.planName || "Unknown Plan Name"
                }
              ]
            }
          };
        });
    
        return {
          resourceType: "Bundle",
          type: "searchset",
          total: entries.length,
          entry: entries
        };
      }

    static convertExerciseTypeToFHIR(exerciseTypes) {
        const entries = exerciseTypes.map((typeDoc) => {
            const type = typeDoc.toObject(); // Convert Mongoose document to plain object
    
            return {
                fullUrl: `urn:uuid:${type._id}`,
                resource: {
                    resourceType: "ActivityDefinition",
                    id: type._id.toString(),
                    status: "active",
                    name: type.exerciseType || "",
                    description: type.exerciseType || "",
                    kind: "Task",
                    extension: [
                        {
                            url: "http://example.org/fhir/StructureDefinition/exerciseType",
                            valueString: type.exerciseType || ""
                        }
                    ]
                }
            };
        });
    
        return {
            resourceType: "Bundle",
            type: "searchset",
            total: entries.length,
            entry: entries
        };
    }
  
    
  }
  
  module.exports = formatExerciseToFHIRBundle;
  