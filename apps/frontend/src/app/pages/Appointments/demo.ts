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

const randomFrom = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const randomBool = (chance = 0.2) => Math.random() < chance;

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
    const startHour = 7 + Math.floor(Math.random() * 11); // 7–17
    const startMinute = Math.floor(Math.random() * 12) * 5; // nearest 5 min
    const start = new Date(
      `${forDate}T${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}:00`
    );
    const duration = 20 + Math.floor(Math.random() * 30);
    const end = new Date(start.getTime() + duration * 60_000);
    const time = formatTime(start);
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


export const demoAppointments = generateAppointments(30, "2025-12-01");