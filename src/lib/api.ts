import Constants from 'expo-constants';

type Extra = {
  apiUrl?: string;
  wsUrl?: string;
  webUrl?: string;
  clerkPublishableKey?: string;
  sentryDsn?: string;
  posthogKey?: string;
  posthogHost?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const apiUrl = extra.apiUrl ?? 'http://localhost:3001';
export const wsUrl = extra.wsUrl ?? 'http://localhost:3001';
export const webUrl = extra.webUrl ?? 'http://localhost:3000';
export const clerkPublishableKey = extra.clerkPublishableKey ?? '';
export const sentryDsn = extra.sentryDsn ?? '';
export const posthogKey = extra.posthogKey ?? '';
export const posthogHost = extra.posthogHost ?? 'https://eu.i.posthog.com';
