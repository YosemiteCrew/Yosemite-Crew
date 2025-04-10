const medicalRecords = require('../models/medical');

async function handlesaveMedicalRecord(req,res) {

    const medicalData = req.body;
    // const MedicalDocs = req.files.map(file => ({
    //     filename: file.filename,
    //     path: file.path,
    //   }));
    const addMedicalRecords = await medicalRecords.create({
        userId: medicalData.userId,
        documentType: medicalData.documentType,
        title:medicalData.title,
        issueDate:medicalData.issueDate,
        expiryDate: medicalData.expiryDate,
        //medicalDocs: MedicalDocs,
    });
    if(addMedicalRecords){
        res.status(201).json({
            message: 'Medical record saved successfully',
            medicalRecord: {
              id: addMedicalRecords.id,
            }
          });
    }    
}

async function handleMedicalRecordList(req,res){

    const userid = req.params.userId;
    const result = await medicalRecords.find({ userId : {$eq: userid } } )
    if (result.length === 0) return res.status(404).json({ message: "No Medical record found for this user" });
    res.json(result);
}


module.exports = {
    handlesaveMedicalRecord,
    handleMedicalRecordList,
}