import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

const data = {
  heroList: [
    { title: 'Open source, cloud-based system.' },
    { title: 'Enhance your daily workflow.' },
    { title: 'Easy-to-use, time-saving features.' },
    { title: 'Access data anytime, anywhere.' },
  ],
  practiceFeatures: [
    {
      image: MEDIA_SOURCES.homePage.practice1,
      title: 'Appointment',
      title2: 'scheduling',
      description: 'Easily manage bookings, cancellations, and reminders to minimise no-shows.',
    },
    {
      image: MEDIA_SOURCES.homePage.practice2,
      title: 'Documents',
      title2: 'management',
      description:
        'Organize animal data, treatment history, and prescriptions in one secure platform.',
    },
    {
      image: MEDIA_SOURCES.homePage.practice3,
      title: 'Client',
      title2: 'communication',
      description: 'Send automated reminders, updates, and follow-up messages via email or text.',
    },
    {
      image: MEDIA_SOURCES.homePage.practice4,
      title: 'Billing and',
      title2: 'payments',
      description: 'Generate invoices, process payments, and track financials with ease.',
    },
    {
      image: MEDIA_SOURCES.homePage.practice5,
      title: 'Invoicing',
      title2: 'management',
      description:
        'Automate finance with invoicing, quick payments, downpayments, split payments, and refunds.',
    },
    {
      image: MEDIA_SOURCES.homePage.practice6,
      title: 'Pet parent',
      title2: 'App',
      description:
        'Give clients a vet-in-your-pocket with a dedicated app for reminders, medical records, and invoices, all in one.',
    },
    {
      image: MEDIA_SOURCES.homePage.practice7,
      title: 'Report and',
      title2: 'analytics',
      description:
        'Monitor practice performance with detailed insights into appointments, revenue, and client retention.',
    },
    {
      image: MEDIA_SOURCES.homePage.practice8,
      title: 'Inventory',
      title2: 'management',
      description:
        'Keep track of stock levels, place orders, and receive notifications when supplies are low.',
    },
  ],
  focusCards: [
    {
      img: MEDIA_SOURCES.homePage.focus1,
      title: 'API-driven',
      description:
        'Seamlessly integrate with external tools and systems, offering flexible data sharing and connectivity.',
    },
    {
      img: MEDIA_SOURCES.homePage.focus2,
      title: 'Own your software',
      description:
        'With Yosemite Crew’s GPL license, you own the software, SaaS simplicity with open source freedom and no vendor lock-in!',
    },
    {
      img: MEDIA_SOURCES.homePage.focus3,
      title: 'Automated workflows',
      description:
        'Automate invoicing, appointment scheduling, and reminders, freeing up your team to focus on what matters most!',
    },
    {
      img: MEDIA_SOURCES.homePage.focus4,
      title: 'Secure and compliant',
      description:
        'Built with GDPR, SOC2, and ISO 27001 compliance, ensuring the highest standards of security and trust.',
    },
    {
      img: MEDIA_SOURCES.homePage.focus5,
      title: 'Scalable',
      description:
        "Grow with confidence: whether you're a small clinic or a multi-location practice, our software evolves with your needs.",
    },
  ],
};

export default data;
