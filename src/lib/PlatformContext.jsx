import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * PlatformContext — persists the user's top-level platform choice
 * ("schools" | "organisations") so the onboarding flow, terminology, and
 * dashboards can adapt. The choice is stored in localStorage so it survives
 * reloads before the user is authenticated.
 *
 * For authenticated users, the platform is derived from their organisation's
 * org_type (see platformForOrgType in platformConfig.js), which takes
 * precedence over the localStorage value.
 */

const PlatformContext = createContext(null);
const STORAGE_KEY = 'blockward_platform';

export function PlatformProvider({ children }) {
  const [platform, setPlatform] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const selectPlatform = useCallback((id) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    setPlatform(id);
  }, []);

  const clearPlatform = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setPlatform(null);
  }, []);

  return (
    <PlatformContext.Provider value={{ platform, selectPlatform, clearPlatform }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    // Graceful fallback when used outside the provider
    return { platform: null, selectPlatform: () => {}, clearPlatform: () => {} };
  }
  return ctx;
}