import { AppointmentsProps, Status } from "@/app/types/appointments";

const petNames = [
  "Bella",
  "Max",
  "Luna",
  "Charlie",
  "Milo",
  "Coco",
  "Rocky",
  "Shadow",
  "Nala",
  "Simba",
  "Oreo",
  "Pumpkin",
  "Zeus",
  "Whiskers",
  "Bruno",
  "Ginger",
];

const parentNames = [
  "Sarah Johnson",
  "John Smith",
  "Priya Mehta",
  "David Lee",
  "Elena Garcia",
  "Kimberly Evans",
  "Olivia Carter",
  "Marcus Hill",
  "Sophia Torres",
  "Hannah Wright",
  "Daniel Foster",
  "Megan Brooks",
  "Rohit Khanna",
  "Alex Martinez",
  "Laura Mitchell",
];

const speciesList = ["Dog", "Cat"];
const dogBreeds = [
  "Golden Retriever",
  "Beagle",
  "Bulldog",
  "Poodle",
  "Labrador",
  "German Shepherd",
  "Husky",
  "Boxer",
  "Pitbull",
  "Cocker Spaniel",
];
const catBreeds = ["Persian", "Maine Coon", "Ragdoll", "Domestic Shorthair"];

const reasons = [
  "Annual vaccination",
  "Dental cleaning",
  "Regular checkup",
  "Skin rash",
  "Vomiting",
  "Eye redness",
  "Follow-up after surgery",
  "Limping",
  "Ear mite treatment",
  "Wellness exam",
];

const services = [
  "General Consult",
  "Emergency Consult",
  "Dermatology",
  "Dentistry",
  "Orthopedics",
  "Internal Medicine",
  "Surgery",
];

const rooms = [
  "Room 1A",
  "Room 1B",
  "Room 2A",
  "Room 2B",
  "Room 3A",
  "Room 3C",
  "Room 3D",
  "Room 4A",
  "Room 4C",
  "Room 5A",
  "Room 6C",
  "Room 7B",
  "Room 8A",
  "Emergency Bay 1",
  "Emergency Bay 2",
];

const vets = [
  { name: "Dr. Emily Carter", dept: "Veterinary Medicine" },
  { name: "Dr. Mark Daniels", dept: "Orthopedics" },
  { name: "Dr. Rebecca Lin", dept: "Dentistry" },
  { name: "Dr. Michael Brown", dept: "General Care" },
  { name: "Dr. Jason Patel", dept: "Dermatology" },
  { name: "Dr. Laura Benson", dept: "Internal Medicine" },
  { name: "Dr. Andrew Miller", dept: "Surgery" },
];

const supportStaff = ["Nurse Rachel", "Assistant Tom", "Assistant Maya"];

const statuses: Status[] = [
  "Requested",
  "Upcoming",
  "Checked-in",
  "In-progress",
  "Completed",
];

const secureRandom = (): number => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random(); // NOSONAR
};

const randomFrom = <T>(arr: T[]) =>
  arr[Math.floor(secureRandom() * arr.length)];

const randomBool = (chance = 0.2) => secureRandom() < chance;

// Random date in "YYYY-MM-DD" format (fixed day or random)
const formatDate = (date: Date) => date.toISOString().split("T")[0];

// Format time into "hh:mm AM/PM"
const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

