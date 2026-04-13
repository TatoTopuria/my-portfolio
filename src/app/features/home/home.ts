import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { HeroComponent } from '../hero/hero';
import { AboutComponent } from '../about/about';
import { SkillsComponent } from '../skills/skills';
import { ProjectsComponent } from '../projects/projects';
import { ExperienceComponent } from '../experience/experience';
import { SoftwareEngineeringComponent } from '../software-engineering/software-engineering';
import { TestAutomationComponent } from '../test-automation/test-automation';
import { GithubActivityComponent } from '../github-activity/github-activity';
import { CertificationsComponent } from '../certifications/certifications';
import { ContactComponent } from '../contact/contact';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    HeroComponent,
    AboutComponent,
    SkillsComponent,
    ProjectsComponent,
    ExperienceComponent,
    SoftwareEngineeringComponent,
    TestAutomationComponent,
    GithubActivityComponent,
    CertificationsComponent,
    ContactComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="main-content">
      <!-- Hero: rendered immediately (above fold) -->
      <app-hero />

      <app-about />
      <app-skills />
      <app-projects />
      <app-experience />
      <app-software-engineering />
      <app-test-automation />
      <app-github-activity />
      <app-certifications />
      <app-contact />
    </main>
  `,
})
export class HomeComponent implements OnInit {
  private readonly seoService = inject(SeoService);

  ngOnInit(): void {
    this.seoService.updateSeo({
      title: '',
      description:
        'Software Engineer and SDET delivering .NET/C#, Spring/Java, Node.js, Angular, React, and Next.js solutions with strong test automation and CI/CD practices.',
      url: '/',
    });
  }
}
