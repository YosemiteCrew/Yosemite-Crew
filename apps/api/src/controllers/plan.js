const exercisePlan = require('../models/plan');
const { YoshPainJournals } = require('../models/painJournal');


async function handleExercisePlan(req,res) {
    const planData = req.body;
    const exercisePlans = await exercisePlan.create({
        userId: planData.userId,
        petId: planData.petId,
        typeOfPlan: planData.typeOfPlan,
        condition:planData.condition,
        weeksSinceSurgery:planData.weeksSinceSurgery,
        mobilityLevel: planData.mobilityLevel,
        painLevel: planData.painLevel,
    });
    if(exercisePlans){
        res.status(201).json({
            message: 'Exercise Plan saved successfully',
            plan: {
              id: exercisePlans.id,
            }
          });
    }
    
}

async function handleAddPainJournal(req,res){
    const journalData = req.body;
    const painJournal = await YoshPainJournals.create({
        userId: journalData.userId,
        petId: journalData.petId,
        typeOfAssessment: journalData.typeOfAssessment,
        answers:journalData.answers,
        
    });
    if(painJournal){
        res.status(201).json({
            message: 'Pain assessment saved to pain journal successfully',
            Feline: {
              id: painJournal.id,
            }
          });
    }
}



async function handleGetExercisePlan(req,res){

    const userid = req.body.userId;
    const result = await exercisePlan.find({ userId : userid });
    if (result.length === 0) return res.status(404).json({ message: "No exercise plans found for this user" });
    res.json(result);
}

async function handleGetPainJournal(req,res){

    const userid = req.body.userId;
    const result = await YoshPainJournals.find({ userId : userid });
    if (result.length === 0) return res.status(404).json({ message: "No pain journals found for this user" });
    res.json(result);
}

module.exports = {
    handleExercisePlan,
    handleAddPainJournal,
    handleGetExercisePlan,
    handleGetPainJournal,
    
}