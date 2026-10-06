import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MsalProvider } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import type { AuthenticationResult } from '@azure/msal-browser';
import { App } from './App';
import { TenantProvider } from './lib/tenant';
import { ToastProvider } from './components/Toast';
import { acquireApiToken, msalInstance } from './lib/auth';
import { setTokenProvider } from './lib/api';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

// MSAL must be initialised before any other call on the instance, and the API
// layer needs its token provider before the first query runs. Both happen here,
// above the render, so no component has to care about the ordering.
await msalInstance.initialize();

// This is the redirect flow, so every page load may be the one carrying Entra's
// response. handleRedirectPromise consumes it and resolves to null on an ordinary
// load. It must run before the first render, or the response is still in the URL
// when components start asking for tokens.
const redirectResult = await msalInstance.handleRedirectPromise();
if (redirectResult?.account) {
  msalInstance.setActiveAccount(redirectResult.account);
} else {
  const existing = msalInstance.getAllAccounts();
  if (existing.length > 0) {
    msalInstance.setActiveAccount(existing[0]);
  }
}

// acquireTokenSilent needs an active account, and a fresh login does not set one.
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
    msalInstance.setActiveAccount((event.payload as AuthenticationResult).account);
  }
});

setTokenProvider(acquireApiToken);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <TenantProvider>
          <ToastProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </TenantProvider>
      </QueryClientProvider>
    </MsalProvider>
  </StrictMode>,
);
