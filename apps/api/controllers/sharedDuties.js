const petDuties = require('../models/petDuties');


async function handleSaveSharedDuties(req,res) {
    const sharedData = req.body;
    const addSharedRecord = await petDuties.create({
        petId: sharedData.petId,
        userId: sharedData.userId,
        ownerId: sharedData.ownerId,
        taskName: sharedData.taskName,
        taskDate:sharedData.taskDate,
        taskTime:sharedData.taskTime,
        repeatTask: sharedData.repeatTask,
        taskReminder: sharedData.taskReminder,  
    });
    if(addSharedRecord){
        res.status(201).json({
            message: 'Shared pet Duty Added successfully',
            SharedPetRecords: {
              id: addSharedRecord.id,
            }
          });
    }
    
}

async function handleEditSharedDuties(req, res) {
  try {
    const updatedSharedData = req.body;
    const id = req.params.taskId;
    console.log(id);

    const editSharedPetData = await petDuties.findOneAndUpdate(
      { _id: { $eq: id } },
      updatedSharedData,
      { new: true }
    );

    if (!editSharedPetData) {
      return res.status(404).json({ message: "Shared duty task not found" });
    }

    res.json(editSharedPetData);
  } catch (error) {
    res.status(500).json({ message: "Error updating shared duty record", error });
  }
}


async function handleGetSharedDuties(req,res){

    const userid = req.params.userId;
    const result = await petDuties.find({ userId : {$eq: userid } } );
    if (result.length === 0) return res.status(404).json({ message: "No Shared pet duty record found for this user" });
    res.json(result);
}

module.exports = {
    handleSaveSharedDuties,
    handleEditSharedDuties,
    handleGetSharedDuties,
  }