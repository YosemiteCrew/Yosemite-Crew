const pet = require('../models/YoshPet');
const jwt = require('jsonwebtoken');
const path = require('path');

async function handleAddPet(req,res){
  const token = req.headers.authorization.split(' ')[1]; // Extract token
  const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
  
  const cognitoUserId = decoded.username; // Get user ID from token
    var PetImage = "";
    if (req.files && req.files.petImage) {
      const petImage = req.files.petImage;

      // Validate file type
      const allowedExtensions = /jpg|jpeg|png|gif/;
      const extension = path.extname(petImage.name).toLowerCase();
      if (!allowedExtensions.test(extension)) {
          return res.status(200).json({ message: 'Only image files are allowed.' });
      }

      // Generate a unique file name
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
          
          // Use the global upload path
          const uploadPath = path.join(req.app.locals.uploadPath, uniqueName);

          // Move the file to the upload directory
          await petImage.mv(uploadPath);
          PetImage = uniqueName;
  }
  const { petType, petBreed, petName, petdateofBirth, petCurrentWeight, petColor, petBloodGroup, isNeutered,ageWhenNeutered,microChipNumber,isInsured,insuranceCompany,policyNumber,passportNumber,petFrom  } = req.body; // Data from request body

    const addPet = await pet.create({
        cognitoUserId,
        petType,
        petBreed,
        petName,
        petdateofBirth,
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
        petImage: PetImage
    });
    if(addPet){
        res.status(200).json({
            status: 1,
            message: 'Pet Added successfully',
            data: addPet
          });
    }
   
}

async function handleGetPet(req,res) {
    const userid = req.body.userId;
    const result = await pet.find({ userId: userid });
    if (result.length === 0) return res.status(200).json({ status: 1, data: result, message: "No pets found for this user" });
    res.status(200).json({status: 1, data: result});
}

async function handleDeletePet(req,res) {
    const petId = req.body.petId;
    const result = await pet.deleteOne({ _id: petId });
    if (result.deletedCount === 0) {
      return res.status(200).json({ message: "Pet not found" });
    }

    res.json({ message: "Pet deleted successfully" });
}

async function handleEditPet(req,res) {
    try {
    const updatedPetData = req.body;
    const id = updatedPetData.petId;
    const document =  req.file;
    if(document) {
        updatedPetData.petImage = document.filename;
    }
    const editPetData = await pet.findByIdAndUpdate(id,updatedPetData, { new: true });
    if (!editPetData) {
        return res.status(404).json({ message: "Pet record not found" });
      }
  
      res.json(editPetData);
    } catch (error) {
      res.status(500).json({ message: "Error updating pet record", error });
    }
    
}



module.exports = {
    handleAddPet,
    handleGetPet,
    handleDeletePet,
    handleEditPet,
}