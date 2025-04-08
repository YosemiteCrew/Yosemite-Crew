const pet = require('../models/YoshPet');
const jwt = require('jsonwebtoken');
const path = require('path');
const {  handleMultipleFileUpload } = require('../middlewares/upload');
const { v4: uuidv4 } = require('uuid');

async function handleAddPet(req,res){
  const token = req.headers.authorization.split(' ')[1]; // Extract token
  const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
  const cognitoUserId = decoded.username; // Get user ID from token
  let imageUrls = '';
  const { petType, petBreed, petName, petGender, petdateofBirth, petCurrentWeight, petColor, petBloodGroup, isNeutered,ageWhenNeutered,microChipNumber,isInsured,insuranceCompany,policyNumber,passportNumber,petFrom  } = req.body; // Data from request body
 if (req.files) {
        const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
         imageUrls = await handleMultipleFileUpload(files);
    }

    const addPet = await pet.create({
        cognitoUserId,
        petType,
        petBreed,
        petName,
        petdateofBirth,
        petGender,
        petAge: calculateAge(petdateofBirth),
        petCurrentWeight,
        petColor,
        petBloodGroup,
        isNeutered,
        ageWhenNeutered,
        microChipNumber,
        isInsured,
        insuranceCompany,
        policyNumber,
        passportNumber,
        petFrom,
        petImage: imageUrls
    });
    if(addPet){
        res.status(200).json({
            status: 1,
            message: 'Pet Added successfully',
            data: convertPetToFHIR(addPet)
          });
    }
   
}

async function handleGetPet(req, res) {
  try {
    const baseUrl = process.env.BASE_URL;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Missing token' }] });

    const cognitoUserId = jwt.verify(token, process.env.JWT_SECRET).username;
    const { limit = 10, offset = 0 } = req.body;
    const pets = await pet.find({ cognitoUserId }).skip(parseInt(offset)).limit(parseInt(limit));

    if (!pets.length) return res.status(200).json({ resourceType: 'Bundle', type: 'searchset', total: 0, entry: [], message: 'No pets found' });

    const fhirPets = pets.map(petData => ({
      resourceType: 'Patient', // Ensure resourceType is top level
      id: petData._id.toString(),
      identifier: [{ system: `${baseUrl}/fhir/pet-ids`, value: petData._id.toString() }],
      name: [{ use: 'official', text: petData.petName }],
      gender: petData.petGender?.toLowerCase() === 'male' ? 'male' : 'female',
      birthDate: petData.petdateofBirth,
      animal: { species: { text: petData.petType }, breed: { text: petData.petBreed } },
      extension: [
        { url: `${baseUrl}/fhir/extensions/pet-age`, valueString: petData.petAge,title: "petAge" },
        { url: `${baseUrl}/fhir/extensions/pet-color`, valueString: petData.petColor,title: "petColor" },
        { url: `${baseUrl}/fhir/extensions/pet-weight`, valueString: petData.petCurrentWeight,title: "petCurrentWeight" },
        { url: `${baseUrl}/fhir/extensions/pet-blood-group`, valueString: petData.petBloodGroup,title: "petBloodGroup" },
        { url: `${baseUrl}/fhir/extensions/is-neutered`, valueString: petData.isNeutered,title: "isNeutered" },
        { url: `${baseUrl}/fhir/extensions/age-when-neutered`, valueString: petData.ageWhenNeutered,title: "ageWhenNeutered" },
        { url: `${baseUrl}/fhir/extensions/microchip-number`, valueString: petData.microChipNumber,title: "microChipNumber" },
        { url: `${baseUrl}/fhir/extensions/is-insured`, valueString: petData.isInsured,title: "isInsured" },
        { url: `${baseUrl}/fhir/extensions/insurance-company`, valueString: petData.insuranceCompany,title: "insuranceCompany" },
        { url: `${baseUrl}/fhir/extensions/policy-number`, valueString: petData.policyNumber,title: "policyNumber" },
        { url: `${baseUrl}/fhir/extensions/passport-number`, valueString: petData.passportNumber,title: "passportNumber" },
        { url: `${baseUrl}/fhir/extensions/pet-from`, valueString: petData.petFrom,title: "petFrom" },
        { url: `${baseUrl}/fhir/extensions/pet-image`, valueString: petData.petImage[0],title: "petImage" }
      ],
      meta: {
        created: petData.createdAt,
        lastUpdated: petData.updatedAt
      }
    }));

    res.status(200).json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: fhirPets.length,
      entry: fhirPets.map(petData => ({
        resource: petData // `resource` is directly the petData object
      }))
    });
  } catch (error) {
    res.status(500).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: error.message }] });
  }
}


