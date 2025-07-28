import { DepartmentsForInvite, FhirTeamOverview, InviteItem, TeamMember, TeamOverview } from "@yosemite-crew/types";

export function toFHIRInviteItem(invite: InviteItem): any {
  return {
    resourceType: "Communication",
    id: invite._id,
    status: invite.status || "unknown",
    sent: invite.invitedAt || "",
    subject: {
      identifier: { value: invite.invitedBy || "" },
      display: invite.invitedByName || "",
    },
    recipient: [
      {
        identifier: { value: invite.email || "" },
        display: invite.name || "",
      },
    ],
    reasonCode: [
      {
        text: `${invite.role || ""} - ${invite.department || ""}`,
      },
    ],
    payload: [
      {
        contentString: `Invite code: ${invite.inviteCode || ""}`,
      },
    ],
    extension: [
      {
        url: "http://example.com/fhir/StructureDefinition/business-id",
        valueString: invite.bussinessId || "",
      },
      {
        url: "http://example.com/fhir/StructureDefinition/invitedAtFormatted",
        valueString: invite.invitedAtFormatted || "",
      },
      {
        url: "http://example.com/fhir/StructureDefinition/departmentId",
        valueString: invite.departmentId || "",
      },
    ],
  };
}

export function fromFHIRInviteItem(fhir: any): InviteItem {
  const reasonText = fhir.reasonCode?.[0]?.text || "";
  const [role = "", department = ""] = reasonText.split(" - ");

  return {
    _id: fhir.id || "",
    email: fhir.recipient?.[0]?.identifier?.value || "",
    name: fhir.recipient?.[0]?.display || "",
    invitedBy: fhir.subject?.identifier?.value || "",
    invitedByName: fhir.subject?.display || "",
    department,
    role,
    inviteCode: fhir.payload?.[0]?.contentString?.replace("Invite code: ", "") || "",
    status: fhir.status || "",
    invitedAt: fhir.sent || "",
    invitedAtFormatted:
      fhir.extension?.find((e: any) => e.url.includes("invitedAtFormatted"))?.valueString || "",
    bussinessId:
      fhir.extension?.find((e: any) => e.url.includes("business-id"))?.valueString || "",
    departmentId:
      fhir.extension?.find((e: any) => e.url.includes("departmentId"))?.valueString || "",
  };
}
export function toFHIRInviteList(invites: InviteItem[]): any[] {
  return invites.map(toFHIRInviteItem);
}

export function fromFHIRInviteList(fhirs: any[]): InviteItem[] {
  return fhirs.map(fromFHIRInviteItem);
}



export function toFhirTeamOverview(data: TeamOverview): FhirTeamOverview {
  return {
    resourceType: "Observation",
    id: "team-overview",
    status: "final",
    code: {
      text: "Team Overview Summary",
    },
    component: [
      {
        code: { text: "Total Web Users" },
        valueInteger: data.totalWebUsers,
      },
      {
        code: { text: "On Duty Count" },
        valueInteger: data.onDutyCount,
      },
      {
        code: { text: "Department Count" },
        valueInteger: data.departmentCount,
      },
      {
        code: { text: "Invited Count" },
        valueInteger: data.invitedCount,
      },
    ],
  };
}


export function fromFhirTeamOverview(fhir: FhirTeamOverview): TeamOverview {
  const findValue = (label: string) =>
    fhir.component.find((c) => c.code.text === label)?.valueInteger || 0;

  return {
    totalWebUsers: findValue("Total Web Users"),
    onDutyCount: findValue("On Duty Count"),
    departmentCount: findValue("Department Count"),
    invitedCount: findValue("Invited Count"),
  };
}









