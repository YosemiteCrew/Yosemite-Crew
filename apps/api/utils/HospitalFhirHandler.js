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
class AppointmentsFHIRConverter {
  constructor({ status , page = 1, limit = 10, totalPages, totalCount = 0, hasMore, appointments = [] }) {
    this.status = status;
    this.page = page;
    this.limit = limit;
    this.totalCount = totalCount || appointments.length;
    this.totalPages = totalPages || Math.ceil(this.totalCount / this.limit);
    this.hasMore = hasMore ?? this.page < this.totalPages;
    this.appointments = appointments;
  }

  toFHIRBundle() {
    const entries = this.appointments.map((appt) => {
      const dateOnly = appt.appointmentDate
      const appointmentTime = appt.appointmentTime || "00:00";

      return {
        fullUrl: `Appointment/${appt._id}`,
        resource: {
          resourceType: "Appointment",
          id: appt._id,
          status: this.status.toLowerCase(),
          start: dateOnly, // Only use date here
          description: `${appt.petName} with ${appt.veterinarian}`,
          participant: [
            {
              actor: { display: appt.ownerName },
              status: "accepted",
            },
            {
              actor: { display: appt.veterinarian || "N/A" },
              status: "accepted",
            },
          ],
          reasonCode: [
            {
              text: appt.department,
            },
          ],
          extension: [
            {
              url: "http://example.org/fhir/StructureDefinition/appointment-time",
              valueString: appointmentTime, // e.g. "11:00 AM"
            },
          ],
        },
      };
    });

    const links = [
      { relation: "self", url: `?page=${this.page}&limit=${this.limit}` },
      ...(this.hasMore ? [{ relation: "next", url: `?page=${this.page + 1}&limit=${this.limit}` }] : []),
    ];

    return {
      resourceType: "Bundle",
      type: "searchset",
      total: this.totalCount,
      link: links,
      entry: entries,
      page: this.page,
      limit: this.limit,
      totalPages: this.totalPages,
      hasMore: this.hasMore,
    };
  }
}


module.exports= {GraphDataToFHIR,AppointmentsFHIRConverter};
