export interface Project {
  slug: string;
  title: string;
  description: string;
  longDescription?: string;
  image?: string;
  techStack: string[];
  githubUrl?: string;
  demoUrl?: string;
  featured: boolean;
  category: 'web' | 'automation' | 'tool' | 'other';
  year: number;
}
