import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import { buildThemeVars, generateFavicon, setFavicon } from '../lib/branding.js';

const BrandingContext = createContext(null);

// Cache the last-fetched branding so the header/theme render instantly on
// refresh instead of flashing blank while `/v1/branding` is in flight. The fetch
// still runs on every mount and overwrites this with the latest values.
const BRANDING_CACHE_KEY = 'plato_branding_v1';

function readCachedBranding() {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCachedBranding(data) {
  try { localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(data)); } catch { /* quota / private mode */ }
}

const EMPTY_BRANDING = { theme: null, logoBase64: null, classroomName: '' };

/**
 * Provides classroom branding to learner-facing UI.
 * The plato dashboard is never affected.
 */
export function BrandingProvider({ children }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Seed from the cached branding so the branded shell (header color, name,
  // logo) paints immediately on refresh — no blank flash. `loaded` is true when
  // we have cached values to show; the fetch below refreshes them.
  const [branding, setBranding] = useState(() => {
    const cached = readCachedBranding();
    return cached
      ? { ...EMPTY_BRANDING, ...cached, loaded: true }
      : { ...EMPTY_BRANDING, loaded: false };
  });

  useEffect(() => {
    fetch('/v1/branding')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          writeCachedBranding(data);
          setBranding({ ...data, loaded: true });
        } else {
          setBranding(prev => ({ ...prev, loaded: true }));
        }
      })
      .catch(() => setBranding(prev => ({ ...prev, loaded: true })));
  }, []);

  // Generate and set favicon — only when classroom has a logo image; otherwise use plato default
  useEffect(() => {
    if (!branding.logoBase64 || !branding.theme?.primary || isAdmin) return;
    let cancelled = false;
    let restoreFn;
    generateFavicon(branding.logoBase64, branding.theme.primary).then(dataUrl => {
      if (dataUrl && !cancelled) restoreFn = setFavicon(dataUrl);
    });
    return () => { cancelled = true; restoreFn?.(); };
  }, [branding.logoBase64, branding.theme?.primary, isAdmin]);

  const classroomStyle = buildThemeVars(branding.theme);

  if (!branding.loaded) return null;

  return (
    <BrandingContext.Provider value={branding}>
      <div style={classroomStyle} className="flex flex-col flex-1">
        {children}
      </div>
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
