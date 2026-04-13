import { InjectionToken } from '@angular/core';

export interface Environment {
  production: boolean;
  githubApiUrl: string;
  githubUsername: string;
  emailjsServiceId: string;
  emailjsTemplateId: string;
  emailjsPublicKey: string;
}

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
