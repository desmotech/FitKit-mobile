/**
 * MSW server for tests — the network boundary. Handlers are registered
 * per-test with `server.use(...)`; anything unhandled fails the test so a
 * screen can never silently fetch something a test didn't stage.
 *
 * `api(path)` prefixes the same base URL the app's fetchWithAuth resolves
 * (src/lib/api.ts), so handlers match exactly what production code requests.
 */
// `msw/native` (not `msw/node`): React Native's jest environment resolves
// package exports with the 'react-native' condition, and the native entry's
// fetch/XHR interceptors are what the app's global-fetch calls go through.
import { setupServer } from 'msw/native';
import { apiUrl } from '@/lib/api';

export const server = setupServer();

export function api(path: string): string {
  return `${apiUrl}${path}`;
}

export { http, HttpResponse, delay } from 'msw';
