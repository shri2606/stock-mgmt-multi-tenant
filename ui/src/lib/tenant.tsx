import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { TENANT_STORAGE_KEY, setTenantProvider } from './api';

interface TenantContextValue {
  tenant: string;
  setTenant: (tenant: string) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function readStoredTenant(): string {
  try {
    return localStorage.getItem(TENANT_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenantState] = useState<string>(readStoredTenant);

  // Registered during render rather than in an effect, so the very first query
  // already carries the header.
  setTenantProvider(() => tenant || null);

  const setTenant = useCallback((next: string) => {
    const normalised = next.trim().toLowerCase();
    try {
      localStorage.setItem(TENANT_STORAGE_KEY, normalised);
    } catch {
      // private browsing, keep going with in-memory state only
    }
    setTenantState(normalised);
  }, []);

  const value = useMemo(() => ({ tenant, setTenant }), [tenant, setTenant]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const value = useContext(TenantContext);
  if (!value) throw new Error('useTenant must be used inside a TenantProvider');
  return value;
}
