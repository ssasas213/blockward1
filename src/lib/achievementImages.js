// Client-side image processing for achievement covers and evidence.
// Shared by the student request form, self-reported achievements and teacher
// issuance so every upload is validated and compressed the same way.

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const EVIDENCE_TYPES = [...IMAGE_TYPES, 'application/pdf'];
const MAX_WIDTH = 1600;

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function canvasToFile(canvas, file, ext = 'jpg', quality = 0.85) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Failed to process image')); return; }
      resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` }));
    }, `image/${ext === 'jpg' ? 'jpeg' : ext}`, quality);
  });
}

export function validateImageFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) return 'Please upload a JPG, PNG, or WebP image';
  if (file.size > MAX_SIZE) return 'Image must be under 10 MB';
  return null;
}

export function validateEvidenceFile(file) {
  if (!EVIDENCE_TYPES.includes(file.type)) return 'Evidence must be a JPG, PNG, WebP image or a PDF';
  if (file.size > MAX_SIZE) return 'Files must be under 10 MB';
  return null;
}

/**
 * Cover image: center-cropped to 4:3 (uniform tiles) and compressed before
 * upload. This is the PUBLIC, decorative image shown on the public profile.
 */
export async function processCoverImage(file) {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const img = await readImage(file);
  // Center-crop the largest 4:3 region, then scale down to MAX_WIDTH.
  const target = 4 / 3;
  let cw = img.width, ch = Math.round(img.width / target);
  if (ch > img.height) { ch = img.height; cw = Math.round(img.height * target); }
  const sx = Math.round((img.width - cw) / 2);
  const sy = Math.round((img.height - ch) / 2);
  const outW = Math.min(cw, MAX_WIDTH);
  const outH = Math.round(outW / target);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, cw, ch, 0, 0, outW, outH);
  return canvasToFile(canvas, file);
}

/**
 * Evidence image: compressed (aspect kept, capped at 1600px wide) before
 * upload. PDFs pass through untouched. Evidence is shown to verifiers and is
 * not public unless the student opts in.
 */
export async function processEvidenceImage(file) {
  const err = validateEvidenceFile(file);
  if (err) throw new Error(err);
  if (file.type === 'application/pdf') return file;
  const img = await readImage(file);
  const outW = Math.min(img.width, MAX_WIDTH);
  const outH = Math.round((img.height / img.width) * outW);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, outW, outH);
  return canvasToFile(canvas, file);
}

// "image" vs "file" classification used by StudentRecord.file_type.
export function evidenceFileType(url, type) {
  if (type?.startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'file';
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url || '') ? 'image' : 'file';
}