import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const CONSENT_KEY = 'plato_image_consent_v1';

/** Whether this learner has already agreed to the image-upload terms. */
export function hasImageConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberImageConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, '1');
  } catch {
    /* private mode — consent falls back to per-session (asked again next load). */
  }
}

/**
 * One-time consent gate shown before a learner's first image upload. Radix
 * Dialog gives us a focus trap, Escape-to-close, aria-modal, and title/description
 * wiring for free; "Continue" is disabled until the learner ticks the checkbox.
 *
 * @param {object}   props
 * @param {boolean}  props.open      Whether the dialog is shown.
 * @param {Function} props.onAgree   Called (and consent persisted) on Continue.
 * @param {Function} props.onCancel  Called when the learner declines / closes.
 */
export default function ImageConsentDialog({ open, onAgree, onCancel }) {
  const [checked, setChecked] = useState(false);
  const checkboxRef = useRef(null);

  // Reset the checkbox each time the dialog opens and move focus to it so
  // keyboard users land on the actionable control, not the close button.
  useEffect(() => {
    if (open) {
      setChecked(false);
      requestAnimationFrame(() => checkboxRef.current?.focus());
    }
  }, [open]);

  const agree = () => {
    if (!checked) return;
    rememberImageConsent();
    onAgree();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Before you share an image</DialogTitle>
          <DialogDescription>
            Please read this before uploading images to your coaching session.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">What it&apos;s for:</strong> images you upload
            are used only to help the coach review your lesson work.
          </li>
          <li>
            <strong className="text-foreground">Who can see it:</strong> your coaching session
            and the people who run this learning program. It is processed by the connected AI
            service to give you feedback.
          </li>
          <li>
            <strong className="text-foreground">How long it&apos;s kept:</strong> images are kept
            with your lesson conversation and are removed when your data is deleted.
          </li>
          <li>
            <strong className="text-foreground">Please don&apos;t</strong> upload anything
            inappropriate, offensive, or that is not your own lesson work.
          </li>
          <li>
            <strong className="text-foreground">Note:</strong> this coach may be used by learners
            of all ages, including minors.
          </li>
        </ul>

        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <span>I understand and agree to these terms.</span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={agree} disabled={!checked}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
