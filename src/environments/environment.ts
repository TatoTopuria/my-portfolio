import { Environment } from '../app/core/tokens/environment.token';

function getFirstEnvValue(keys: readonly string[]): string {
  const importMetaEnv = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> })
    .env ?? {}) as Record<string, string | undefined>;
  const processEnv =
    (typeof process !== 'undefined'
      ? (process.env as Record<string, string | undefined> | undefined)
      : undefined) ?? {};

  for (const key of keys) {
    const value = importMetaEnv[key] ?? processEnv[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return '';
}

export const environment: Environment = {
  production: false,
  githubApiUrl: 'https://api.github.com',
  githubUsername: 'tatotopuria',
  emailjsServiceId: getFirstEnvValue([
    'EMAILJS_SERVICE_ID',
    'VITE_EMAILJS_SERVICE_ID',
    'NG_APP_EMAILJS_SERVICE_ID',
  ]),
  emailjsTemplateId: getFirstEnvValue([
    'EMAILJS_TEMPLATE_ID',
    'VITE_EMAILJS_TEMPLATE_ID',
    'NG_APP_EMAILJS_TEMPLATE_ID',
  ]),
  emailjsPublicKey: getFirstEnvValue([
    'EMAILJS_PUBLIC_KEY',
    'VITE_EMAILJS_PUBLIC_KEY',
    'NG_APP_EMAILJS_PUBLIC_KEY',
  ]),
};
