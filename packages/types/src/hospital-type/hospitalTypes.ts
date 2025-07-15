export type GraphData = {
  month: number;
  monthName: string;
  totalAppointments: number;
  successful: number;
  canceled: number;
};

export type FHIRMeasureGroup = {
  code: { text: string };
  population: { count: number }[];
};

export type FHIRMeasureReport = {
  resourceType: "MeasureReport";
  id: string;
  status: string;
  type: string;
  period: {
    start: string;
    end: string;
  };
  measure: string;
  extension: {
    url: string;
    valueString: string;
  }[];
  group: FHIRMeasureGroup[];
};

export type FHIRBundleEntry = {
  resource: FHIRMeasureReport;
};

export type FHIRAppointmentAssessmentGraphBundle = {
  resourceType: "Bundle";
  type: "collection";
  entry: FHIRBundleEntry[];
};

export type QueryParams = {
  userId?: string;
  days?: string;
  reportType?: string;
  LastDays?: string;
}
export type AggregatedAppointmentGraph = {
  month: number;
  totalAppointments: number;
  successful: number;
  canceled: number;
};

export type DataItem = {
  monthname: string;
  completed: number;
  cancelled: number;
};

export type FHIRBundleGraph = {
  resourceType: string;
  entry: {
    resource: {
      id: string;
      extension?: { url: string; valueString: string }[];
      group?: {
        code: { text: string };
        population: { count: number }[];
      }[];
    };
  }[];

};

export type FHIRBundleGraphForSpecialitywiseAppointments = {
  resourceType: "Bundle";
  type: string;
  entry: {
    resource: {
      id: string;
      resourceType: string;
      status: string;
      code: { text: string };
      valueQuantity: { value: number };
      extension?: { url: string; valueString: string }[];
    };
  }[];
};

export type FHIRtoJSONSpeacilityStats = {
  name: string;
  value: number;
};