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
