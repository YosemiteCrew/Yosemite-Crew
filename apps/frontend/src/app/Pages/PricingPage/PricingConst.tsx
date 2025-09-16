// PricingPage-header
export const pricingPlans = [
  {
    id: 1,
    icon: "solar:star-bold",
    title: (
      <>
        Self-Hosting <span>(Free Plan)</span>
      </>
    ),
    description:
      "Perfect for new or small practices exploring digital management on your own",
    price: "$0",
    subText: (
      <p>
        Free under <strong>2 Active Users</strong>
      </p>
    ),
    highlight: false,
    label: "self"
  },
  {
    id: 2,
    icon: "ph:money-wavy-fill",
    title: "Pay-as-you-go",
    description: "Flexible growth for practices that need to scale on demand.",
    price: "Custom Pricing",
    subText: (
      <p>
        Seats up to <strong>10 Users</strong>, max{" "}
        <strong>200 Appointments</strong> and <strong>500 Assessments</strong>
      </p>
    ),
    highlight: true,
    label: "custom"
  },
];

// plansData.js
export const planFeatures = [
  {
    feature: "Setup & Maintenance",
    selfHosting: "Managed by Your team",
    payAsYouGo: "Managed by us",
  },
  {
    feature: "Data Storage",
    selfHosting: "Dependent on your infrastructure",
    payAsYouGo: "Unlimited cloud storage",
  },
  {
    feature: "Security & Compliance",
    selfHosting: "You handle compliance and security",
    payAsYouGo: "Fully compliant (SOC2, ISO 27001, GDPR)",
  },
  {
    feature: "Automatic Updates",
    selfHosting: "Manual updates required",
    payAsYouGo: "Included",
  },
  {
    feature: "Backup & Recovery",
    selfHosting: "You manage backup and recovery",
    payAsYouGo: "Daily automatic backups",
  },
  {
    feature: "Support",
    selfHosting: "Limited support",
    payAsYouGo: "24/7 priority support",
  },
  {
    feature: "Uptime Guarantee",
    selfHosting: "Dependent on your infrastructure",
    payAsYouGo: "99.99% uptime SLA",
  },
  {
    feature: "Cost",
    selfHosting: "One-time setup cost, ongoing server costs",
    payAsYouGo: "Pay as you go",
  },
  {
    feature: "Scalability",
    selfHosting: "Dependent on your infrastructure",
    payAsYouGo: "Easily scalable",
  },
  {
    feature: "Customizations",
    selfHosting: "Limited customisation",
    payAsYouGo: "Unlimited customisation",
  },
];

// Key Feature data
export const featuresData = [
  {
    title: "Clinical & Medical Management",
    items: ["Appointments", "Observational Tools", "Medical Records"],
  },
  {
    title: "Appointments & Scheduling",
    items: ["Scheduler", "Online Booking"],
  },
  {
    title: "Communication & Messaging",
    items: [
      "Internal Chats",
      "2-Way Messaging",
      "Targeted Messages & Newsletters",
    ],
  },
  {
    title: "Task & Workflow Management",
    items: ["User Tasks", "Admin Triggers"],
  },
  {
    title: "Finance Management",
    items: [
      "Financial Reporting & Analytics",
      "Inventory Management",
      "Payment Processing",
    ],
  },
  {
    title: "Customisation and Compliance",
    items: ["Mobile App", "Advanced API Access"],
  },
];

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
