// validators/FHIRValidator.js
class FHIRValidator {
    static validateFHIRBundle(bundle) {
      const issues = [];
  
      // Check if the bundle is correctly structured
      if (!bundle || bundle.resourceType !== "Bundle" || bundle.type !== "collection") {
        issues.push({
          severity: "error",
          code: "invalid",
          details: { text: "Invalid FHIR Bundle structure" },
        });
      }
  
      // Validate each entry in the bundle
      if (Array.isArray(bundle.entry)) {
        bundle.entry.forEach((entry, index) => {
          if (!entry.resource) {
            issues.push({
              severity: "error",
              code: "invalid",
              details: { text: `Missing resource in entry ${index + 1}` },
            });
          }
  
          // Validate Schedule
          if (entry.resource.resourceType === "Schedule") {
            if (!entry.resource.id) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing Schedule id in entry ${index + 1}` },
              });
            }
            if (!entry.resource.identifier || entry.resource.identifier.length === 0) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing Schedule identifier in entry ${index + 1}` },
              });
            }
            if (!entry.resource.actor || entry.resource.actor.length === 0) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing actor in Schedule entry ${index + 1}` },
              });
            }
          }
  
          // Validate Observation
          if (entry.resource.resourceType === "Observation") {
            if (!entry.resource.code || !entry.resource.code.coding || entry.resource.code.coding.length === 0) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing Observation code in entry ${index + 1}` },
              });
            }
            if (!entry.resource.subject) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing subject in Observation entry ${index + 1}` },
              });
            }
            if (!entry.resource.component || entry.resource.component.length === 0) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing component in Observation entry ${index + 1}` },
              });
            }
          }
        });
      } else {
        issues.push({
          severity: "error",
          code: "invalid",
          details: { text: "Missing or invalid 'entry' array in the FHIR Bundle" },
        });
      }
  
      return issues;
    }
  }
  
  module.exports = FHIRValidator;
  