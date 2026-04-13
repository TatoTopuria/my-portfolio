export interface Article {
  id: string;
  title: string;
  summary: string;
  url: string;
  platform: string;
  publishedDate: string;
  tags: string[];
  coverImageUrl?: string;
  readTimeMinutes?: number;
}