async function handleDeletePet(req, res) {
  const petId = req.body.petId;

  try {
    const result = await pet.deleteOne({ _id: petId });
   
    if (result.deletedCount === 0) {
      return res.status(200).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            status: 0,
            severity: "error",
            code: "not-found",
            diagnostics: `No pet (Patient) found with ID ${petId}`,
          },
        ],
      });
    }

    // Success response with 200 and custom message in OperationOutcome
    return res.status(200).json({
      resourceType: "OperationOutcome",
      issue: [
        {
          status: 1,
          severity: "information",
          code: "informational",
          diagnostics: "Pet deleted successfully",
        },
      ],
    });
  } catch (error) {
    return res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          code: "exception",
          diagnostics: error.message,
        },
      ],
    });
  }
}

async function handleEditPet(req, res) {
  try {
    const updatedPetData = req.body;
    const id = updatedPetData.petId;
    let imageUrls = "";
    if (req.files) {
      const files = Array.isArray(req.files.files)
        ? req.files.files
        : [req.files.files];
      imageUrls = await handleMultipleFileUpload(files);
      updatedPetData.petImage = imageUrls;
    }
    const editPetData = await pet.findByIdAndUpdate(id, updatedPetData, { new: true });

    if (!editPetData) {
      return res.status(404).json({ message: "Pet record not found" });
    }
    // Convert to FHIR-compliant format
 

    res.json({status: 0,data: convertPetToFHIR(editPetData)});
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({
      message: "Error updating pet record",
      error: error.message || error.toString()
    });
  }
}

function calculateAge(dob) {
  const birthDate = new Date(dob);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  // If the birth month hasn't occurred yet this year, or it's the birth month but the day hasn't occurred yet
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

function convertPetToFHIR(addPet) {
  return {
    resourceType: "Patient",
    id: addPet._id.toString(),
    active: true,
    name: [
      {
        use: "official",
        text: addPet.petName
      }
    ],
    gender: addPet.petGender.toLowerCase(),
    birthDate: new Date(addPet.petdateofBirth).toISOString().split("T")[0],
    animal: {
      species: {
        coding: [
          {
            system: "http://hl7.org/fhir/animal-species",
            code: addPet.petType.toLowerCase(),
            display: capitalizeFirstLetter(addPet.petType)
          }
        ]
      },
      breed: {
        coding: [
          {
            system: "http://hl7.org/fhir/ValueSet/animal-breeds",
            code: addPet.petBreed.toLowerCase(),
            display: addPet.petBreed
          }
        ]
      },
      genderStatus: {
        coding: [
          {
            system: "http://hl7.org/fhir/ValueSet/gender-status",
            code: addPet.isNeutered.toLowerCase() === "yes" ? "neutered" : "intact",
            display: addPet.isNeutered === "Yes" ? "Neutered" : "Intact"
          }
        ]
      }
    },
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/pet-weight",
        valueString: addPet.petCurrentWeight
      },
      {
        url: "http://example.org/fhir/StructureDefinition/pet-color",
        valueString: addPet.petColor
      },
      {
        url: "http://example.org/fhir/StructureDefinition/pet-blood-group",
        valueString: addPet.petBloodGroup
      },
      {
        url: "http://example.org/fhir/StructureDefinition/pet-age-when-neutered",
        valueString: addPet.ageWhenNeutered
      },
      {
        url: "http://example.org/fhir/StructureDefinition/microchip-number",
        valueString: addPet.microChipNumber
      },
      {
        url: "http://example.org/fhir/StructureDefinition/is-insured",
        valueBoolean: addPet.isInsured.toLowerCase() === "yes"
      },
      {
        url: "http://example.org/fhir/StructureDefinition/insurance-company",
        valueString: addPet.insuranceCompany
      },
      {
        url: "http://example.org/fhir/StructureDefinition/policy-number",
        valueString: addPet.policyNumber
      },
      {
        url: "http://example.org/fhir/StructureDefinition/passport-number",
        valueString: addPet.passportNumber
      },
      {
        url: "http://example.org/fhir/StructureDefinition/pet-from",
        valueString: addPet.petFrom
      },
      {
        url: "http://example.org/fhir/StructureDefinition/pet-images",
        valueString: Array.isArray(addPet.petImage) ? addPet.petImage.join(', ') : addPet.petImage
      }
    ],
    meta: {
      lastUpdated: addPet.updatedAt
    }
  };
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}


module.exports = {
    handleAddPet,
    handleGetPet,
    handleDeletePet,
    handleEditPet,
}