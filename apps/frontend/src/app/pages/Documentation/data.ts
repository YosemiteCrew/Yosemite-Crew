import {
  fluentLayerSparkle,
  giftOpen,
  lightBulb,
  phoneLockKey,
  roundedStar,
  solarMap,
  solarWidget,
  starBulb,
  userGroup,
} from "@/assets/icons";

export interface InfoCard {
  target: string;
  title: string;
  description: string;
  image: string;
  href: string;
  background: string;
}
export const InfoCards: InfoCard[] = [
  {
    target: "Ideal for pet businesses",
    title: "Streamlined solutions for busy pet businesses",
    description:
      "Yosemite Crew helps veterinary practices optimise their operations, boost efficiency, and provide outstanding care, ensuring that pet parents receive the best services possible, whether on mobile or desktop.",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/landingimg1.png",
    href: "/pms",
    background: "#f5f8fd",
  },
  {
    target: "Perfect for pet parents",
    title: "Designed for pet parents. Simple, intuitive, reliable",
    description:
      "Curated essential tools for your companions, whether they are cats, horses, or dogs in one place. Our app enhances communication with groomers, boarders, sitters, vets, and clinics, streamlining appointments, tasks, medical records, and educational resources for exceptional care.",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/landingimg2.png",
    href: "/application",
    background: "#e9f2fd",
  },
  {
    target: "Flexible and transparent pricing",
    title: "Pay as you grow, no strings attached",
    description:
      "Choose what works for you: host it for free or opt for our pay-as-you-go plan. There are no hidden fees or long-term contracts, and with the Yosemite Crew AGPL V3 license, you own the software!",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/landingimg3.png",
    href: "/pricing",
    background: "#f8fbff",
  },
  {
    target: "Developer-friendly platform",
    title: "Built for innovators",
    description:
      "Yosemite Crew is not just a tool for users; it's a robust platform for developers to build and launch creative solutions like AI scribe, voice calls, and agents. Integrated into pet businesses through our developer marketplace, you can turn your ideas into market-ready products in just hours!",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/landingimg4.png",
    href: "/developers",
    background: "#f5f8fd",
  },
];

export interface Slide {
  id: number;
  image: string;
  alt: string;
  text: string;
}
export const SlidesData: Slide[] = [
  {
    id: 1,
    image: "https://d2il6osz49gpup.cloudfront.net/Images/landingbg1.jpg",
    alt: "Vet 1",
    text: "Empowering veterinary businesses to grow efficiently.",
  },
  {
    id: 2,
    image: "https://d2il6osz49gpup.cloudfront.net/Images/landingbg2.jpg",
    alt: "Vet 2",
    text: "Simplifying pet health management for owners.",
  },
  {
    id: 3,
    image: "https://d2il6osz49gpup.cloudfront.net/Images/landingbg3.jpg",
    alt: "Vet 3",
    text: "Creating opportunities for developers to innovate.",
  },
];

export const featuresList = {
  howYosemiteCrewWorks: [
    {
      title: "Ultimate Convenience",
      description:
        "A user-friendly mobile app enables pet owners to effortlessly schedule appointments, conduct virtual consultations, manage pet health records, and access a wealth of resources.",
      svg: giftOpen,
    },
    {
      title: "Enhanced Accessibility",
      description:
        "Whether in remote locations or facing mobility challenges, pet owners can tap into quality veterinary care anytime, anywhere.",
      svg: lightBulb,
    },
    {
      title: "Streamlined Efficiency",
      description:
        "Yosemite Crew simplifies appointment scheduling and enhances communication, reducing administrative burdens and boosting overall productivity.",
      svg: fluentLayerSparkle,
    },
    {
      title: "Customization & Integration",
      description:
        "As an open-source solution, the platform offers unmatched flexibility, allowing clinics to tailor the system to their unique needs without being locked into rigid subscription models. Seamless integration with existing systems further reduces barriers to adoption.",
      svg: solarWidget,
    },
    {
      title: "Robust Security & Compliance",
      description:
        "With comprehensive data management, reporting capabilities, and adherence to regulatory standards, the system ensures that sensitive information remains secure and that clinics can make informed, data-driven decisions.",
      svg: phoneLockKey,
    },
    {
      title: "Scalability & Support",
      description:
        "Designed to grow alongside veterinary practices, Yosemite Crew is scalable and supported by regular updates and a vibrant community of contributors, ensuring the platform remains state-of-the-art.",
      svg: solarMap,
    },
  ],
  forDevelopers: [
    {
      title: "Empowering Innovation",
      description:
        "The dedicated developer portal is at the heart of an ecosystem that mirrors the versatility of the WordPress plugin model.",
      svg: starBulb,
    },
    {
      title: "Flexible Development Environment",
      description:
        "Equipped with robust public APIs, comprehensive documentation, and ready-to-use MVP templates, developers can quickly create, install, and manage custom plugins that extend the platform's core functionalities.",
      svg: roundedStar,
    },
    {
      title: "Community-Driven Growth",
      description:
        "This open-source approach fosters a collaborative environment where developers can continuously innovate and expand veterinary care options, driving the evolution of animal healthcare technology.",
      svg: userGroup,
    },
  ],
};
