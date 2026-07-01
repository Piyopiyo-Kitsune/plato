import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { markEmbedded } from '../lib/embed.js';
import { exchangeBridgeCode } from '../lib/bridgeBoot.js';

/**
 * Embeddable "coach home" — the target of the WordPress Coach *home* block's
 * iframe (`/embed/home?code=<one-time-code>&embed=1`). Unlike the single-lesson
 * embed, this drops the learner into the full authenticated app (courses →
 * modules → lessons) with the embed-aware AppShell chrome (WordPress identity,
 * no sign-out).
 *
 * Boot sequence:
 *   1. Latch embed mode (so AppShell/Settings hide Plato account management).
 *   2. Exchange the single-use bridge code for Plato tokens (no lesson bound).
 *   3. Hand off to the normal app at `/courses`. Because tokens persist in
 *      storage and embed mode is latched in sessionStorage, an in-iframe reload
 *      lands back on `/courses` and re-hydrates without needing a fresh code.
 */
export default function EmbedHome() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const { hydrateSession } = useAuth();
  const navigate = useNavigate();

  const [errorMessage, setErrorMessage] = useState('');
  const ranRef = useRef(false);

  useEffect(() => {
    markEmbedded();

    // Guard against StrictMode's double-invoke — the bridge code is single-use.
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        if (code) await exchangeBridgeCode(code);
        const loggedIn = await hydrateSession();
        if (!loggedIn) {
          throw new Error('You don’t have access to the coach.');
        }
        navigate('/courses', { replace: true });
      } catch (err) {
        setErrorMessage(err.message || 'The coach is unavailable right now.');
      }
    })();
  }, [code, hydrateSession, navigate]);

  return (
    <div className="plato-embed-root h-dvh overflow-hidden bg-stone-100 dark:bg-stone-900">
      {errorMessage ? (
        <main className="flex min-h-dvh items-center justify-center p-6" role="alert">
          <div className="max-w-md text-center text-muted-foreground">
            <p className="mb-3 text-base font-medium text-foreground">The coach isn&apos;t available</p>
            <p>{errorMessage}</p>
          </div>
        </main>
      ) : (
        <main className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="sr-only">Connecting to your coach…</span>
        </main>
      )}
    </div>
  );
}
