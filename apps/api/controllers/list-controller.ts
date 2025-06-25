
import BusinessService from '../services/BusinessService';
const FhirFormatter = require('../utils/BusinessFhirFormatter');
const DoctorService = require("../services/DoctorService");
const validator = require('validator');
const mongoose = require('mongoose');

const ListController =  {

      getDoctorsList: async (req, res) => {
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
      },
  
      DoctorsTeam: async (req, res) => {
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
      },

      GetLists: async (req, res) => {
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
      },
      
      SeachOrganization: async (req, res) => {
        try {
          let { search, offset = 0, limit = 10 } = req.query;
      
          // Sanitize and validate query parameters
          search = typeof search === 'string' ? validator.escape(search.trim()) : '';
          offset = validator.isInt(offset.toString(), { min: 0 }) ? parseInt(offset) : 0;
          limit = validator.isInt(limit.toString(), { min: 1, max: 100 }) ? parseInt(limit) : 10;
      
          const businessData = await BusinessService.getBusinessSearchList(search, offset, limit);
      
          const nestedResources = [];
      
          for (const org of businessData.data) {
            const fhirOrg = FhirFormatter.toFhirOrganization(org);
            const fhirDepts = FhirFormatter.toFhirHealthcareServices(org);
            fhirOrg.healthcareServices = fhirDepts;
            nestedResources.push(fhirOrg);
          }
      
          const bundle = {
            resourceType: "Bundle",
            type: "collection",
            total: businessData.count,
            entry: nestedResources.map(resource => ({ resource }))
          };
      
          res.status(200).json({
            status: 1,
            data: bundle
          });
      
        } catch (err) {
          console.error(err);
          res.status(500).json({ status: 0, error: err.message });
        }
      }
       

}  

 export default ListController;







