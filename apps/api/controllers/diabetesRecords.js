const diabetesRecords = require('../models/records');

async function handleDiabetesRecords(req,res) {
    var fileName = "";
    const diabetesData = req.body;
    const PetImages= req.files.map(file => ({
      filename: file.filename,
      path: file.path,
    }));
    const adddiabetesRecord = await diabetesRecords.create({
        userId: diabetesData.userId,
        petId: diabetesData.petId,
        recordDate: diabetesData.recordDate,
        recordTime:diabetesData.recordTime,
        waterIntake:diabetesData.waterIntake,
        foodIntake: diabetesData.foodIntake,
        activityLevel: diabetesData.activityLevel,
        urination: diabetesData.urination,
        signOfIllness: diabetesData.signOfIllness,
        bloodGlucose: diabetesData.bloodGlucose,
        urineGlucose: diabetesData.urineGlucose,
        urineKetones: diabetesData.urineKetones,
        weight: diabetesData.weight,
        bodyCondition: PetImages,
        vetId: diabetesData.vetId,
    });
    if(adddiabetesRecord){
        res.status(201).json({
            message: 'Diabetes Record Added successfully',
            diabetesRecords: {
              id: adddiabetesRecord.id,
            }
          });
    }
    
}

async function handleDiabetesLogs(req,res){

  const userid = req.body.userId;
  const result = await diabetesRecords.find({ userId : {$eq: userid } } );;
  if (result.length === 0) return res.status(404).json({ message: "No Diabetes logs found" });
  res.json(result);
}

module.exports = {
  handleDiabetesRecords,
  handleDiabetesLogs,
}