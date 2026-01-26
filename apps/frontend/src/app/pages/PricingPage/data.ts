export const PricingPlans = [
  {
    active: true,
    id: 1,
    title: "Free plan",
    recommended: false,
    amount: "€0",
    amountYearly: "€0",
    amountLabel: "",
    description: "Perfect for new or small pet businesses exploring on their own.",
    buttonText: "Get started",
    buttonSrc: "/signup",
    includes: [
      "Free for individual usage",
      "120 appointments",
      "200 observational tools",
      "Yosemite Crew scheduler",
      "Security & compliance integrations (SOC2, ISO 27001, GDPR)",
    ],
  },
  {
    active: true,
    id: 2,
    title: "Business plan",
    recommended: true,
    amount: "€12",
    amountYearly: "€10",
    amountLabel: "per member / month",
    description: "Flexible growth for pet businesses that need to scale on demand.",
    buttonText: "Get started",
    buttonSrc: "/signup",
    includes: [
      "Unlimited appointments",
      "Unlimited observational tools",
      "Yosemite Crew scheduler",
      "Security & compliance integrations (SOC2, ISO 27001, GDPR)",
    ],
  },
  {
    active: false,
    id: 3,
    title: "Enterprise plan",
    recommended: false,
    amount: "Coming soon",
    amountYearly: "Coming soon",
    amountLabel: "",
    description:
      "For pet businesses to operate with scalability, control, and security.",
    buttonText: "Notify me",
    buttonSrc: "#",
    includes: [
      "Unlimited usage",
      "Unlimited appointments",
      "Unlimited observational tools",
      "Yosemite Crew scheduler",
      "Security & compliance integrations (SOC2, ISO 27001, GDPR)",
    ],
  },
];

export const TableData = [
  {
    head: "Operations",
    rows: [
      {
        name: "Appointments",
        free: "120",
        business: "unlimited",
      },
      {
        name: "Observational tools",
        free: "200",
        business: "unlimited",
      },
      {
        name: "Documents",
        free: "yes",
        business: "yes",
      },
      {
        name: "Scheduler",
        free: "yes",
        business: "yes",
      },
      {
        name: "Inventory management",
        free: "yes",
        business: "yes",
      },
      {
        name: "Tasks management",
        free: "yes",
        business: "yes",
      },
      {
        name: "Wellness management",
        free: "yes",
        business: "yes",
      },
      {
        name: "Forms",
        free: "yes",
        business: "yes",
      },
    ],
  },
  {
    head: "Organisation",
    rows: [
      {
        name: "Department/Specialty",
        free: "no",
        business: "yes",
      },
      {
        name: "Team Management",
        free: "no",
        business: "yes",
      },
    ],
  },
  {
    head: "Communication",
    rows: [
      {
        name: "Internal Chats",
        free: "yes",
        business: "yes",
      },
      {
        name: "Pet parent app",
        free: "yes",
        business: "yes",
      },
      {
        name: "2-Way Messaging",
        free: "yes",
        business: "yes",
      },
      {
        name: "Support via Yosemite Crew",
        free: "Community support",
        business: "Dedicated Discord support",
      },
    ],
  },
  {
    head: "Finance",
    rows: [
      {
        name: "Financial Reporting & Analytics",
        free: "yes",
        business: "yes",
      },
      {
        name: "Billing & Invoices",
        free: "yes",
        business: "yes",
      },
      {
        name: "Payment Processing via stripe",
        free: "yes",
        business: "yes",
      },
    ],
  },
  {
    head: "Infrastructure",
    rows: [
      {
        name: "Security and compliance",
        free: "Fully compliant (SOC2, ISO 27001, GDPR)",
        business: "Fully compliant (SOC2, ISO 27001, GDPR)",
      },
      {
        name: "Automatic updates",
        free: "yes",
        business: "yes",
      },
      {
        name: "Multiple Availability Zones",
        free: "no",
        business: "Coming soon",
      },
      {
        name: "Audit log",
        free: "Coming soon",
        business: "Coming soon",
      },
      {
        name: "Setup and maintenance",
        free: "Coming soon",
        business: "Coming soon",
      },
      {
        name: "Backup and recovery",
        free: "Coming soon",
        business: "Coming soon",
      },
      {
        name: "Uptime guarantee",
        free: "Coming soon",
        business: "Coming soon",
      },
    ],
  },
];
