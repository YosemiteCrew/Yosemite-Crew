class GraphDataToFHIR {
    constructor(graphData) {
      this.graphData = graphData;
    }
  
    getLastDayOfMonth(month) {
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, month, 0).getDate(); // Get last day of given month
    }
  
    convertToFHIR() {
      return {
        resourceType: "Bundle",
        type: "collection",
        entry: this.graphData.map((data) => {
          const lastDay = this.getLastDayOfMonth(data.month);
          return {
            resource: {
              resourceType: "MeasureReport",
              id: `appointments-${data.month}`,
              status: "complete",
              type: "summary",
              period: {
                start: `2025-${String(data.month).padStart(2, "0")}-01`,
                end: `2025-${String(data.month).padStart(2, "0")}-${lastDay}`,
              },
              measure: "AppointmentMetrics",
              extension: [
                {
                  url: "http://example.org/fhir/StructureDefinition/month-name",
                  valueString: data.monthName,
                },
              ],
              group: [
                {
                  code: { text: "Total Appointments" },
                  population: [{ count: data.totalAppointments }],
                },
                {
                  code: { text: "Successful Appointments" },
                  population: [{ count: data.successful }],
                },
                {
                  code: { text: "Canceled Appointments" },
                  population: [{ count: data.canceled }],
                },
              ],
            },
          };
        }),
      };
    }
  }

  module.exports = GraphDataToFHIR;