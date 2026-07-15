import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Trash2, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export default function ProfilePictureUploader({ profile, onUpdated }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState(profile?.avatar_url || '');

  const initials = (profile?.first_name?.[0] || '?').toUpperCase();
  const hasAvatar = !!profile?.avatar_url;

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
      // Center-crop to square via canvas
      const croppedFile = await cropToSquare(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: croppedFile });
      await base44.entities.UserProfile.update(profile.id, { avatar_url: file_url });
      toast.success('Profile picture updated');
      if (onUpdated) onUpdated({ ...profile, avatar_url: file_url });
    } catch (err) {
      toast.error(err?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await base44.entities.UserProfile.update(profile.id, { avatar_url: '' });
      toast.success('Profile picture removed');
      if (onUpdated) onUpdated({ ...profile, avatar_url: '' });
    } catch (err) {
      toast.error('Failed to remove picture');
    } finally {
      setUploading(false);
    }
  };

  const saveUrlDirect = async () => {
    if (!avatarUrlInput.trim()) return;
    setUploading(true);
    try {
      await base44.entities.UserProfile.update(profile.id, { avatar_url: avatarUrlInput.trim() });
      toast.success('Avatar URL saved');
      if (onUpdated) onUpdated({ ...profile, avatar_url: avatarUrlInput.trim() });
    } catch (err) {
      toast.error('Failed to save URL');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      {/* Avatar preview */}
      <div className="relative flex-shrink-0">
        {hasAvatar ? (
          <img
            src={profile.avatar_url}
            alt="Profile"
            className="h-24 w-24 rounded-2xl object-cover border-2 border-border shadow-lg"
          />
        ) : (
          <div className="h-24 w-24 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-lg border-2 border-border bg-gradient-to-br from-primary to-accent">
            {initials}
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-1.5" />
            Upload Photo
          </Button>
          {hasAvatar && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={handleRemove}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Remove Photo
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, or WebP · Max 5 MB · Auto-cropped to square</p>

        {/* Advanced — manual URL */}
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced settings
          </button>
          {showAdvanced && (
            <div className="flex gap-2 mt-2">
              <input
                type="url"
                value={avatarUrlInput}
                onChange={e => setAvatarUrlInput(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="flex-1 h-8 rounded-md bg-input/50 border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground/60"
              />
              <Button type="button" size="sm" variant="secondary" disabled={uploading} onClick={saveUrlDirect}>
                Save URL
              </Button>
            </div>
          )}
        </div>
      </div>

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

function cropToSquare(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Failed to process image')); return; }
          const cropped = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
          resolve(cropped);
        }, 'image/png', 0.9);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}