export function generateAppointments(
  count: number,
  forDate: string = "2025-11-06"
): AppointmentsProps[] {
  const result: AppointmentsProps[] = [];

  for (let i = 0; i < count; i++) {
    // PICK VALUES
    const name = randomFrom(petNames);
    const parentName = randomFrom(parentNames);
    const species = randomFrom(speciesList);
    const breed =
      species === "Dog" ? randomFrom(dogBreeds) : randomFrom(catBreeds);
    const reason = randomFrom(reasons);
    const emergency = randomBool(0.15); // 15% emergency
    const service = randomFrom(services);
    const room = randomFrom(rooms);
    const vet = randomFrom(vets);
    const status = randomFrom(statuses);

    // Decide if this is an all-day event (about 10–15%)
    const isAllDay = randomBool(0.1);

    let start: Date;
    let end: Date;
    let time: string;

    if (isAllDay) {
      // ---- All-day event for this specific date ----
      start = new Date(`${forDate}T00:00:00.000`);
      end = new Date(`${forDate}T23:59:59.999`);
      // Nice label for list/table views; day/week all-day UI won’t use this anyway
      time = "All day";
    } else {
      // ---- Normal timed event within the same day ----
      const startHour = Math.floor(secureRandom() * 24); // 0–23
      const startMinute = Math.floor(secureRandom() * 12) * 5; // nearest 5 min

      start = new Date(
        `${forDate}T${String(startHour).padStart(2, "0")}:${String(
          startMinute
        ).padStart(2, "0")}:00`
      );

      // --- Duration & clamping to same day ---
      const startTotalMinutes = startHour * 60 + startMinute;
      const minDuration = 20;
      const maxDuration = 50;
      const maxSameDayMinutes = 24 * 60 - 5 - startTotalMinutes; // ensure we don't go past 23:55

      let duration =
        minDuration +
        Math.floor(secureRandom() * (maxDuration - minDuration + 1));

      if (duration > maxSameDayMinutes) {
        duration = Math.max(5, maxSameDayMinutes); // at least 5 mins if near end of day
      }

      end = new Date(start.getTime() + duration * 60_000);
      time = formatTime(start);
    }

    result.push({
      name,
      parentName,
      image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
      reason,
      emergency,
      service,
      room,
      time,
      date: forDate,
      lead: vet.name,
      leadDepartment: vet.dept,
      support: [randomFrom(supportStaff), randomFrom(supportStaff)],
      status,
      breed,
      species,
      start,
      end,
    });
  }

  return result;
}

export const demoAppointments = [
  ...generateAppointments(20, "2025-12-08"),
  ...generateAppointments(20, "2025-12-09"),
  ...generateAppointments(20, "2025-12-10"),
  ...generateAppointments(20, "2025-12-11"),
  ...generateAppointments(20, "2025-12-12"),
  ...generateAppointments(20, "2025-12-13"),
  ...generateAppointments(20, "2025-12-14"),
];

export type CompanionDataProps = {
  id: string;
  companion: string;
  specie: string;
  breed: string;
  parent: string;
};

export const CompanionData: CompanionDataProps[] = [
  {
    id: "0",
    companion: "Milo",
    specie: "Feline",
    parent: "Arun Patel",
    breed: "Siamese",
  },
  {
    id: "1",
    companion: "Nova",
    specie: "Canine",
    parent: "Rachel Gomez",
    breed: "Golden Retriever",
  },
  {
    id: "2",
    companion: "Koda",
    specie: "Canine",
    parent: "Marcus Hill",
    breed: "Husky",
  },
  {
    id: "3",
    companion: "Willow",
    specie: "Feline",
    parent: "Charlotte Nguyen",
    breed: "Maine Coon",
  },
  {
    id: "4",
    companion: "Pip",
    specie: "Avian",
    parent: "Julia Rivera",
    breed: "Cockatiel",
  },
  {
    id: "5",
    companion: "Biscuit",
    specie: "Canine",
    parent: "Tomás Alvarez",
    breed: "Beagle",
  },
  {
    id: "6",
    companion: "Maple",
    specie: "Feline",
    parent: "Sara Williams",
    breed: "British Shorthair",
  },
  {
    id: "7",
    companion: "Rocco",
    specie: "Reptile",
    parent: "Daniel Kim",
    breed: "Leopard Gecko",
  },
  {
    id: "8",
    companion: "Zuri",
    specie: "Canine",
    parent: "Amelia Brooks",
    breed: "Shiba Inu",
  },
  {
    id: "9",
    companion: "Pebble",
    specie: "Rodent",
    parent: "Jenna Wright",
    breed: "Guinea Pig",
  },
];

const convertCompanionData = (data: CompanionDataProps[]) => {
  return data.map((item) => ({
    key: item.id,
    value: `${item.companion}-${item.parent}`,
  }));
};

export const CompanionDataOptions = convertCompanionData(CompanionData);
