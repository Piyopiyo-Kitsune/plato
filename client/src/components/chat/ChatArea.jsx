import { useRef, useEffect, useCallback, forwardRef } from 'react';
import { useChatKeyboardNav } from '../../hooks/useChatKeyboardNav.js';

// Nearest scrollable ancestor of `node`, or null. Used to keep auto-scroll
// contained: scrollIntoView bubbles to EVERY ancestor scroll container — including
// the host window when the chat is embedded in an iframe — which scrolls the
// parent WordPress page as the coach streams. Setting scrollTop on this container
// instead moves only the chat, never the host page.
function getScrollParent(node) {
  let el = node?.parentElement;
  while (el && el !== document.body) {
    const overflowY = getComputedStyle(el).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

const ChatArea = forwardRef(function ChatArea({ children, scrollTrigger, announcement }, ref) {
  const logRef = useRef(null);
  const bottomRef = useRef(null);

  // Merge the forwarded ref with our internal logRef
  const setRefs = useCallback((node) => {
    logRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  useChatKeyboardNav(logRef);

  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;
    const scroller = getScrollParent(bottom);
    if (scroller) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    } else {
      // No internal scroll container (rare) — fall back to the previous behavior.
      bottom.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrollTrigger]);

  return (
    <>
      <div
        className="p-4 text-base"
        role="log"
        tabIndex={0}
        aria-live="off"
        aria-label="Chat log"
        aria-description="Use Alt plus Arrow keys to navigate between messages"
        ref={setRefs}
      >
        <div className="mx-auto max-w-3xl space-y-3">
          {children}
        </div>
        <div ref={bottomRef} aria-hidden="true" />
      </div>
      {/* Separate live region for screen reader announcements — kept outside the
          log so VoiceOver doesn't re-read chat history on every update */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </>
  );
});

export default ChatArea;
