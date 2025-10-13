import { PractitionerData } from "@yosemite-crew/types";

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
function parseTimeToObj(time?: string) {
  if (!time) return { hour: "", minute: "", period: "" };

  const [hourStr, minute] = time.split(":");
  let hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? "PM" : "AM";
  if (hour > 12) hour -= 12;

  return {
    hour: hour.toString().padStart(2, "0"),
    minute,
    period,
  };
}

export const PractitionerDatafromFHIR = (bundle: any): PractitionerData[] => {
  if (!bundle.entry) return [];

  return bundle.entry.map((entry: any) => {
    const resource = entry.resource;
    const extensions = resource.extension || [];

    const getExt = (url: string) => {
      const found = extensions.find((ext: any) => ext.url === url);
      return (
        found?.valueString ?? found?.valueInteger ?? found?.valueUrl ?? null
      );
    };

    return {
      cognitoId: resource.id,
      name: resource.name?.[0]?.text || "",
      email:
        resource.telecom?.find((t: any) => t.system === "email")?.value || "",
      mobileNumber:
        resource.telecom?.find((t: any) => t.system === "phone")?.value || "",
      departmentName: getExt("departmentName") || "",
      status: getExt("status") || "",
      weekWorkingHours: getExt("weekWorkingHours") || 0,
      specialization: getExt("specialization") || "",
      yearsOfExperience: getExt("yearsOfExperience") || 0,
      image: getExt("image") || "",
    };
  });
};
