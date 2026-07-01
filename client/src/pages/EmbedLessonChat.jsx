import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { BrandingProvider } from '../contexts/BrandingContext.jsx';
import { markEmbedded } from '../lib/embed.js';
import { exchangeBridgeCode } from '../lib/bridgeBoot.js';
import LessonChat from './LessonChat.jsx';

/**
 * Embeddable lesson coach — the target of the WordPress "Agentic Coach" block's
 * iframe (`/embed/lesson/:lessonGroupId?code=<one-time-code>`).
 *
 * Boot sequence:
 *   1. Exchange the single-use bridge code for Plato access/refresh tokens and
 *      seed them into storage (so the learner is logged in as their stable,
 *      WordPress-mapped Plato user — chat history + course memory persist).
 *   2. Strip the spent code from the URL so a reload can't try to reuse it.
 *   3. Re-hydrate AuthContext, which lets AppContext load lessons and renders
 *      the normal LessonChat — minus the admin/classroom chrome.
 *
 * Reuses Plato's real lesson engine wholesale; no coaching logic is duplicated.
 */
export default function EmbedLessonChat() {
  const { lessonGroupId } = useParams();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const { hydrateSession } = useAuth();

  // 'authenticating' | 'ready' | 'error'
  const [status, setStatus] = useState('authenticating');
  const [errorMessage, setErrorMessage] = useState('');
  const ranRef = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    // This client is running inside the WordPress Coach iframe — latch embed
    // mode so account/settings chrome stays hidden across any in-app navigation
    // (SUGGESTED-IMPROVEMENTS 7a). Runs before the StrictMode guard so it's set
    // even on the discarded first invoke.
    markEmbedded();

    // Guard against StrictMode's double-invoke — the bridge code is single-use.
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        if (code) {
          const data = await exchangeBridgeCode(code);
          // Remove the spent code from the address bar (history, not navigation).
          const target = data.lessonId || lessonGroupId;
          window.history.replaceState({}, '', `/embed/lesson/${target}`);
        }

        const loggedIn = await hydrateSession();
        if (!loggedIn) {
          throw new Error('You don’t have access to this lesson.');
        }
        setStatus('ready');
      } catch (err) {
        setErrorMessage(err.message || 'The coach is unavailable right now.');
        setStatus('error');
      }
    })();
  }, [code, lessonGroupId, hydrateSession]);

  // Report content height to the parent WordPress page so the iframe can size
  // itself responsively. Posts on mount, on resize, and whenever status changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const post = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height > 0) {
        window.parent?.postMessage({ type: 'plato:embed:resize', height }, '*');
      }
    };
    post();
    const observer = new ResizeObserver(post);
    observer.observe(el);
    return () => observer.disconnect();
  }, [status]);

  return (
    <div ref={containerRef} className="plato-embed-root h-dvh overflow-hidden bg-stone-100 dark:bg-stone-900">
      {status === 'authenticating' && (
        <main className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="sr-only">Connecting to your coach…</span>
        </main>
      )}

      {status === 'error' && (
        <main className="flex min-h-dvh items-center justify-center p-6" role="alert">
          <div className="max-w-md text-center text-muted-foreground">
            <p className="mb-3 text-base font-medium text-foreground">The coach isn&apos;t available</p>
            <p>{errorMessage}</p>
          </div>
        </main>
      )}

      {status === 'ready' && (
        <BrandingProvider>
          {/* Fixed-height internal scroll container: keeps the coach's
              auto-scroll-to-latest inside the embed so it never scrolls the
              host WordPress page. */}
          {/* scroll-padding keeps a keyboard-focused element clear of the fixed
              compose bar / pinned header — WCAG 2.2 SC 2.4.11. */}
          <main id="main-content" className="mx-auto h-full max-w-3xl overflow-y-auto scroll-pt-16 scroll-pb-32 px-4" tabIndex={-1}>
            <LessonChat />
          </main>
        </BrandingProvider>
      )}
    </div>
  );
}
