import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ImagePlus, Loader2, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PRESET_BANNERS, bannerStyle } from '@/lib/profileThemes';

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * BannerUploader — cover image for the public profile. Uploaded images are
 * cropped client-side to 3:1 (1500×500) with a vertical focus slider, and 12
 * built-in abstract banners mean a student with no image still gets a
 * distinctive profile. Controlled: value is the banner_url, onChange fires
 * with the new value ('preset:<id>' | image URL | null).
 */
export default function BannerUploader({ value, onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [focus, setFocus] = useState(0.5);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!ACCEPTED.includes(file.type)) { toast.error('Please upload a JPG, PNG, or WebP image'); return; }
    if (file.size > MAX_SIZE) { toast.error('Image must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setCropSrc(ev.target.result); setFocus(0.5); };
    reader.readAsDataURL(file);
  };

  const applyCrop = async () => {
    if (!cropSrc) return;
    setBusy(true);
    try {
      const file = await cropTo3to1(cropSrc, focus);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCropSrc(null);
      onChange(file_url);
    } catch (err) {
      toast.error(err?.message || 'Failed to upload banner');
    } finally {
      setBusy(false);
    }
  };

  const isPreset = value && value.startsWith('preset:');

  return (
    <div className="space-y-3">
      {/* Current banner */}
      <div className="relative h-20 sm:h-24 rounded-xl border border-border overflow-hidden" style={bannerStyle(value, 'slate')}>
        {value && /^https?:\/\//.test(value) && (
          <img src={value} alt="Banner" className="h-full w-full object-cover" />
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      {/* Crop stage */}
      {cropSrc && (
        <div className="space-y-2.5 p-3 rounded-xl border border-border bg-background">
          <p className="text-xs text-muted-foreground">Drag the slider to choose which part of the image shows — it's cropped to 3:1.</p>
          <div className="aspect-[3/1] rounded-lg overflow-hidden border border-border">
            <img
              src={cropSrc}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `50% ${Math.round(focus * 100)}%` }}
            />
          </div>
          <input
            type="range" min={0} max={1} step={0.01} value={focus}
            onChange={(e) => setFocus(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={applyCrop} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
              {busy ? 'Uploading…' : 'Use this banner'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCropSrc(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Upload */}
      {!cropSrc && (
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImagePlus className="h-4 w-4 mr-1.5" /> Upload your own (cropped to 3:1)
          </Button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
        </div>
      )}

      {/* Built-in banners */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Or pick a built-in banner:</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {PRESET_BANNERS.map((b) => (
            <button
              key={b.id}
              type="button"
              title={b.label}
              onClick={() => onChange(`preset:${b.id}`)}
              className={cn(
                'relative h-10 rounded-lg border overflow-hidden transition-all hover:-translate-y-0.5',
                isPreset && value === `preset:${b.id}` ? 'border-primary ring-2 ring-primary/40' : 'border-border'
              )}
              style={{ background: b.css }}
            >
              {isPreset && value === `preset:${b.id}` && (
                <span className="absolute inset-0 flex items-center justify-center bg-primary/25">
                  <Check className="h-4 w-4 text-white drop-shadow" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Client-side crop to exactly 1500×500 (3:1) at the chosen vertical focus.
function cropTo3to1(dataUrl, focus) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = 1500, H = 500;
      const scale = Math.max(W / img.width, H / img.height);
      const sw = img.width * scale, sh = img.height * scale;
      const sx = (sw - W) / 2;
      const sy = (sh - H) * Math.min(1, Math.max(0, focus));
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, -sx, -sy, sw, sh);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Failed to process image')); return; }
        resolve(new File([blob], 'banner.png', { type: 'image/png' }));
      }, 'image/png', 0.9);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}