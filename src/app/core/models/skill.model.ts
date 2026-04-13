export type SkillCategory = 'Frontend' | 'Backend' | 'Testing' | 'DevOps' | 'Tools';

export interface Skill {
  name: string;
  category: SkillCategory;
  proficiency: number; // 0–100
  iconUrl?: string;
}