// Main FHIR conversion
export function convertToFhirTeamMembers(data: TeamMember[]): {
  practitioners: any[];
  roles: any[];
} {
  const practitioners = data.map((member) => {
    return {
      resourceType: "Practitioner",
      id: member.userId,
      identifier: [
        {
          system: "https://example.org/registration",
          value: member.registrationNumber,
        },
        {
          system: "https://example.org/license",
          value: member.medicalLicenseNumber, // Custom license field
        },
      ],
      name: [
        {
          family: member.lastName,
          given: [member.firstName],
        },
      ],
      telecom: [
        { system: "phone", value: member.mobileNumber },
        { system: "email", value: member.email },
      ],
      gender: member.gender.toLowerCase(),
      birthDate: member.dateOfBirth,
      address: [
        {
          line: [member.addressLine1],
          city: member.city,
          postalCode: member.postalCode,
          state: member.stateProvince,
          country: member.countrycode || "IN",
        },
      ],
      photo: member.image ? [{ url: member.image }] : undefined,
      extension: [
        ...member.documents.map((doc) => ({
          url: "http://example.org/fhir/StructureDefinition/practitioner-documents",
          extension: [
            { url: "name", valueUrl: doc.name },
            { url: "type", valueString: doc.type },
            { url: "date", valueDateTime: doc.date },
          ],
        })),
        ...(member.linkedin
          ? [
              {
                url: "http://example.org/fhir/StructureDefinition/practitioner-linkedin",
                valueUrl: member.linkedin,
              },
            ]
          : []),
      ],
    };
  });

  const roles = data.map((member) => ({
    resourceType: "PractitionerRole",
    id: member.userId,
    practitioner: { reference: `Practitioner/${member.userId}` },
    organization: { reference: `Organization/${member.bussinessId}` },
    code: [{ text: member.role }],
    specialty: [{ text: member.specialization }],
    location: [{ display: member.area }],
    availableTime: member.availability.map((slot) => ({
      daysOfWeek: [slot.day.toLowerCase()],
      availableStartTime: slot.times[0]
        ? `${slot.times[0].from.hour.padStart(2, "0")}:${slot.times[0].from.minute.padStart(2, "0")}`
        : undefined,
      availableEndTime: slot.times[0]
        ? `${slot.times[0].to.hour.padStart(2, "0")}:${slot.times[0].to.minute.padStart(2, "0")}`
        : undefined,
    })),
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/practitioner-status",
        valueString: member.status,
      },
      {
        url: "http://example.org/fhir/StructureDefinition/biography",
        valueString: member.biography,
      },
      ...(member.department
        ? [
            {
              url: "http://example.org/fhir/StructureDefinition/department",
              valueString: member.department,
            },
          ]
        : []),
      ...(member.duration
        ? [
            {
              url: "http://example.org/fhir/StructureDefinition/duration",
              valueString: member.duration,
            },
          ]
        : []),
    ],
  }));

  return { practitioners, roles };
}






export function convertFromFhirTeamMembers(
  practitioners: any[],
  roles: any[]
): TeamMember[] {
  return roles.map((role) => {
    const practitionerId = role.practitioner?.reference?.split("/")?.[1] || "";
    const practitioner = practitioners.find((p) => p.id === practitionerId);

    const name = practitioner?.name?.[0] || {};
    const telecom = practitioner?.telecom || [];

    const getTelecom = (system: string) =>
      telecom.find((t: any) => t.system === system)?.value || "";

    const documents =
      practitioner?.extension?.filter((ext: any) =>
        ext.url.includes("practitioner-documents")
      )?.map((ext: any) => ({
        name: ext.extension.find((e: any) => e.url === "name")?.valueUrl || "",
        type: ext.extension.find((e: any) => e.url === "type")?.valueString || "",
        date: ext.extension.find((e: any) => e.url === "date")?.valueDateTime || "",
      })) || [];

    const getExtensionValue = (urlPart: string) =>
      role.extension?.find((e: any) => e.url.includes(urlPart))?.valueString || "";

    const availability = role.availableTime?.map((slot: any) => ({
      day: capitalizeFirst(slot.daysOfWeek?.[0] || ""),
      times: [
        {
          from: parseTimeToObj(slot.availableStartTime),
          to: parseTimeToObj(slot.availableEndTime),
        },
      ],
    }));

    return {
      _id: role.id,
      userId: practitioner?.id,
      role: role.code?.[0]?.text || "",
      department: getExtensionValue("department"),
      bussinessId: role.organization?.reference?.split("/")?.[1] || "",
      registrationNumber: practitioner?.identifier?.[0]?.value || "",
      medicalLicenseNumber:
        practitioner?.identifier?.find((id: any) =>
          id.system?.includes("license")
        )?.value || "",
      addressLine1: practitioner?.address?.[0]?.line?.[0] || "",
      availability,
      biography: getExtensionValue("biography"),
      city: practitioner?.address?.[0]?.city || "",
      countrycode: practitioner?.address?.[0]?.country || "IN",
      dateOfBirth: practitioner?.birthDate || "",
      documents,
      duration: getExtensionValue("duration"),
      email: getTelecom("email"),
      firstName: name.given?.[0] || "",
      gender: practitioner?.gender || "",
      image: practitioner?.photo?.[0]?.url || "",
      lastName: name.family || "",
      linkedin:
        practitioner?.extension?.find((e: any) =>
          e.url.includes("linkedin")
        )?.valueUrl || "",
      mobileNumber: getTelecom("phone"),
      postalCode: practitioner?.address?.[0]?.postalCode || "",
      specialization: role.specialty?.[0]?.text || "",
      stateProvince: practitioner?.address?.[0]?.state || "",
      area: role.location?.[0]?.display || "",
      status: getExtensionValue("status"),
    };
  });
}

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




// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Department for Invite>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>





export function convertToFhirDepartment(departments: DepartmentsForInvite[]) {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: departments.map((dept) => ({
      resource: {
        resourceType: "HealthcareService",
        id: dept._id,
        name: dept.departmentName.trim(),
      },
    })),
  };
}

export function convertFromFhirDepartment(fhirBundle: any): DepartmentsForInvite[] {
  if (!fhirBundle || !Array.isArray(fhirBundle.entry)) return [];

  return fhirBundle.entry.map((entry: any) => ({
    _id: entry.resource?.id || "",
    departmentName: entry.resource?.name || "",
  }));
}




