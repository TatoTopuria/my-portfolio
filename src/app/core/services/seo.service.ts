import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description: string;
  image?: string;
  url?: string;
  noIndex?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  readonly siteName = 'Tato Topuria — Software Engineer & SDET';
  readonly baseUrl = 'https://tatotopuria.vercel.app';

  updateSeo(data: SeoData): void {
    const fullTitle = data.title ? `${data.title} | ${this.siteName}` : this.siteName;
    const canonicalUrl = data.url ? `${this.baseUrl}${data.url}` : this.baseUrl;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: data.description });
    this.meta.updateTag({
      name: 'robots',
      content: data.noIndex ? 'noindex, nofollow' : 'index, follow',
    });

    // Canonical
    this.setCanonicalUrl(canonicalUrl);

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteName });
    this.meta.updateTag({ property: 'og:locale', content: 'en_US' });
    this.meta.updateTag({
      property: 'og:image',
      content: data.image ?? `${this.baseUrl}/images/my-portfolio.png`,
    });
    this.meta.updateTag({ property: 'og:type', content: 'website' });

    // Twitter Card
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: data.description });
    this.meta.updateTag({
      name: 'twitter:image',
      content: data.image ?? `${this.baseUrl}/images/my-portfolio.png`,
    });
  }

  private setCanonicalUrl(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
