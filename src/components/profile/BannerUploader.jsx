import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, ImagePlus, MoveVertical } from 'lucide-react';
import { toast } from 'sonner';
import { PRESET_BANNERS, bannerStyle } from '@/lib/profileThemes';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Client-side crop to the 1500x500 banner format — cover-crop with a vertical
// focus slider so tall photos can be positioned before uploading.
function cropBanner(file, focusPct) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const W = 1500;
        const H = 500;
        const scale = Math.max(W / img.width, H / img.height);
        const sw = W / scale;
        const sh = H / scale;
        const sx = (img.width - sw) / 2;
        const sy = Math.max(0, Math.min(img.height - sh, (img.height - sh) * (focusPct / 100)));
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Failed to process image')); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' }));
        }, 'image/png', 0.9);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Controlled banner picker: upload (cropped to 3:1), 12 built-in abstract
// banners, and remove. Value is a file URL or 'preset:<id>'.
export default function BannerUploader({ value, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [focus, setFocus] = useState(50);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WebP image');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('Image must be under 5 MB');
      return;
    }
    setUploading(true);
    try {
      const cropped = await cropBanner(file, focus);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: cropped });
      onChange(file_url);
    } catch (err) {
      toast.error(err?.message || 'Failed to upload banner');
    } finally {
      setUploading(false);
    }
  };

  const style = bannerStyle(value);

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div
        className={`relative h-20 sm:h-24 overflow-hidden border border-border ${style ? '' : 'bg-secondary/40'}`}
        style={{ borderRadius: 'var(--pf-radius, 14px)' }}
      >
        {style ? (
          <div className="h-full w-full" style={style} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <p className="text-xs text-muted-foreground">No banner yet — upload one or pick a design below</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-4 w-4 mr-1.5" /> Upload image
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange(null)}
            className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4 mr-1.5" /> Remove
          </Button>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <MoveVertical className="h-3.5 w-3.5" />
          Crop position
          <input
            type="range" min="0" max="100" value={focus}
            onChange={(e) => setFocus(Number(e.target.value))}
            className="w-24 accent-[hsl(var(--primary))]"
            aria-label="Vertical crop position"
          />
        </label>
      </div>

      {/* Built-in abstract banners */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {PRESET_BANNERS.map((b) => (
          <button
            key={b.id}
            type="button"
            title={b.label}
            onClick={() => onChange(`preset:${b.id}`)}
            className={`h-9 rounded-lg border transition-transform hover:scale-[1.03] ${value === `preset:${b.id}` ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}
            style={{ background: b.css }}
            aria-label={`Banner: ${b.label}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG or WebP · Max 5 MB · Cropped to 1500×500 (3:1)</p>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
    </div>
  );
}