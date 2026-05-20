/**
 * Image compression for pasted / uploaded screenshots.
 *
 * Each screenshot is persisted as its own `screenshot:*` sync-data record,
 * and DynamoDB caps a single item at 400 KB. An uncompressed laptop
 * screenshot easily exceeds that — when it did, the write failed silently
 * and the learner's conversation was lost (issues #191, #193). Compressing
 * on the way in keeps every screenshot record comfortably under the limit.
 */

// Target size for the base64-encoded data URL string. DynamoDB's 400 KB item
// limit applies to the stored JSON (including the base64 string + record
// overhead), not the decoded bytes. A base64 string is 33% larger than its
// decoded size (4 chars encode 3 bytes), so we target well under 400 KB to
// leave headroom for the `screenshot:*` key and sync-data metadata.
const DEFAULT_MAX_BYTES = 300 * 1024;

/**
 * Estimate the JSON-serialized size of a data URL for DynamoDB storage.
 * DynamoDB's 400 KB limit applies to the item's JSON representation, which
 * includes the data URL string (the base64 body + "data:image/...;base64,"
 * prefix) plus record overhead (~50 bytes for the sync-data key, version, etc.).
 * Returns the data URL's string length as the size estimate.
 */
export function estimateDataUrlBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return 0;
  return dataUrl.length;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

function encodeJpeg(img, maxEdge, quality) {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Downscale + re-encode an image data URL so it fits inside one sync-data
 * record. Iteratively drops quality, then dimensions, until the result is
 * under `maxBytes`. Always resolves: on any failure (non-image input, no
 * DOM, decode error) it returns the original data URL so the send path
 * still works — a too-large image is a degraded case, never a thrown error.
 */
export async function compressImageDataUrl(dataUrl, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  try {
    if (typeof document === 'undefined' || typeof Image === 'undefined') return dataUrl;
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl;
    // Already small enough — don't re-encode (avoids needless quality loss).
    if (estimateDataUrlBytes(dataUrl) <= maxBytes) return dataUrl;

    const img = await loadImage(dataUrl);
    let edge = 1600;
    let quality = 0.82;
    let out = encodeJpeg(img, edge, quality);

    for (let attempt = 0; attempt < 6 && estimateDataUrlBytes(out) > maxBytes; attempt++) {
      if (quality > 0.5) {
        quality -= 0.15;
      } else {
        edge = Math.round(edge * 0.8);
        quality = 0.7;
      }
      out = encodeJpeg(img, edge, quality);
    }

    // Never hand back something larger than what we started with.
    return estimateDataUrlBytes(out) < estimateDataUrlBytes(dataUrl) ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}
