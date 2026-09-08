import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { processCoverImage } from '@/lib/achievementImages';

/**
 * CoverImagePicker — uploads the PUBLIC cover image for an achievement.
 * The image is auto-cropped to 4:3 and compressed client-side before upload so
 * profile tiles stay uniform. Used by the student request form, self-reported
 * achievements and teacher issuance.
 */
export default function CoverImagePicker({ imageUrl, onChange, label = 'Cover image' }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const processed = await processCoverImage(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: processed });
      onChange(file_url);
      toast.success('Cover image added');
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Failed to upload image';
      const status = err?.response?.status ? ` (HTTP ${err.response.status})` : '';
      toast.error(`${detail}${status}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1.5" />}
          {imageUrl ? 'Replace cover' : 'Add cover photo'}
        </Button>
        {imageUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => onChange('')}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Remove
          </Button>
        )}
        <span className="text-xs text-muted-foreground">JPG, PNG, WebP · max 10 MB · cropped to 4:3</span>
      </div>

      {imageUrl ? (
        <div className="relative aspect-[4/3] w-full max-w-xs overflow-hidden rounded-xl border border-border">
          <img src={imageUrl} alt="Cover" className="h-full w-full object-cover" />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Optional — without a photo we generate a branded cover from your organisation and title automatically.
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}