import { useRef, useState } from 'react';
import { Paperclip, X, Send, Loader2 } from 'lucide-react';
import { assertImageWithinBedrockLimit } from '../lib/lessonEngine.js';

const MAX_IMAGES = 4;

export default function ComposeBar({ onSend, disabled, placeholder = 'Type a message…' }) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]); // array of { dataUrl, name }
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleFileChange(e) {
    setError(null);
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = MAX_IMAGES - images.length;
    const toProcess = files.slice(0, remaining);

    if (files.length > remaining) {
      setError(`You can attach up to ${MAX_IMAGES} images per message. Only the first ${remaining} were added.`);
    }

    const newImages = [];
    for (const file of toProcess) {
      const dataUrl = await readFileAsDataUrl(file);
      try {
        assertImageWithinBedrockLimit(dataUrl);
        newImages.push({ dataUrl, name: file.name });
      } catch (err) {
        setError(err.message);
        break;
      }
    }

    setImages(prev => [...prev, ...newImages]);
    // Reset the input so the same file can be re-selected after removal
    e.target.value = '';
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  function removeImage(idx) {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setError(null);
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    if (disabled) return;
    const imageDataUrls = images.map(img => img.dataUrl);
    onSend(trimmed, imageDataUrls.length > 0 ? imageDataUrls : null);
    setText('');
    setImages([]);
    setError(null);
  }

  const canSend = (text.trim().length > 0 || images.length > 0) && !disabled;
  const canAddMore = images.length < MAX_IMAGES;

  return (
    <div className="border-t bg-background p-3 space-y-2">
      {error && (
        <div className="text-xs text-red-600 px-1">{error}</div>
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {images.map((img, idx) => (
            <div key={idx} className="relative inline-block">
              <img
                src={img.dataUrl}
                alt={img.name}
                className="h-16 w-16 object-cover rounded border border-border"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={`Remove image ${img.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => canAddMore && fileRef.current?.click()}
          disabled={disabled || !canAddMore}
          className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Attach images"
          title={canAddMore ? `Attach images (up to ${MAX_IMAGES})` : `Maximum ${MAX_IMAGES} images per message`}
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
        />
        <textarea
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] max-h-32"
          rows={1}
          placeholder={placeholder}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Message"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="shrink-0 p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          {disabled ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
