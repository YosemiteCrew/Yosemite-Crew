import { Status, TasksProps } from "@/app/types/tasks";

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

export function generateTasks(
  count: number,
  forDate: string = "2025-11-06"
): TasksProps[] {
  const result: TasksProps[] = [];

  const tasks = [
    "Follow up with new client",
    "Update vaccination records",
    "Prepare monthly billing report",
    "Check medication stock",
    "Design promotional banner",
    "Call pet parent for feedback",
    "Schedule wellness checkup",
  ];

  const descriptions = [
    "Send onboarding documents and schedule first meeting.",
    "Verify and upload updated vaccine certificates.",
    "Generate and review invoices for the month.",
    "Ensure all essential medicines are adequately stocked.",
    "Create social media banner for the new campaign.",
    "Gather client feedback for service improvement.",
    "Coordinate timing and confirm appointment details.",
  ];

  const categories = [
    "Client Relations",
    "Records Management",
    "Finance",
    "Inventory",
    "Marketing",
    "Operations",
  ];

  const fromList = [
    "John Carter",
    "Emily Davis",
    "Michael Brown",
    "Anna Lee",
    "Rachel Green",
  ];

  const toList = [
    "Evergreen Veterinary Clinic",
    "Sarah Wilson",
    "Happy Tails Clinic",
    "Dr. Roberts",
    "Healthy Paws Veterinary",
  ];

  const toLabelList = ["Organisations", "Companions"];

  const statuses: Status[] = ["Upcoming", "In-progress", "Completed"];

  for (let i = 0; i < count; i++) {
    const task = randomFrom(tasks);
    const description = randomFrom(descriptions);
    const category = randomFrom(categories);
    const from = randomFrom(fromList);
    const to = randomFrom(toList);
    const toLabel = randomFrom(toLabelList);
    const status = randomFrom(statuses);

    // OPTIONAL: randomize due date around the given date
    const offset = Math.floor(secureRandom() * 7) - 3; // -3 to +3 days
    const dueDate = new Date(forDate);
    dueDate.setDate(dueDate.getDate() + offset);

    result.push({
      task,
      description,
      category,
      from,
      to,
      toLabel,
      due: dueDate,
      status,
    });
  }

  return result;
}

export const demoTasks: TasksProps[] = generateTasks(20, "2025-12-04");
