import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header';
import { FooterComponent } from './layout/footer/footer';
import { SkipLinkComponent } from './layout/skip-link/skip-link';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, SkipLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-skip-link />
    <app-header />
    <router-outlet />
    <app-footer />
  `,
})
export class App {}
