import { getData } from "@/app/axios-services/services";
import { convertFromFhirVetProfile, fromFHIRBusinessProfile } from "@yosemite-crew/fhir";
import { ConvertToFhirVetProfileParams, FhirOrganization } from "@yosemite-crew/types";


const ProfileApi = {
  getBusinessProfile: async (userId: string) => {
    try {
      const response = await getData(`/api/auth/organization/?userId=${userId}`);
      return  fromFHIRBusinessProfile(response.data as FhirOrganization);
    } catch (error) {
      console.error("Error fetching business profile:", error);
      throw error;
    }
  },
  getVetAndTeamsProfile: async(userId:string)=>{
    try {
      const response = await getData(`/fhir/v1/getDoctors/?userId=${userId}`);
      return convertFromFhirVetProfile(response.data as ConvertToFhirVetProfileParams)
    } catch (error) {
      console.error("Error fetching business profile", error)
    }
  }
}

export default ProfileApi;