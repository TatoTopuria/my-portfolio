import { Environment } from '../app/core/tokens/environment.token';

interface RuntimeEnv {
  readonly EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly NG_APP_EMAILJS_SERVICE_ID?: string;
  readonly EMAILJS_TEMPLATE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID?: string;
  readonly NG_APP_EMAILJS_TEMPLATE_ID?: string;
  readonly EMAILJS_PUBLIC_KEY?: string;
  readonly VITE_EMAILJS_PUBLIC_KEY?: string;
  readonly NG_APP_EMAILJS_PUBLIC_KEY?: string;
}

function getFirstEnvValue(...values: (string | undefined)[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

const importMetaEnv = (import.meta as ImportMeta & { env?: RuntimeEnv }).env;
const processEnv =
  typeof process !== 'undefined' ? (process.env as RuntimeEnv | undefined) : undefined;

export const environment: Environment = {
  production: true,
  githubApiUrl: 'https://api.github.com',
  githubUsername: 'tatotopuria',
  emailjsServiceId: getFirstEnvValue(
    importMetaEnv?.NG_APP_EMAILJS_SERVICE_ID,
    importMetaEnv?.VITE_EMAILJS_SERVICE_ID,
    importMetaEnv?.EMAILJS_SERVICE_ID,
    processEnv?.NG_APP_EMAILJS_SERVICE_ID,
    processEnv?.VITE_EMAILJS_SERVICE_ID,
    processEnv?.EMAILJS_SERVICE_ID,
  ),
  emailjsTemplateId: getFirstEnvValue(
    importMetaEnv?.NG_APP_EMAILJS_TEMPLATE_ID,
    importMetaEnv?.VITE_EMAILJS_TEMPLATE_ID,
    importMetaEnv?.EMAILJS_TEMPLATE_ID,
    processEnv?.NG_APP_EMAILJS_TEMPLATE_ID,
    processEnv?.VITE_EMAILJS_TEMPLATE_ID,
    processEnv?.EMAILJS_TEMPLATE_ID,
  ),
  emailjsPublicKey: getFirstEnvValue(
    importMetaEnv?.NG_APP_EMAILJS_PUBLIC_KEY,
    importMetaEnv?.VITE_EMAILJS_PUBLIC_KEY,
    importMetaEnv?.EMAILJS_PUBLIC_KEY,
    processEnv?.NG_APP_EMAILJS_PUBLIC_KEY,
    processEnv?.VITE_EMAILJS_PUBLIC_KEY,
    processEnv?.EMAILJS_PUBLIC_KEY,
  ),
};
