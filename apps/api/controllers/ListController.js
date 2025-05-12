
const BusinessService = require('../services/BusinessService');
const FhirFormatter = require('../utils/BusinessFhirFormatter');
const DoctorService = require("../services/DoctorService");
const validator = require('validator');
const mongoose = require('mongoose');

class ListController {

    async handlegetDoctorsList(req, res) {
        const { departmentId, limit, offset } = req.query;
        if (!mongoose.Types.ObjectId.isValid(departmentId)) {
            return res.status(200).json({ status: 0, message: "Invalid department ID" });
        }
        const parsedLimit = limit ? parseInt(limit) : 10;
        const parsedOffset = offset ? parseInt(offset) : 0;
        try {
          const doctors = await DoctorService.getDoctorsByBusinessAndDepartment(departmentId,parsedLimit,parsedOffset);
          return res.status(200).json({status: 1, data: doctors});
        } catch (error) {
          console.error(error);
          res.status(200).json({  status: 0, error: error.message || "Failed to fetch doctors." });
        }
      }
  
     async handleGetDoctorsTeam(req, res) {
        try {
          const { businessId } = req.query;
    
          const fhirDoctors = await DoctorService.getDoctorsWithAppointments(businessId);
    
          if (!fhirDoctors.length) {
            return res.status(200).json({ status: 0, message: "No doctor found" });
          }
    
          res.status(200).json({
            status: 1,
            data: fhirDoctors
          });
        } catch (error) {
          console.error("Doctor fetch error:", error);
          res.status(200).json({ status: 0, error: "Error fetching doctors and appointments." });
        }
      }

      async handleGetLists(req, res) {
        try {
          let { Type, offset = 0, limit = 10 } = req.query;
      
          // Sanitize and validate query parameters
          Type = typeof Type === 'string' ? validator.escape(Type.trim()) : '';
          offset = validator.isInt(offset.toString(), { min: 0 }) ? parseInt(offset) : 0;
          limit = validator.isInt(limit.toString(), { min: 1, max: 100 }) ? parseInt(limit) : 10;
      
          let BusinessType = '';
          if (Type === 'breedingFacility') {
            BusinessType = 'Breeding Facility';
          } else if (Type === 'petSitter') {
            BusinessType = 'Pet Sitter';
          } else if (Type === 'groomerShop') {
            BusinessType = 'Groomer Shop';
          } else {
            BusinessType = Type;
          }
      
          const allowedTypes = ['Hospital', 'Clinic', 'Breeding Facility', 'Pet Sitter', 'Groomer Shop', 'all'];
          if (BusinessType && !allowedTypes.includes(BusinessType)) {
            return res.status(200).json({ status: 0, message: "Invalid Business Type" });
          }
      
          const Businessdata = await BusinessService.getBusinessList(BusinessType, offset, limit);
      
          const fhirGroupedBundles = {};
      
          for (const key in Businessdata) {
            const group = Businessdata[key].data;
            const nestedResources = [];
      
            for (const org of group) {
              const fhirOrg = FhirFormatter.toFhirOrganization(org);
              const fhirDepts = FhirFormatter.toFhirHealthcareServices(org);
      
              fhirOrg.healthcareServices = fhirDepts;
              nestedResources.push(fhirOrg);
            }
      
            fhirGroupedBundles[key] = {
              resourceType: "Bundle",
              type: "collection",
              total: nestedResources.length,
              entry: nestedResources.map(resource => ({ resource }))
            };
          }
      
          res.status(200).json({
            status: 1,
            data: fhirGroupedBundles
          });
      
        } catch (err) {
          console.error(err);
          res.status(500).json({ status: 0, error: err.message });
        }
      }
      

}  
 module.exports = new ListController();







