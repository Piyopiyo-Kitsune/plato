import { useState, useRef, useId, useEffect } from 'react';
import { useAutoResize } from '../../hooks/useAutoResize.js';
import { Button } from '@/components/ui/button';

export default function ComposeBar({
  placeholder = 'Ask a question...',
  onSend,
  disabled = false,
  allowImages = false,
  elevated = false,
  text: textProp,
  onTextChange,
  image: imageProp,
  onImageChange,
}) {
  const [localText, setLocalText] = useState('');
  const [localImage, setLocalImage] = useState(null);
  const text = textProp !== undefined ? textProp : localText;
  const setText = onTextChange || setLocalText;
  const image = imageProp !== undefined ? imageProp : localImage;
  const setImage = onImageChange || setLocalImage;
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const handleResize = useAutoResize();
  const inputId = useId();

  // The lesson chat mounts two ComposeBar instances — an inline one and a
  // fixed-overlay one — and a window-scroll listener swaps which is visible
  // (`composePinned` in `LessonChat.jsx`). Each instance owns its own
  // textarea ref. Without this effect, the freshly-mounted instance renders
  // at `rows={1}` (its default) even when `text` already has multiple lines,
  // because `useAutoResize` only fires on the `change` event and never sees
  // the externally-supplied initial value. Result before this fix: when the
  // user scrolls and the overlay swap happens, the textarea collapses back
  // to a single line. (Bug #161.) Resync on every change to `text`, which
  // covers both mount-with-prefilled-value and the rare case of the parent
  // setting text from outside (e.g. retry / paste flows).
  useEffect(() => {
    if (!inputRef.current) return;
    handleResize({ target: inputRef.current });
  }, [text, handleResize]);

  const send = () => {
    const val = text.trim();
    if ((!val && !image) || disabled) return;
    const payload = { text: val || null, imageDataUrl: image?.dataUrl || null };
    setText('');
    setImage(null);
    if (inputRef.current) { inputRef.current.style.height = 'auto'; inputRef.current.style.overflowY = 'hidden'; }
    onSend(payload);
  };

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Bedrock 5 MB limit
  const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // Bedrock 5 MB limit for documents

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      alert('Only images and PDF files are supported.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const maxSize = isPdf ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxSize) {
      alert(`${isPdf ? 'PDF' : 'Image'} must be under 5 MB.`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage({ dataUrl: reader.result, name: file.name, isPdf });
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handlePaste = (e) => {
    if (!allowImages) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        if (file.size > MAX_IMAGE_BYTES) {
          alert('Image must be under 5 MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => setImage({ dataUrl: reader.result, name: file.name || 'pasted-image.png' });
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const hasContent = text.trim() || image;

  return (
    <div className="px-4 pb-4 pt-2">
      <div className={`mx-auto max-w-3xl rounded-lg border border-input bg-background ${elevated ? 'shadow-lg' : ''}`}>
        {image && (
          <div className="relative m-2 inline-block">
            {image.isPdf ? (
              <div className="flex items-center gap-2 rounded-md border border-input bg-muted px-3 py-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span className="text-sm">{image.name}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setImage(null)}
                  aria-label="Remove PDF"
                >
                  &times;
                </Button>
              </div>
            ) : (
              <>
                <img src={image.dataUrl} alt={image.name} className="h-20 rounded-md object-cover" />
                <Button
                  variant="secondary"
                  size="icon-xs"
                  className="absolute -top-1.5 -right-1.5 rounded-full"
                  onClick={() => setImage(null)}
                  aria-label="Remove image"
                >
                  &times;
                </Button>
              </>
            )}
          </div>
        )}
        <label htmlFor={inputId} className="sr-only">Your message</label>
        <textarea
          ref={inputRef}
          id={inputId}
          className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          rows={1}
          placeholder={placeholder}
          value={text}
          onChange={(e) => { setText(e.target.value); handleResize(e); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
          onPaste={handlePaste}
          disabled={disabled}
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          {allowImages && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Upload image or PDF"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => fileRef.current?.click()}
                disabled={disabled}
                aria-label="Attach image or PDF"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </Button>
            </>
          )}
          <div className="flex-1" />
          <Button
            variant="default"
            size="icon-sm"
            className={`transition-opacity ${hasContent ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-label="Send"
            onClick={send}
            disabled={disabled || !hasContent}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
