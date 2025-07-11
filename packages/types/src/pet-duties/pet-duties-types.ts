// types/SharedPetDutyInput.ts

export interface TaskDetail {
  name: string;
  value: string | number | null;
  unit: string | null;
  code: string | null;
}

export interface SharedPetDutyInput {
  petId: string;
  userId: string | null;
  ownerId: string;
  taskName: string;
  taskDate: string;     // formatted as YYYY-MM-DD
  taskTime: string;     // formatted as HH:mm
  repeatTask: string;
  taskReminder: string;
  taskDetails: TaskDetail[];
  syncWithCalendar: boolean;
}

export interface PetDutyFhirObservationOutput {
  resourceType: "Observation";
  status: "final";
  category: [
    {
      coding: [
        {
          system: string;
          code: string;
          display: string;
        }
      ];
    }
  ];
  code: {
    coding: [
      {
        system: string;
        code: string;
        display: string;
      }
    ];
    text: string;
  };
  subject: {
    reference: string; // e.g., Pet/abc123
  };
  effectiveDateTime: string; // ISO timestamp
  extension: [
    {
      url: "http://example.org/fhir/StructureDefinition/ownerId";
      valueString: string;
    },
    {
      url: "http://example.org/fhir/StructureDefinition/syncWithCalendar";
      valueBoolean: boolean;
    }
  ];
  component: {
    code: {
      coding: [
        {
          code?: string | null;
          display?: string;
        }
      ];
      text: string;
    };
    valueString?: string | number;
    valueQuantity?: {
      value: number;
      unit: string;
    };
  }[];
}

    // Construct safe update object
export interface UpdateData {
          petId?: string;
          ownerId?: string;
          taskName: string;
          taskDate: string;
          taskTime?: string;
          repeatTask: string;
          taskReminder: string;
          taskDetails: TaskDetail[];
          syncWithCalendar: boolean;
   }

export interface RecordTaskDetail {
    name: string;
    value: string | number | null;
    unit?: string | null;
    code?: string | null;
  }

export interface RecordType {
    petId: string;
    ownerId: string;
    taskName: string;
    taskDate: string;
    taskTime?: string;
    repeatTask?: string;
    taskReminder?: string;
    taskDetails?: RecordTaskDetail[];
    syncWithCalendar?: boolean;
  }