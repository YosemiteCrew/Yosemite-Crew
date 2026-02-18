import { GuideVideo } from "@/app/features/guides/types/guides";

export const guidesData: GuideVideo[] = [
  {
    id: "invite-team",
    title: "Invite your team",
    description: "Add staff members, assign roles, and keep everyone aligned in minutes.",
    duration: "2:45",
    category: "Getting started",
    tags: ["team", "roles", "access"],
    videoUrl: "https://d2il6osz49gpup.cloudfront.net/videos/addTeam.mp4",
    thumbnailUrl: "https://d2il6osz49gpup.cloudfront.net/guideImages/1.png",
    featured: true,
  },
  {
    id: "add-companion",
    title: "Add companions",
    description: "Create companion profiles and attach key details for better care.",
    duration: "3:10",
    category: "Companions",
    tags: ["companions", "profiles", "pets"],
    videoUrl: "https://d2il6osz49gpup.cloudfront.net/videos/addCompanion.mp4",
    thumbnailUrl: "https://d2il6osz49gpup.cloudfront.net/guideImages/2.png",
  },
  {
    id: "forms-module",
    title: "Build and share forms",
    description: "Create reusable forms, link them to services, and collect signatures.",
    duration: "4:05",
    category: "Forms",
    tags: ["forms", "templates", "signatures"],
    videoUrl: "https://d2il6osz49gpup.cloudfront.net/videos/formModule.mp4",
    thumbnailUrl: "https://d2il6osz49gpup.cloudfront.net/guideImages/3.png",
  },
];
