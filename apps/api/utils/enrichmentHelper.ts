import Department from '../models/AddDepartment';
import AddDoctors from '../models/AddDoctor';
import feedbacks from '../models/feedback';

export async function enrichClinics(clinics:any) {
  return Promise.all(
    clinics.map(async (clinic:any) => {
      const feedbacksList = await feedbacks.find({ toId: clinic.cognitoId });
      clinic.rating = feedbacksList.length
        ? feedbacksList.reduce((sum, fb) => sum + fb.rating, 0) / feedbacksList.length
        : 0;
      return clinic;
    })
  );
}

export function enrichPetSitters(sitters: unknown[]) {
  return Promise.resolve(sitters);
}

export  function enrichGroomers(groomers:unknown) {
    return Promise.resolve(groomers);
}

export async function fetchDepartmentsAndRating(hospitals:any) {
  return Promise.all(hospitals.map(async (hospital:any) => {
    const [departments, feedbacksList] = await Promise.all([
      Department.find({ bussinessId: hospital.cognitoId }),
      feedbacks.find({ toId: hospital.cognitoId }),
    ]);

    hospital.rating = feedbacksList.length
      ? feedbacksList.reduce((sum, fb) => sum + fb.rating, 0) / feedbacksList.length
      : 0;

    hospital.departments = await Promise.all(
      departments.map(async (dept:any) => ({
        departmentId: dept._id,
        departmentName: dept.departmentName,
        doctorCount: await AddDoctors.countDocuments({
          bussinessId: hospital.cognitoId,
          "professionalBackground.specialization": dept._id.toString(),
        }),
      }))
    );

    return hospital;
  }));
}



