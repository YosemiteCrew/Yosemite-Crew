export type GuideVideo = {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  tags: string[];
  videoUrl: string;
  thumbnailUrl: string;
  featured?: boolean;
};
