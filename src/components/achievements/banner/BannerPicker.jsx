import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ImagePlus, Trash2, Replace } from 'lucide-react';
import { toast } from 'sonner';
import { processBannerImage } from '@/lib/achievementImages';

/**
 * BannerPicker — upload, crop, reposition, replace and remove the OPTIONAL
 * decorative achievement banner (16:9). The image is processed client-side
 * (cropped to the user's chosen zoom/position, compressed) and uploaded as a
 * permanent public URL — presentation metadata only: it is never evidence and
 * never part of the credential or its verification.
 *
 * onChange(url | null) fires when the draft changes; the caller decides when
 * to persist (the create form keeps it in form state, the edit dialog writes
 * it to AchievementMeta immediately).
 */
export default function BannerPicker({ value, onChange, compact = false }) {
  const fileRef = useRef(null);
  const frameRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState(null); // { url(objectURL), w, h }
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0.5, y: 0.5 });
  const drag = useRef(null);

  const openFile = () => fileRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setDraft({ url, w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0.5, y: 0.5 });
    };
    img.onerror = () => { toast.error('Could not read that image'); URL.revokeObjectURL(url); };
    img.src = url;
  };

  const cancelDraft = () => {
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft(null);
  };

  const commitDraft = async () => {
    if (!draft) return;
    setUploading(true);
    try {
      // Fetch the original file back from the object URL for processing.
      const blob = await (await fetch(draft.url)).blob();
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      const file = new File([blob], `banner.${ext}`, { type: blob.type });
      const processed = await processBannerImage(file, { zoom, offsetX: offset.x, offsetY: offset.y });
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: processed });
      onChange(file_url);
      cancelDraft();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to upload the banner');
    } finally {
      setUploading(false);
    }
  };

  // ── Crop interaction — drag to reposition, slider to zoom ──
  const onPointerDown = (e) => {
    e.preventDefault();
    const frame = frameRef.current;
    if (!frame) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    frame.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current || !frameRef.current) return;
    const frame = frameRef.current;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const base = Math.max(fw / draft.w, fh / draft.h);
    const scale = base * zoom;
    const availX = draft.w * scale - fw;
    const availY = draft.h * scale - fh;
    let nx = drag.current.ox;
    let ny = drag.current.oy;
    if (availX > 0) nx = drag.current.ox - (e.clientX - drag.current.x) / availX;
    if (availY > 0) ny = drag.current.oy - (e.clientY - drag.current.y) / availY;
    setOffset({
      x: Math.min(Math.max(nx, 0), 1),
      y: Math.min(Math.max(ny, 0), 1),
    });
  };
  const onPointerUp = () => { drag.current = null; };

  const previewStyle = () => {
    if (!draft || !frameRef.current) return {};
    const frame = frameRef.current;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const base = Math.max(fw / draft.w, fh / draft.h);
    const scale = base * zoom;
    return {
      width: draft.w * scale,
      height: draft.h * scale,
      left: (fw - draft.w * scale) * offset.x,
      top: (fh - draft.h * scale) * offset.y,
    };
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />

      {/* Crop editor */}
      {draft && (
        <div className="rounded-xl border border-border p-3 space-y-3">
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative aspect-video w-full overflow-hidden rounded-lg bg-secondary cursor-grab active:cursor-grabbing touch-none select-none"
          >
            <img src={draft.url} alt="Banner preview" draggable={false} className="absolute pointer-events-none" style={previewStyle()} />
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white pointer-events-none">
              Drag to reposition
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground flex-shrink-0 w-10">Zoom</span>
            <input
              type="range" min={1} max={2.5} step={0.05} value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[hsl(var(--primary))]"
              aria-label="Zoom"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={commitDraft} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null} Use this banner
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={cancelDraft} disabled={uploading}>Cancel</Button>
            <span className="text-xs text-muted-foreground">JPG, PNG or WebP · max 10 MB · cropped to 16:9 and optimised</span>
          </div>
        </div>
      )}

      {/* Current banner preview */}
      {!draft && value && (
        <div className={`relative ${compact ? 'max-w-xs' : 'max-w-md'} overflow-hidden rounded-xl border border-border`}>
          <div className="aspect-video">
            <img src={value} alt="Achievement banner" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-wrap gap-2 p-2.5">
            <Button type="button" variant="outline" size="sm" onClick={openFile} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Replace className="h-3.5 w-3.5 mr-1.5" />} Replace
            </Button>
            <Button
              type="button" variant="outline" size="sm"
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => onChange(null)} disabled={uploading}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!draft && !value && (
        <button
          type="button"
          onClick={openFile}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Add banner image'}
        </button>
      )}
    </div>
  );
}