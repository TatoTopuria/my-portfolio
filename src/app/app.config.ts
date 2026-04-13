import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { ENVIRONMENT, Environment } from './core/tokens/environment.token';
import { environment } from '../environments/environment';

type RuntimeEnvironmentOverrides = Partial<
  Pick<Environment, 'emailjsServiceId' | 'emailjsTemplateId' | 'emailjsPublicKey'>
>;

const runtimeEnvironment: Environment = { ...environment };

async function loadRuntimeEnvironment(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const response = await fetch('/runtime-config.json', { cache: 'no-store' });

    if (!response.ok) {
      return;
    }

    const runtimeConfig = (await response.json()) as RuntimeEnvironmentOverrides;

    if (typeof runtimeConfig.emailjsServiceId === 'string') {
      runtimeEnvironment.emailjsServiceId = runtimeConfig.emailjsServiceId.trim();
    }

    if (typeof runtimeConfig.emailjsTemplateId === 'string') {
      runtimeEnvironment.emailjsTemplateId = runtimeConfig.emailjsTemplateId.trim();
    }

    if (typeof runtimeConfig.emailjsPublicKey === 'string') {
      runtimeEnvironment.emailjsPublicKey = runtimeConfig.emailjsPublicKey.trim();
    }
  } catch {
    // Ignore runtime config fetch failures and fall back to build-time environment values.
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(loadRuntimeEnvironment),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withViewTransitions(),
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([httpErrorInterceptor]), withFetch()),
    provideAnimationsAsync(),
    provideClientHydration(withEventReplay()),
    { provide: ENVIRONMENT, useValue: runtimeEnvironment },
  ],
};
