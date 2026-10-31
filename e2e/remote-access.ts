import type {APIRequestContext, APIResponse, BrowserContext, Route} from '@playwright/test';
import {resolveE2ETarget} from './target.ts';

const oidcHeader = 'x-vercel-trusted-oidc-idp-token';
type RequestOptions = NonNullable<Parameters<APIRequestContext['fetch']>[1]>;
type FailureCode = 'REMOTE_ACCESS_CONFIGURATION' | 'REMOTE_ORIGIN_REFUSED' | 'REMOTE_REDIRECT_REFUSED'
  | 'REMOTE_TRANSPORT_FAILURE' | 'REMOTE_INVALID_JSON' | 'REMOTE_APPLICATION_LOGIN_FAILED';

/** Never preserve a driver error/cause: Playwright call logs can contain headers and POST bodies. */
export class RemoteAccessError extends Error {
  constructor(code: FailureCode) {super(`Remote browser access failed (${code}).`); this.name = 'RemoteAccessError';}
}
const normalized = (error: unknown) => error instanceof RemoteAccessError ? error : new RemoteAccessError('REMOTE_TRANSPORT_FAILURE');
const contextFailures = new WeakMap<BrowserContext, RemoteAccessError>();
const configuredContexts = new WeakSet<BrowserContext>();
const closingContexts = new WeakSet<BrowserContext>();
const withoutOidc = (headers: Record<string, string>) => Object.fromEntries(
  Object.entries(headers).filter(([name]) => name.toLowerCase() !== oidcHeader),
);

/**
 * Internal transport seam for loopback tests with a synthetic token. Runtime callers below
 * obtain their origin exclusively from resolveE2ETarget(), which permits only stable staging.
 * No token is installed in browser extraHTTPHeaders, storage, URLs or page JavaScript.
 */
export function createOriginTransport(origin: string, token: string) {
  let address: URL;
  try {address = new URL(origin);} catch {throw new RemoteAccessError('REMOTE_ACCESS_CONFIGURATION');}
  if (address.origin !== origin || !['https:', 'http:'].includes(address.protocol)
    || !token || token.length > 32_768 || /[\r\n\s]/.test(token)) throw new RemoteAccessError('REMOTE_ACCESS_CONFIGURATION');
  const headersFor = (headers: Record<string, string> = {}) => ({...withoutOidc(headers), [oidcHeader]: token});
  const requireOrigin = (value: string) => {
    let url: URL;
    try {url = new URL(value);} catch {throw new RemoteAccessError('REMOTE_ORIGIN_REFUSED');}
    if (url.origin !== origin || url.username || url.password) throw new RemoteAccessError('REMOTE_ORIGIN_REFUSED');
  };
  const checked = async (operation: () => Promise<APIResponse>): Promise<APIResponse> => {
    try {
      const response = await operation();
      if (response.status() >= 300 && response.status() < 400) {
        await response.dispose().catch(() => undefined);
        throw new RemoteAccessError('REMOTE_REDIRECT_REFUSED');
      }
      return response;
    } catch (error) {throw normalized(error);}
  };
  const fetchApi = async (request: APIRequestContext, url: string, options: RequestOptions = {}) => {
    requireOrigin(url);
    return checked(() => request.fetch(url, {...options, headers: headersFor(options.headers),
      maxRedirects: 0, maxRetries: 0, ignoreHTTPSErrors: false}));
  };
  const fetchRoute = async (route: Route) => {
    requireOrigin(route.request().url());
    try {
      return await checked(() => route.fetch({headers: headersFor(route.request().headers()), maxRedirects: 0, maxRetries: 0}));
    } catch (error) {throw normalized(error);}
  };
  const install = async (context: BrowserContext) => {
    if (configuredContexts.has(context)) return;
    await context.route('**/*', async route => {
      let response: APIResponse | undefined;
      try {
        if (new URL(route.request().url()).origin !== origin) {
          // Foreign resources remain ordinary browser requests, without the platform credential.
          await route.continue({headers: withoutOidc(route.request().headers())});
          return;
        }
        response = await fetchRoute(route);
        await route.fulfill({response});
      } catch (error) {
        if (!closingContexts.has(context) && !contextFailures.has(context)) contextFailures.set(context, normalized(error));
        await route.abort('failed').catch(() => undefined);
      } finally {await response?.dispose().catch(() => undefined);}
    });
    configuredContexts.add(context);
  };
  return {fetchApi, fetchRoute, install};
}

export const isRemoteExecution = () => resolveE2ETarget().mode === 'remote';
function configuredTransport() {
  const target = resolveE2ETarget();
  return target.mode === 'remote' ? createOriginTransport(target.origin, process.env.VERCEL_OIDC_TOKEN ?? '') : null;
}

export async function fetchApiWithAccess(request: APIRequestContext, url: string, options: RequestOptions = {}): Promise<APIResponse> {
  const transport = configuredTransport();
  return transport ? transport.fetchApi(request, url, options) : request.fetch(url, options);
}
export async function fetchRouteWithAccess(route: Route): Promise<APIResponse> {
  const transport = configuredTransport();
  return transport ? transport.fetchRoute(route) : route.fetch();
}
export async function continueRouteWithAccess(route: Route): Promise<void> {
  // Page fault-injection routes take precedence over context routes. Fallback is necessary
  // so unrelated API calls still pass through the context's authorized remote transport.
  if (isRemoteExecution()) await route.fallback();
  else await route.continue();
}
export async function installContextAccess(context: BrowserContext): Promise<void> {
  await configuredTransport()?.install(context);
}
export function assertContextAccess(context: BrowserContext): void {
  const failure = contextFailures.get(context);
  if (failure) throw failure;
}
export async function closeContextWithAccess(context: BrowserContext): Promise<void> {
  const failure = contextFailures.get(context);
  // Closing a context intentionally aborts its remaining resource requests. Preserve failures
  // already observed, but do not mislabel those cleanup aborts as failures of the remote service.
  closingContexts.add(context);
  try {await context.close();}
  catch (error) {if (isRemoteExecution()) throw failure ?? normalized(error); throw error;}
  if (failure) throw failure;
}
export async function readApiJson(response: APIResponse): Promise<any> {
  try {return await response.json();}
  catch (error) {if (isRemoteExecution()) throw new RemoteAccessError('REMOTE_INVALID_JSON'); throw error;}
}
