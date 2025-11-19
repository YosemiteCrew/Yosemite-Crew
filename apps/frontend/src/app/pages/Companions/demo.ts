import { CompanionProps } from "@/app/pages/Companions/types";

const secureRandom = (): number => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random(); // NOSONAR
};

const randomItem = <T>(arr: T[]): T =>
  arr[Math.floor(secureRandom() * arr.length)];

export function generatePet(): CompanionProps {
  const names = [
    "Buddy",
    "Misty",
    "Rocky",
    "Coco",
    "Kiwi",
    "Luna",
    "Simba",
    "Bella",
    "Shadow",
    "Oreo",
  ];
  const breeds = [
    "Golden Retriever",
    "Siamese",
    "German Shepherd",
    "Mini Lop",
    "Cockatiel",
    "Beagle",
    "Persian Cat",
    "Bulldog",
    "Husky",
    "Parrot",
  ];
  const species = ["Dog", "Cat", "Rabbit", "Bird"];
  const genders = ["Male", "Female"];
  const statuses = ["active", "inactive", "archived"];
  const colors = ["Brown", "Black", "White", "Golden", "Grey", "Spotted"];
  const petCameFrom = ["breeder", "shop", "unknown"];
  const countries = ["India", "USA", "Germany", "Thailand", "Australia"];
  const insurancePolicies = [
    "Standard",
    "Premium",
    "Basic Care",
    "Full Coverage",
  ];

  const parentNames = [
    "Aarav Mehta",
    "Ishita Roy",
    "Rohan Patel",
    "Sneha Verma",
    "Vikram Singh",
    "Ananya Gupta",
  ];

  const parent = randomItem(parentNames);
  const coParentName = randomItem(parentNames);

  return {
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    name: randomItem(names),
    breed: randomItem(breeds),
    species: randomItem(species),
    parent,
    gender: randomItem(genders),
    age: `${Math.floor(secureRandom() * 10) + 1} years`,
    lastMedication: "Paractamol",
    vaccineDue: "20 Dec 2025",
    upcomingAppointent: "20 Dec 2025",
    upcomingAppointentTime: "12:00 PM",
    status: randomItem(statuses),

    // New fields
    dateOfBirth: `20${10 + Math.floor(secureRandom() * 14)}-${String(Math.floor(secureRandom() * 12) + 1).padStart(2, "0")}-${String(Math.floor(secureRandom() * 28) + 1).padStart(2, "0")}`,
    weight: `${(secureRandom() * 30 + 1).toFixed(1)} kg`,
    color: randomItem(colors),
    neuteredStatus: randomItem(["yes", "no"]),
    ageWhenNeutered: "1 year",
    bloodGroup: randomItem(["DEA 1.1", "DEA 1.2", "A", "B", "AB", "N/A"]),
    countryOfOrigin: randomItem(countries),
    petCameFrom: randomItem(petCameFrom),
    microchipNumber: `MC-${Math.floor(secureRandom() * 90000000 + 10000000)}`,
    passportNumber: `PET-${Math.floor(secureRandom() * 90000 + 10000)}`,
    insurancePolicy: randomItem(insurancePolicies),
    insuranceNumber: `INS-${Math.floor(secureRandom() * 900000 + 100000)}`,

    parentNumber:
      "+91 " + (Math.floor(secureRandom() * 9000000000) + 1000000000),
    parentEmail: `${parent.toLowerCase().split(" ").join(".")}@example.com`,
    coParentName,
    coParentEmail: `${coParentName.toLowerCase().split(" ").join(".")}@example.com`,
    coParentNumber:
      "+91 " + (Math.floor(secureRandom() * 9000000000) + 1000000000),
  };
}
export function generatePets(count: number): CompanionProps[] {
  return Array.from({ length: count }, () => generatePet());
}
export const demoData = generatePets(20);
