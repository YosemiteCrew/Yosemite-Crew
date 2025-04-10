const vaccination = require('../models/vaccination');

async function handleAddVaccination(req,res){
    var fileName = "";
    const body = req.body;
    const document =  req.file;
    if(document)fileName = document.filename;
    const addvaccination = await vaccination.create({
        userId: body.userId,
        petId: body.petId,
        manufacturerName: body.manufacturerName,
        vaccineName:body.vaccineName,
        batchNumber:body.batchNumber,
        expiryDate: body.expiryDate,
        vaccinationDate: body.vaccinationDate,
        hospitalName: body.hospitalName,
        nextdueDate: body.nextdueDate,
        vaccineImage: fileName,
    });
    if(addvaccination){
        res.status(201).json({
            message: 'Vaccination details Added successfully',
            appointment: {
              id: addvaccination.id,
            }
          });
    }
  
}

async function handleEditVaccination(req,res) {
    try {
    const updatedData = req.body;
    const id = req.params.id;
    const document =  req.file;
    if(document) {
        updatedData.vaccineImage = document.filename;
    }
    const editVaccination = await vaccination.findOneAndUpdate(
        { _id: { $eq: id } }, 
        updatedData,
        { new: true }
      );
    if (!editVaccination) {
        return res.status(404).json({ message: "Vaccination record not found" });
      }
  
      res.json(editVaccination);
    } catch (error) {
      res.status(500).json({ message: "Error updating vaccination record", error });
    }
    
}
async function handleGetVaccination(req,res){

    const userid = req.params.userId;
    const result = await vaccination.find({ userId : {$eq: userid } } );
    if (result.length === 0) return res.status(404).json({ message: "No appointment found for this user" });
    res.json({ data: result });
}

module.exports = {
    handleAddVaccination,
    handleEditVaccination,
    handleGetVaccination,
}