// On-device photo check: a transparent colour analysis of the part of a photo
// where water usually is. It suggests, never decides. The photo stays on the
// phone; only the hint and a SHA-256 fingerprint are kept with the record.

export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, max ? d / max : 0, max];
}

/** Classify pixels into water-look categories. pixels: Uint8ClampedArray RGBA. */
export function classifyPixels(pixels) {
  const counts = { foam: 0, brown: 0, green: 0, clear: 0, other: 0 };
  let n = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const [hue, s, v] = rgbToHsv(pixels[i], pixels[i + 1], pixels[i + 2]);
    n += 1;
    if (v > 0.82 && s < 0.16) counts.foam += 1;
    else if (hue >= 18 && hue <= 52 && s >= 0.22 && v >= 0.2 && v <= 0.85) counts.brown += 1;
    else if (hue > 62 && hue <= 165 && s >= 0.28 && v >= 0.18) counts.green += 1;
    else if ((hue > 165 && hue <= 260 && s >= 0.08) || (s < 0.2 && v >= 0.15 && v <= 0.82)) counts.clear += 1;
    else counts.other += 1;
  }
  const share = Object.fromEntries(Object.entries(counts).map(([k, c]) => [k, n ? c / n : 0]));
  return { share, n };
}

/** Turn colour shares into a suggestion with its own explanation. */
export function suggestFromShares(share) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  if (share.foam >= 0.25) return { suggest: 'FO', label: 'foamy', confidence: Math.min(0.95, 0.5 + share.foam), explanation: `${pct(share.foam)} of the water area is bright white, like foam.` };
  if (share.brown >= 0.35) return { suggest: 'MU', label: 'muddy', confidence: Math.min(0.95, 0.35 + share.brown), explanation: `${pct(share.brown)} of the water area is brown-yellow, typical of muddy water.` };
  if (share.green >= 0.45) return { suggest: 'CO', label: 'green', confidence: Math.min(0.85, 0.25 + share.green), explanation: `${pct(share.green)} of the water area is green. That can be algae, or plants in the frame.` };
  if (share.clear >= 0.4) return { suggest: 'CL', label: 'clear', confidence: Math.min(0.8, 0.2 + share.clear), explanation: `${pct(share.clear)} of the water area is blue-grey or neutral, typical of clear water and reflections.` };
  return { suggest: null, label: 'unclear', confidence: 0, explanation: 'No colour dominates the water area, so the photo gives no hint.' };
}

async function sha256(buf) {
  if (!crypto || !crypto.subtle) return null;
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Analyse a File from <input type=file>. Returns {hint, preview, hash, size}. */
export async function analysePhoto(file) {
  const buf = await file.arrayBuffer();
  const hash = await sha256(buf);
  const url = URL.createObjectURL(file);
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = url;
  });
  const w = 180;
  const hgt = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = hgt;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, hgt);
  // Water is usually in the lower middle of a stream photo.
  const x0 = Math.round(w * 0.2);
  const y0 = Math.round(hgt * 0.5);
  const data = ctx.getImageData(x0, y0, Math.round(w * 0.6), Math.round(hgt * 0.45)).data;
  const { share } = classifyPixels(data);
  return { hint: { ...suggestFromShares(share), share }, preview: url, hash, size: file.size };
}
