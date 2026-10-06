import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;

/**
 * The custom API scope, not `openid profile`. Asking only for the OIDC scopes
 * yields a token whose audience is Microsoft Graph, and the backend rejects it
 * with a 401 complaining about `aud`.
 */
export const apiScope = `api://${clientId}/access_as_user`;

export const loginRequest = { scopes: [apiScope] };

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    // A single directory, because Entra here is only an identity provider. The
    // tenant a request acts on is still the X-Tenant-ID header, so /common and
    // the multi-tenant flow would buy nothing.
    authority: `https://login.microsoftonline.com/${tenantId}`,
    // The app's own origin, because this is the redirect flow: Entra sends the
    // browser back here and main.tsx hands the response to MSAL. Must match the
    // registration's spa.redirectUris character for character, trailing slash
    // included, or sign-in fails with AADSTS50011 — which is why vite.config.ts
    // pins the port.
    redirectUri: window.location.origin,
  },
  cache: {
    // sessionStorage, so closing the tab ends the session. localStorage would
    // make the token survive a browser restart, which is worse for a demo.
    cacheLocation: 'sessionStorage',
  },
});

export function activeAccount(): AccountInfo | null {
  return msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null;
}

/**
 * The token side of the seam in `api.ts`. Returns null when nobody is signed in,
 * which lets the API layer send an unauthenticated request and surface the
 * backend's own 401 rather than inventing one here.
 */
export async function acquireApiToken(): Promise<string | null> {
  const account = activeAccount();
  if (!account) return null;

  try {
    const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    return result.accessToken;
  } catch (error) {
    // The refresh token expired or consent was revoked: the only way forward is
    // to ask the user. This navigates away, so the in-flight request is
    // abandoned and null is the honest return — there is no token to give it.
    if (error instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect(loginRequest);
      return null;
    }
    throw error;
  }
}
