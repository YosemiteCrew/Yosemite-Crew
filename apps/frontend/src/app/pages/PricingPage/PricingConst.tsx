// Pricing Calulator
type PlanConfigParams = {
  appointments: number;
  setAppointments: (value: number) => void;
  assessments: number;
  setAssessments: (value: number) => void;
  seats: number;
  setSeats: (value: number) => void;
};

export const getPlanConfig = ({
  appointments,
  setAppointments,
  assessments,
  setAssessments,
  seats,
  setSeats,
}: PlanConfigParams) => ({
  self: {
    ranges: [
      {
        label: "Numbers of Appointment",
        value: appointments,
        setter: setAppointments,
        min: 0,
        max: 2000,
      },
      {
        label: "Number of Obervational Tools",
        value: assessments,
        setter: setAssessments,
        min: 0,
        max: 500,
      },
      { label: "Seats", value: seats, setter: setSeats, min: 1, max: 10 },
    ],
    calculatePrice: () => (0).toFixed(2), // always free
  },
  custom: {
    ranges: [
      {
        label: "Numbers of Appointment",
        value: appointments,
        setter: setAppointments,
        min: 0,
        max: 2000,
      },
      {
        label: "Number of Obervational Tools",
        value: assessments,
        setter: setAssessments,
        min: 0,
        max: 500,
      },
      { label: "Seats", value: seats, setter: setSeats, min: 1, max: 10 },
    ],
    calculatePrice: () =>
      (
        Math.max(0, appointments - 120) * 0.079785 +
        Math.max(0, assessments - 200) * 0.4 +
        Math.max(0, seats - 2) * 3.75
      ).toFixed(2),
  },
});
