/**
 * Prepare an image in the browser before upload:
 *  - reads its real size
 *  - scales it down so it is no bigger than needed for its spot (never up)
 *  - converts it to WebP (JPEG if the browser cannot write WebP; PNG kept for transparent images)
 * The original file is used when optimising would not make it smaller.
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ img, url }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as an image.')); };
    img.src = url;
  });
}

function toBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(b => resolve(b), type, quality));
}

function hasTransparency(ctx, w, h) {
  try {
    const step = Math.max(1, Math.floor(Math.min(w, h) / 64));
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] < 250) return true;
      }
    }
  } catch (e) { /* ignore */ }
  return false;
}

/**
 * @param {File} file
 * @param {{width:number,height:number,ratio:number|null}} spec target size for this spot
 * @returns {Promise<{file: File, before: {w,h,size,type}, after: {w,h,size,type}, optimised: boolean}>}
 */
export async function optimiseImage(file, spec) {
  const { img, url } = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const before = { w, h, size: file.size, type: file.type };
  try {
    // Scale so the image still fully covers the target box, but no larger
    let scale = 1;
    if (spec && spec.width && spec.height) {
      if (spec.ratio) scale = Math.min(1, Math.max(spec.width / w, spec.height / h));
      else scale = Math.min(1, Math.max(spec.width, spec.height) / Math.max(w, h));
    }
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, tw, th);

    let blob = await toBlob(canvas, 'image/webp', 0.82);
    if (!blob || blob.type !== 'image/webp') {
      blob = hasTransparency(ctx, tw, th) ? await toBlob(canvas, 'image/png') : await toBlob(canvas, 'image/jpeg', 0.85);
    }
    if (!blob || (blob.size >= file.size && scale === 1)) {
      return { file, before, after: before, optimised: false };
    }
    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
    const base = (file.name || 'image').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'image';
    const out = new File([blob], `${base}.${ext}`, { type: blob.type });
    return { file: out, before, after: { w: tw, h: th, size: out.size, type: out.type }, optimised: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
