import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly siteName = 'Tato Topuria — Software Engineer & SDET';

  updateSeo(data: SeoData): void {
    const fullTitle = data.title ? `${data.title} | ${this.siteName}` : this.siteName;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: data.description });

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    if (data.image) {
      this.meta.updateTag({ property: 'og:image', content: data.image });
    }
    if (data.url) {
      this.meta.updateTag({ property: 'og:url', content: data.url });
    }
    this.meta.updateTag({ property: 'og:type', content: 'website' });

    // Twitter Card
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: data.description });
    if (data.image) {
      this.meta.updateTag({ name: 'twitter:image', content: data.image });
    }
  }
}
