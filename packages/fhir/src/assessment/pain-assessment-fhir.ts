export function convertToPainAssessmentFhir(doc: any) {
    return {
      resourceType: "PainAssessment",
      title: doc.name,
      description: doc.description,
      questions: doc.questions.map((q: any) => ({
        Title: q.question,  

        Description: q.description,  
        questionId: q._id,  
        options: q.imageOptions.map((opt: any) => ({
          score: opt.score,
          optionLabel: opt.label,  
          descriptionLabel: opt.description,
          optionImage: opt.image ?? null, 
          optionId: opt._id, 
        })),
      }))
    };
  }