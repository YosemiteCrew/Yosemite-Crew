export const trustCenterData = {
  hero: {
    title: "Security, Privacy, and Compliance",
    subtitle:
      "At Yosemite Crew, protecting your veterinary practice’s data is not just a feature it’s our foundation. We use enterprise-grade security to ensure your data is safe, compliant, and always available.",
    lastUpdated: "February 2026",
    email: "support@yosemitecrew.com",
    privacyLink: "/privacy-policy",
  },
  tabs: ["Overview", "Resources", "Controls", "Subprocessors"],

  certifications: [
    {
      name: "GDPR",
      status: "Compliant",
      description: "Fully compliant data processing with EU hosting.",
      icon: "https://d2il6osz49gpup.cloudfront.net/footer/gdpr.png",
    },
    {
      name: "SOC 2 Type I",
      status: "In Progress",
      description: "Currently in audit preparation phase.",
      icon: "https://d2il6osz49gpup.cloudfront.net/footer/soc-2.png",
    },
    {
      name: "ISO 27001",
      status: "In Progress",
      description: "ISMS Framework implemented and active.",
      icon: "https://d2il6osz49gpup.cloudfront.net/footer/iso.png",
    },
  ],

  resources: [
    {
      id: "res_soc2_2025",
      title: "SOC 2 Type I Report (2025)",
      type: "Audit Report",
      locked: true,
    },
    {
      id: "res_iso_cert",
      title: "ISO 27001 Certificate",
      type: "Certificate",
      locked: true,
    },
    {
      id: "res_pen_test",
      title: "Penetration Test Summary (2025)",
      type: "Security Report",
      locked: true,
    },
    {
      id: "res_dpa",
      title: "Data Processing Agreement (DPA)",
      type: "Legal",
      locked: false,
      link: "/terms-and-conditions",
    },
  ],

  securityPillars: [
    {
      title: "Organizational Security",
      description: "Governance, risk management, and vendor compliance.",
      items: [
        "ISMS Framework aligned with ISO 27001:2022",
        "Annual Risk Assessments & DPIAs",
        "Strict Vendor Management (DPAs signed)",
        "Regular Internal Security Audits",
      ],
    },
    {
      title: "People & Internal Security",
      description: "Ensuring our team protects your data.",
      items: [
        "Mandatory Security & Privacy Training",
        "Background Checks & NDAs for all staff",
        "Quarterly Access Reviews",
        "Automated Offboarding Protocols",
      ],
    },
    {
      title: "Infrastructure Security",
      description: "Fortified cloud environment and network defense.",
      items: [
        "Hosted on AWS (Luxembourg) & Google Cloud",
        "DDoS Protection & WAF enabled",
        "Weekly Automated Vulnerability Scanning",
        "Production Isolated from Testing",
      ],
    },
    {
      title: "Product Security",
      description: "Security built into the application code.",
      items: [
        "AES-256 Encryption (At Rest)",
        "TLS 1.3 Encryption (In Transit)",
        "Role-Based Access Control (RBAC)",
        "Multi-Factor Authentication (MFA) Support",
      ],
    },
    {
      title: "Data Privacy & Operations",
      description: "Reliability, backups, and data rights.",
      items: [
        "Daily Encrypted Backups (Cross-region)",
        "GDPR Data Subject Rights Support",
        "24/7 Incident Response Monitoring",
        "Business Continuity Plan (BCDR)",
        "99.99% Uptime Target",
      ],
    },
  ],

  subProcessors: [
    {
      name: "Amazon Web Services",
      service: "Cloud Infrastructure & Storage",
      location: "Luxembourg (EU)",
      logo: "https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg",
    },
    {
      name: "MongoDB",
      service: "Database Hosting",
      location: "Ireland (EU)",
      logo: "https://upload.wikimedia.org/wikipedia/commons/9/93/MongoDB_Logo.svg",
    },
    {
      name: "Google Cloud",
      service: "Maps & Analytics Services",
      location: "Ireland (EU)",
      logo: "https://upload.wikimedia.org/wikipedia/commons/5/51/Google_Cloud_logo.svg",
    },
  ],
};