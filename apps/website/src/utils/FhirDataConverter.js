class FhirDataConverter {

    // constructor(data){
    // this.data = data;
    // }



    assessmentsData(data){

        const result = [];
          data.entry.forEach(({ resource }) => {
          if (resource.resourceType === 'assessment') {
            let assessment_type = resource.extension.find((e) =>
              e.url.includes("assessment-type")
            );
            let assessment_id = resource.extension.find((e) =>
              e.url.includes("assessment-id")
            );
            let pet_type = resource.patient.extension.find((e) =>
              e.url.includes("pet-type")
            );
            let pet_breed = resource.patient.extension.find((e) =>
              e.url.includes("pet-breed")
            );
            const record  = { 
                              id: resource.id,
                              petName : resource?.patient?.name[0]?.text,
                              petType : pet_type?.valueString,
                              petBreed : pet_breed?.valueString,
                              ownerName :  resource?.patient?.contact[0]?.name?.given + ' ' + resource?.patient?.contact[0]?.name?.family,
                              doctorName : resource?.practitioner?.name[0]?.given + ' ' + resource?.practitioner?.name[0]?.family,
                              assessment_type : assessment_type?.valueString,
                              assessmentId : assessment_id?.valueString,
                              department : resource?.practitioner?.organization?.display,
                                              
            }
            result.push(record);
          }
        });
        return result;
    }


    acceptAndcancel(id, status)

      {
        return {
          resourceType: "Assessment",
          id,
          status,
        };
     }
}

export {
    FhirDataConverter


}